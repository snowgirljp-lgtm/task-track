-- =====================================================================
-- Task Track — ประเภทบิล (แยกจากหมวดหมู่ / Admin จัดการรายการได้)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (ต่อจาก 0008)
-- =====================================================================

create table if not exists public.bill_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (btrim(name) <> ''),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.bill_types enable row level security;
grant select, insert, update on public.bill_types to authenticated;

drop policy if exists bill_types_read on public.bill_types;
drop policy if exists bill_types_add  on public.bill_types;
drop policy if exists bill_types_edit on public.bill_types;
create policy bill_types_read on public.bill_types for select to authenticated using (public.is_active_user());
create policy bill_types_add  on public.bill_types for insert to authenticated with check (public.is_admin());
create policy bill_types_edit on public.bill_types for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.tasks add column if not exists bill_type_id uuid references public.bill_types (id);

-- ประวัติ: บันทึกเมื่อเปลี่ยนประเภทบิลด้วย
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
   where o.key in ('title', 'detail', 'category_id', 'urgency', 'company_id', 'project_id', 'due_date', 'solution', 'department_id', 'doc_date', 'doc_no', 'po_no', 'amount', 'bill_type_id')
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
