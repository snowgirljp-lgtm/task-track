-- =====================================================================
-- Task Track — ผู้ใช้ขอเพิ่มบริษัท/โครงการ แล้วรอ Admin อนุมัติ
--   approval: approved (ใช้ได้) | pending (รออนุมัติ) | rejected (ไม่อนุมัติ)
--   รายการที่รออนุมัติ เห็นเฉพาะ Admin และคนที่ขอ / เลือกใช้ในงานได้เมื่ออนุมัติแล้วเท่านั้น
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (ต่อจาก 0010)
-- =====================================================================

alter table public.companies add column if not exists approval text not null default 'approved'
  check (approval in ('approved', 'pending', 'rejected'));
alter table public.companies add column if not exists requested_by uuid references public.profiles (id);
alter table public.projects  add column if not exists approval text not null default 'approved'
  check (approval in ('approved', 'pending', 'rejected'));
alter table public.projects  add column if not exists requested_by uuid references public.profiles (id);

-- ---------- ผู้ใช้ทั่วไปเพิ่มได้ แต่จะเป็น "รออนุมัติ" เสมอ ----------
create or replace function public.master_request_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.is_admin() then
      new.approval := coalesce(new.approval, 'approved');
    else
      new.approval     := 'pending';
      new.requested_by := auth.uid();
      new.is_active    := true;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists companies_request_guard on public.companies;
create trigger companies_request_guard before insert on public.companies
  for each row execute function public.master_request_guard();
drop trigger if exists projects_request_guard on public.projects;
create trigger projects_request_guard before insert on public.projects
  for each row execute function public.master_request_guard();

-- ขอโครงการได้เฉพาะในบริษัทที่อนุมัติแล้ว หรือบริษัทที่ตัวเองเพิ่งขอ
create or replace function public.project_request_check()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.companies c
    where c.id = new.company_id
      and (c.approval = 'approved' or (c.approval = 'pending' and c.requested_by = auth.uid()))
  ) then
    raise exception 'ไม่พบบริษัท หรือบริษัทยังไม่ได้รับอนุมัติ';
  end if;
  return new;
end $$;

drop trigger if exists projects_request_check on public.projects;
create trigger projects_request_check before insert on public.projects
  for each row execute function public.project_request_check();

-- ---------- สิทธิ์ ----------
drop policy if exists companies_read on public.companies;
drop policy if exists companies_add  on public.companies;
create policy companies_read on public.companies for select to authenticated
  using (public.is_active_user() and (approval = 'approved' or public.is_admin() or requested_by = auth.uid()));
create policy companies_add on public.companies for insert to authenticated
  with check (public.is_active_user());

drop policy if exists projects_read on public.projects;
drop policy if exists projects_add  on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (public.is_active_user() and (approval = 'approved' or public.is_admin() or requested_by = auth.uid()));
create policy projects_add on public.projects for insert to authenticated
  with check (public.is_active_user());
-- แก้ไข/อนุมัติ ยังเป็นของ Admin เท่านั้น (companies_edit / projects_edit เดิม)

-- ---------- แจ้งเตือน: คำขอใหม่ → Admin / ผลอนุมัติ → ผู้ขอ ----------
create or replace function public.master_request_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_what text := case tg_table_name when 'companies' then 'บริษัท' else 'โครงการ' end;
begin
  if tg_op = 'INSERT' and new.approval = 'pending' then
    insert into public.notifications (user_id, kind, message)
    select p.id, 'approval', 'ขอเพิ่ม' || v_what || ': ' || new.name
    from public.profiles p
    where p.is_active and p.role = 'admin';
  elsif tg_op = 'UPDATE' and old.approval = 'pending' and new.approval <> 'pending' and new.requested_by is not null then
    insert into public.notifications (user_id, kind, message)
    values (
      new.requested_by,
      case new.approval when 'approved' then 'approved' else 'rejected' end,
      case new.approval when 'approved' then 'อนุมัติ' || v_what || 'แล้ว: ' else 'ไม่อนุมัติ' || v_what || ': ' end || new.name
    );
  end if;
  return new;
end $$;

drop trigger if exists companies_request_notify on public.companies;
create trigger companies_request_notify after insert or update on public.companies
  for each row execute function public.master_request_notify();
drop trigger if exists projects_request_notify on public.projects;
create trigger projects_request_notify after insert or update on public.projects
  for each row execute function public.master_request_notify();

-- ---------- งานใหม่: ใช้ได้เฉพาะบริษัท/โครงการที่อนุมัติแล้ว ----------
create or replace function public.tasks_before_insert()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_count int;
begin
  new.reporter_id := auth.uid();
  new.status      := 'pending';
  new.owner_id    := null;
  new.status_note := null;
  new.solution    := null;
  new.created_at  := now();
  new.updated_at  := now();

  if new.department_id is not null then
    if not public.is_admin() and not public.in_my_department(new.department_id) then
      raise exception 'คุณไม่ได้อยู่ในแผนกที่เลือก';
    end if;
  else
    select count(*) into v_count from public.user_departments where user_id = auth.uid();
    if v_count = 1 then
      select department_id into new.department_id from public.user_departments where user_id = auth.uid();
    elsif v_count > 1 then
      raise exception 'กรุณาเลือกแผนก';
    end if;
  end if;

  if not exists (
    select 1 from public.projects p
    join public.companies c on c.id = p.company_id
    where p.id = new.project_id and p.company_id = new.company_id
      and p.is_active and c.is_active
      and p.approval = 'approved' and c.approval = 'approved'
  ) then
    raise exception 'โครงการไม่ตรงกับบริษัท ถูกปิดใช้ หรือยังรออนุมัติ';
  end if;

  if not exists (select 1 from public.categories where id = new.category_id and is_active) then
    raise exception 'หมวดหมู่นี้ถูกปิดใช้แล้ว';
  end if;
  return new;
end $$;
