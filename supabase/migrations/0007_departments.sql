-- =====================================================================
-- Task Track — แผนก
--   • ผู้ใช้ 1 คน อยู่ 1 แผนก (Admin กำหนด)
--   • งานเป็นของแผนกคนแจ้งโดยอัตโนมัติ
--   • ผู้ใช้เห็นเฉพาะงานแผนกตัวเอง (+ งานที่ตัวเองแจ้ง) / Admin เห็นทุกแผนก
--   • แจ้งเตือนงานใหม่ ส่งเฉพาะคนในแผนกเดียวกัน
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (ต่อจาก 0006)
-- =====================================================================

-- ---------- ตารางแผนก ----------
create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (btrim(name) <> ''),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.departments enable row level security;
grant select, insert, update on public.departments to authenticated;

drop policy if exists departments_read on public.departments;
drop policy if exists departments_add  on public.departments;
drop policy if exists departments_edit on public.departments;
create policy departments_read on public.departments for select to authenticated using (public.is_active_user());
create policy departments_add  on public.departments for insert to authenticated with check (public.is_admin());
create policy departments_edit on public.departments for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- ผูกแผนก ----------
alter table public.profiles       add column if not exists department_id uuid references public.departments (id);
alter table public.allowed_emails add column if not exists department_id uuid references public.departments (id);
alter table public.tasks          add column if not exists department_id uuid references public.departments (id);
create index if not exists tasks_department_idx on public.tasks (department_id);

-- แผนกของผู้ใช้ที่กำลังใช้งาน
create or replace function public.my_department()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.department_id from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

-- ผู้ใช้ใหม่: รับแผนกจากรายชื่อที่ Admin อนุญาต
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  a public.allowed_emails%rowtype;
begin
  select * into a from public.allowed_emails where email = lower(new.email);
  if not found then
    raise exception 'EMAIL_NOT_ALLOWED';
  end if;
  insert into public.profiles (id, email, full_name, role, department_id)
  values (new.id, lower(new.email), a.full_name, a.role, a.department_id)
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------- งานใหม่: ใส่แผนกของคนแจ้งให้อัตโนมัติ ----------
create or replace function public.tasks_before_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.reporter_id   := auth.uid();
  new.status        := 'pending';
  new.owner_id      := null;
  new.status_note   := null;
  new.solution      := null;
  new.created_at    := now();
  new.updated_at    := now();
  new.department_id := public.my_department();

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

-- ---------- แก้งาน: แผนกเปลี่ยนได้เฉพาะ Admin ----------
create or replace function public.tasks_guard_department()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.department_id is distinct from old.department_id and not public.is_admin() then
    new.department_id := old.department_id;
  end if;
  return new;
end $$;

drop trigger if exists tasks_guard_department on public.tasks;
create trigger tasks_guard_department
  before update on public.tasks
  for each row execute function public.tasks_guard_department();

-- งานเดิม: ใช้แผนกของคนแจ้ง (ถ้ามี)
update public.tasks t
   set department_id = p.department_id
  from public.profiles p
 where p.id = t.reporter_id and t.department_id is null and p.department_id is not null;

-- ---------- สิทธิ์ดูงานตามแผนก ----------
create or replace function public.can_see_task(t_department uuid, t_reporter uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user() and (
    public.is_admin()
    or t_reporter = auth.uid()
    or (t_department is not null and t_department = public.my_department())
  );
$$;

drop policy if exists tasks_read on public.tasks;
drop policy if exists tasks_edit on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
  using (public.can_see_task(department_id, reporter_id));
create policy tasks_edit on public.tasks for update to authenticated
  using (public.can_see_task(department_id, reporter_id))
  with check (public.is_active_user());

-- รูป / ประวัติ: ตามสิทธิ์ของงาน
drop policy if exists images_read on public.task_images;
drop policy if exists images_add  on public.task_images;
drop policy if exists images_del  on public.task_images;
create policy images_read on public.task_images for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy images_add on public.task_images for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy images_del on public.task_images for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

drop policy if exists history_read on public.task_history;
create policy history_read on public.task_history for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

-- ไฟล์รูป (โฟลเดอร์ = รหัสงาน)
drop policy if exists tt_images_read   on storage.objects;
drop policy if exists tt_images_upload on storage.objects;
drop policy if exists tt_images_delete on storage.objects;
create policy tt_images_read on storage.objects for select to authenticated
  using (bucket_id = 'task-images' and exists (select 1 from public.tasks t where t.id::text = split_part(name, '/', 1)));
create policy tt_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'task-images' and exists (select 1 from public.tasks t where t.id::text = split_part(name, '/', 1)));
create policy tt_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'task-images' and exists (select 1 from public.tasks t where t.id::text = split_part(name, '/', 1)));

-- ---------- แจ้งเตือน: งานใหม่ส่งเฉพาะคนในแผนกเดียวกัน ----------
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
    select p.id, new.id, 'new', 'งานใหม่: ' || new.title
    from public.profiles p
    where p.is_active and p.role <> 'admin' and p.id is distinct from v_actor
      and new.department_id is not null and p.department_id = new.department_id;
    return new;
  end if;

  select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
    into v_changes
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
   where o.key in ('title', 'detail', 'category_id', 'urgency', 'company_id', 'project_id', 'due_date', 'solution', 'department_id')
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
