-- =====================================================================
-- Task Track — โครงสร้างฐานข้อมูลทั้งหมด
-- วิธีใช้: เปิด Supabase > SQL Editor > วางไฟล์นี้ทั้งไฟล์ > Run (รันครั้งเดียว)
-- =====================================================================

-- ---------- ชนิดข้อมูล ----------
create type public.user_role    as enum ('reporter', 'resolver', 'admin');
create type public.task_status  as enum ('pending', 'in_progress', 'review', 'redo', 'done', 'cancelled');
create type public.task_urgency as enum ('low', 'medium', 'high');

-- ---------- รายชื่อ Gmail ที่อนุญาตให้เข้าระบบ (Admin เพิ่มก่อน) ----------
create table public.allowed_emails (
  email      text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  full_name  text not null check (btrim(full_name) <> ''),
  role       public.user_role not null default 'reporter',
  created_at timestamptz not null default now()
);

-- ---------- ผู้ใช้ + บทบาท ----------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  full_name  text not null,
  role       public.user_role not null default 'reporter',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- ข้อมูลหลัก ----------
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (btrim(name) <> ''),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name       text not null check (btrim(name) <> ''),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (btrim(name) <> ''),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- งาน ----------
create sequence public.task_code_seq;

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique default ('TT-' || lpad(nextval('public.task_code_seq')::text, 4, '0')),
  title       text not null check (btrim(title) <> ''),
  detail      text not null check (btrim(detail) <> ''),
  category_id uuid not null references public.categories (id),
  urgency     public.task_urgency not null default 'medium',
  company_id  uuid not null references public.companies (id),
  project_id  uuid not null references public.projects (id),
  due_date    date not null,
  status      public.task_status not null default 'pending',
  status_note text,               -- เหตุผลล่าสุดตอนส่งแก้ไขใหม่ / ยกเลิก
  solution    text,               -- วิธีแก้
  owner_id    uuid references public.profiles (id),   -- ผู้รับผิดชอบ (คนที่กด "กำลังทำ")
  reporter_id uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tasks_status_idx  on public.tasks (status);
create index tasks_company_idx on public.tasks (company_id);
create index tasks_created_idx on public.tasks (created_at desc);

create table public.task_images (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  storage_path text not null unique,
  sort         smallint not null default 0,
  created_by   uuid references public.profiles (id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index task_images_task_idx on public.task_images (task_id);

create table public.task_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  actor_id    uuid references public.profiles (id),
  action      text not null,          -- created | status | edited
  from_status public.task_status,
  to_status   public.task_status,
  note        text,
  changes     jsonb,
  created_at  timestamptz not null default now()
);
create index task_history_task_idx on public.task_history (task_id, created_at);

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete cascade,
  kind       text not null,           -- new | in_progress | review | redo | done | cancelled
  message    text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- =====================================================================
-- ฟังก์ชันตรวจสิทธิ์
-- =====================================================================
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin');
$$;

-- =====================================================================
-- ผู้ใช้ใหม่: สร้าง profile จากรายชื่อที่ Admin อนุญาต / ไม่อยู่ในรายชื่อ = ปฏิเสธ
-- =====================================================================
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
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auth Hook (แนะนำให้เปิด): ปฏิเสธ Gmail ที่ไม่ได้ลงทะเบียนพร้อมข้อความภาษาไทย
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.allowed_emails where email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Gmail นี้ยังไม่ได้ลงทะเบียน กรุณาติดต่อ Admin'));
end $$;

-- กันแก้ข้อมูลผู้ใช้ผิดวิธี
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.email <> old.email then
    raise exception 'แก้ไขอีเมลของผู้ใช้ไม่ได้';
  end if;
  if old.id = auth.uid() and (new.role <> old.role or new.is_active <> old.is_active) then
    raise exception 'ไม่สามารถเปลี่ยนบทบาทหรือระงับบัญชีของตัวเองได้';
  end if;
  return new;
end $$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- =====================================================================
-- กติกางาน
-- =====================================================================
create or replace function public.tasks_before_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.reporter_id := auth.uid();
  new.status      := 'pending';
  new.owner_id    := null;
  new.status_note := null;
  new.solution    := null;
  new.created_at  := now();
  new.updated_at  := now();

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

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function public.tasks_before_insert();

create or replace function public.tasks_before_update()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_admin boolean := public.is_admin();
  v_from  public.task_status := old.status;
  v_to    public.task_status := new.status;
  v_note  text := nullif(btrim(coalesce(new.status_note, '')), '');
begin
  -- ค่าที่ห้ามแก้ไขเอง
  new.id          := old.id;
  new.code        := old.code;
  new.reporter_id := old.reporter_id;
  new.created_at  := old.created_at;
  new.owner_id    := old.owner_id;
  new.status_note := old.status_note;

  if v_from in ('done', 'cancelled') and not v_admin then
    raise exception 'งานนี้ปิดแล้ว แก้ไขได้เฉพาะ Admin';
  end if;

  if (new.company_id, new.project_id) is distinct from (old.company_id, old.project_id) then
    if not exists (select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id) then
      raise exception 'โครงการไม่ตรงกับบริษัท';
    end if;
  end if;

  if v_to is distinct from v_from then
    if v_from in ('pending', 'redo') and v_to = 'in_progress' then
      new.owner_id := auth.uid();                       -- คนกดรับงาน = ผู้รับผิดชอบ

    elsif v_from = 'in_progress' and v_to = 'review' then
      if coalesce(btrim(new.solution), '') = '' then
        raise exception 'กรุณากรอกวิธีแก้ก่อนส่งตรวจ';
      end if;

    elsif v_from = 'review' and v_to = 'done' then
      if not v_admin then raise exception 'เฉพาะ Admin เท่านั้นที่ตรวจงานได้'; end if;
      new.status_note := null;

    elsif v_from = 'review' and v_to = 'redo' then
      if not v_admin then raise exception 'เฉพาะ Admin เท่านั้นที่ตรวจงานได้'; end if;
      if v_note is null then raise exception 'กรุณาใส่เหตุผลที่ส่งกลับแก้ไข'; end if;
      new.status_note := v_note;

    elsif v_to = 'cancelled' and v_from not in ('done', 'cancelled') then
      if not v_admin then raise exception 'เฉพาะ Admin เท่านั้นที่ยกเลิกงานได้'; end if;
      new.status_note := v_note;

    else
      raise exception 'ไม่สามารถเปลี่ยนสถานะนี้ได้';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function public.tasks_before_update();

-- บันทึกประวัติ + แจ้งเตือน
create or replace function public.tasks_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor   uuid := auth.uid();
  v_changes jsonb;
  v_msg     text;
begin
  if tg_op = 'INSERT' then
    insert into public.task_history (task_id, actor_id, action, to_status)
    values (new.id, v_actor, 'created', new.status);

    insert into public.notifications (user_id, task_id, kind, message)
    select p.id, new.id, 'new', 'งานใหม่: ' || new.title
    from public.profiles p
    where p.is_active and p.id is distinct from v_actor;
    return new;
  end if;

  select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
    into v_changes
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
   where o.key in ('title', 'detail', 'category_id', 'urgency', 'company_id', 'project_id', 'due_date', 'solution')
     and o.value is distinct from n.value;

  if new.status is distinct from old.status then
    insert into public.task_history (task_id, actor_id, action, from_status, to_status, note, changes)
    values (new.id, v_actor, 'status', old.status, new.status,
            case when new.status in ('redo', 'cancelled') then new.status_note end,
            v_changes);

    v_msg := case new.status
               when 'in_progress' then 'มีคนรับงาน: '
               when 'review'      then 'รอตรวจ: '
               when 'redo'        then 'ส่งกลับแก้ไขใหม่: '
               when 'done'        then 'เสร็จแล้ว: '
               when 'cancelled'   then 'ยกเลิก: '
               else 'อัปเดต: '
             end || new.title;

    insert into public.notifications (user_id, task_id, kind, message)
    select p.id, new.id, new.status::text, v_msg
    from public.profiles p
    where p.is_active
      and p.id is distinct from v_actor
      and (p.id = new.reporter_id or p.id = new.owner_id or p.role = 'admin');

  elsif v_changes is not null then
    insert into public.task_history (task_id, actor_id, action, changes)
    values (new.id, v_actor, 'edited', v_changes);
  end if;
  return new;
end $$;

create trigger tasks_after_write
  after insert or update on public.tasks
  for each row execute function public.tasks_after_write();

-- รูปไม่เกิน 5 รูปต่องาน
create or replace function public.task_images_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.task_images where task_id = new.task_id) >= 5 then
    raise exception 'แนบรูปได้สูงสุด 5 รูปต่องาน';
  end if;
  return new;
end $$;

create trigger task_images_limit
  before insert on public.task_images
  for each row execute function public.task_images_limit();

-- =====================================================================
-- สิทธิ์ (Row Level Security)
-- =====================================================================
alter table public.allowed_emails enable row level security;
alter table public.profiles       enable row level security;
alter table public.companies      enable row level security;
alter table public.projects       enable row level security;
alter table public.categories     enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_images    enable row level security;
alter table public.task_history   enable row level security;
alter table public.notifications  enable row level security;

-- allowed_emails: Admin จัดการ / ระบบ Auth อ่านได้ (สำหรับ Hook)
create policy allowed_admin_all on public.allowed_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy allowed_auth_read on public.allowed_emails
  for select to supabase_auth_admin using (true);

-- profiles: ทุกคนที่ใช้งานอยู่เห็นรายชื่อ / Admin แก้บทบาทและสถานะ
create policy profiles_read on public.profiles
  for select to authenticated using (public.is_active_user() or id = auth.uid());
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- บริษัท / โครงการ / หมวดหมู่: ทุกคนอ่าน / Admin เพิ่มและแก้ (ไม่มีการลบ ใช้ปิดใช้แทน)
create policy companies_read  on public.companies  for select to authenticated using (public.is_active_user());
create policy companies_add   on public.companies  for insert to authenticated with check (public.is_admin());
create policy companies_edit  on public.companies  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy projects_read   on public.projects   for select to authenticated using (public.is_active_user());
create policy projects_add    on public.projects   for insert to authenticated with check (public.is_admin());
create policy projects_edit   on public.projects   for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_read on public.categories for select to authenticated using (public.is_active_user());
create policy categories_add  on public.categories for insert to authenticated with check (public.is_admin());
create policy categories_edit on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- งาน: ทุกคนเห็นและแก้ได้ (กติกาสถานะตรวจใน trigger) / ไม่มีการลบ
create policy tasks_read on public.tasks for select to authenticated using (public.is_active_user());
create policy tasks_add  on public.tasks for insert to authenticated with check (public.is_active_user());
create policy tasks_edit on public.tasks for update to authenticated using (public.is_active_user()) with check (public.is_active_user());

create policy images_read on public.task_images for select to authenticated using (public.is_active_user());
create policy images_add  on public.task_images for insert to authenticated with check (public.is_active_user());
create policy images_del  on public.task_images for delete to authenticated using (public.is_active_user());

-- ประวัติ: อ่านได้อย่างเดียว (ระบบเขียนให้อัตโนมัติ)
create policy history_read on public.task_history for select to authenticated using (public.is_active_user());

-- แจ้งเตือน: เห็นเฉพาะของตัวเอง และแก้ได้แค่ "อ่านแล้ว"
create policy notif_read on public.notifications
  for select to authenticated using (user_id = auth.uid() and public.is_active_user());
create policy notif_mark on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- สิทธิ์ระดับตาราง
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.task_history from authenticated;
revoke insert, delete, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant usage on schema public to supabase_auth_admin;
grant select on public.allowed_emails to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;

-- =====================================================================
-- ที่เก็บรูป (Storage)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-images', 'task-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy tt_images_read on storage.objects
  for select to authenticated using (bucket_id = 'task-images' and public.is_active_user());
create policy tt_images_upload on storage.objects
  for insert to authenticated with check (bucket_id = 'task-images' and public.is_active_user());
create policy tt_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'task-images' and public.is_active_user());

-- =====================================================================
-- ข้อมูลเริ่มต้น
-- =====================================================================
insert into public.allowed_emails (email, full_name, role)
values ('snowgirl.jp@gmail.com', 'Admin', 'admin')
on conflict (email) do nothing;

insert into public.categories (name)
values ('ไฟฟ้า'), ('IT'), ('อาคาร'), ('ประปา')
on conflict (name) do nothing;
