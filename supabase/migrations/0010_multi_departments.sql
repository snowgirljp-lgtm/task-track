-- =====================================================================
-- Task Track — ผู้ใช้ 1 คน อยู่ได้หลายแผนก
--   • เห็นงานของทุกแผนกที่สังกัด (+ งานที่ตัวเองแจ้ง) / Admin เห็นทุกแผนก
--   • ตอนแจ้งงาน: ถ้าสังกัดแผนกเดียว ระบบเลือกให้ ถ้าหลายแผนกให้เลือกเอง
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (ต่อจาก 0009)
-- =====================================================================

create table if not exists public.user_departments (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id),
  primary key (user_id, department_id)
);
alter table public.user_departments enable row level security;
grant select, insert, delete on public.user_departments to authenticated;

drop policy if exists user_departments_read  on public.user_departments;
drop policy if exists user_departments_admin on public.user_departments;
create policy user_departments_read on public.user_departments for select to authenticated
  using (public.is_active_user());
create policy user_departments_admin on public.user_departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ย้ายแผนกเดิม (1 คน 1 แผนก) มาไว้ในตารางใหม่
insert into public.user_departments (user_id, department_id)
select id, department_id from public.profiles where department_id is not null
on conflict do nothing;

-- รายชื่อเชิญ: เก็บได้หลายแผนก
alter table public.allowed_emails add column if not exists department_ids uuid[] not null default '{}';
update public.allowed_emails
   set department_ids = array[department_id]
 where department_id is not null and department_ids = '{}';

-- ผู้ใช้ใหม่: รับแผนกทั้งหมดจากรายชื่อเชิญ
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  a public.allowed_emails%rowtype;
begin
  select * into a from public.allowed_emails where email = lower(new.email);
  if not found then
    raise exception 'EMAIL_NOT_ALLOWED';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, lower(new.email), a.full_name, a.role)
  on conflict (id) do nothing;
  insert into public.user_departments (user_id, department_id)
  select new.id, d from unnest(a.department_ids) d
  where exists (select 1 from public.departments x where x.id = d)
  on conflict do nothing;
  return new;
end $$;

-- แผนกนี้เป็นของผู้ใช้ที่กำลังใช้งานหรือไม่
create or replace function public.in_my_department(dep uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select dep is not null and exists (
    select 1 from public.user_departments ud
    join public.profiles p on p.id = ud.user_id
    where ud.user_id = auth.uid() and p.is_active and ud.department_id = dep
  );
$$;

-- เปลี่ยนกติกาการมองเห็นงาน
create or replace function public.can_see_task(t_department uuid, t_reporter uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user() and (
    public.is_admin()
    or t_reporter = auth.uid()
    or public.in_my_department(t_department)
  );
$$;

-- งานใหม่: ตรวจ/เลือกแผนกให้
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
    where p.id = new.project_id and p.company_id = new.company_id and p.is_active and c.is_active
  ) then
    raise exception 'โครงการไม่ตรงกับบริษัท หรือถูกปิดใช้แล้ว';
  end if;

  if not exists (select 1 from public.categories where id = new.category_id and is_active) then
    raise exception 'หมวดหมู่นี้ถูกปิดใช้แล้ว';
  end if;
  return new;
end $$;

-- แจ้งเตือนงานใหม่: ทุกคนที่สังกัดแผนกของงาน (ยกเว้น Admin)
create or replace function public.tasks_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor   uuid := auth.uid();
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.task_history (task_id, actor_id, action, to_status)
    values (new.id, v_actor, 'created', new.status);

    insert into public.notifications (user_id, task_id, kind, message)
    select distinct p.id, new.id, 'new', 'งานใหม่: ' || new.title
    from public.profiles p
    join public.user_departments ud on ud.user_id = p.id and ud.department_id = new.department_id
    where p.is_active and p.role <> 'admin' and p.id is distinct from v_actor;
    return new;
  end if;

  select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
    into v_changes
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
   where o.key in ('title', 'detail', 'category_id', 'urgency', 'company_id', 'project_id', 'due_date', 'solution',
                   'department_id', 'doc_date', 'doc_no', 'po_no', 'amount', 'bill_type_id')
     and o.value is distinct from n.value;

  if new.status is distinct from old.status then
    insert into public.task_history (task_id, actor_id, action, from_status, to_status, note, changes)
    values (new.id, v_actor, 'status', old.status, new.status,
            case when new.status in ('redo', 'cancelled') then new.status_note end,
            v_changes);

    if new.status = 'review' then
      insert into public.notifications (user_id, task_id, kind, message)
      select p.id, new.id, 'review', 'รอตรวจ: ' || new.title
      from public.profiles p
      where p.is_active and p.role = 'admin' and p.id is distinct from v_actor;

    elsif new.status = 'redo' then
      insert into public.notifications (user_id, task_id, kind, message)
      select p.id, new.id, 'redo', 'ส่งกลับแก้ไขใหม่: ' || new.title
      from public.profiles p
      where p.is_active and p.id = new.owner_id and p.id is distinct from v_actor;
    end if;

  elsif v_changes is not null then
    insert into public.task_history (task_id, actor_id, action, changes)
    values (new.id, v_actor, 'edited', v_changes);
  end if;
  return new;
end $$;
