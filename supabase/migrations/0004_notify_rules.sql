-- =====================================================================
-- Task Track — กติกาแจ้งเตือน
--   Admin                     : เฉพาะงาน "รอตรวจ"
--   ผู้แจ้งปัญหา / ผู้แก้ปัญหา : เฉพาะงานใหม่ ("รอดำเนินการ") และงาน "แก้ไขใหม่"
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (ต่อจาก 0003)
-- =====================================================================

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

    -- งานใหม่ (รอดำเนินการ): แจ้งผู้แจ้งปัญหาและผู้แก้ปัญหาทุกคน
    insert into public.notifications (user_id, task_id, kind, message)
    select p.id, new.id, 'new', 'งานใหม่: ' || new.title
    from public.profiles p
    where p.is_active and p.role <> 'admin' and p.id is distinct from v_actor;
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

    if new.status = 'review' then
      -- รอตรวจ: แจ้ง Admin
      insert into public.notifications (user_id, task_id, kind, message)
      select p.id, new.id, 'review', 'รอตรวจ: ' || new.title
      from public.profiles p
      where p.is_active and p.role = 'admin' and p.id is distinct from v_actor;

    elsif new.status = 'redo' then
      -- แก้ไขใหม่: งานกลับมารอคนรับ แจ้งผู้แจ้งปัญหาและผู้แก้ปัญหาทุกคน
      insert into public.notifications (user_id, task_id, kind, message)
      select p.id, new.id, 'redo', 'ส่งกลับแก้ไขใหม่: ' || new.title
      from public.profiles p
      where p.is_active and p.role <> 'admin' and p.id is distinct from v_actor;
    end if;

  elsif v_changes is not null then
    insert into public.task_history (task_id, actor_id, action, changes)
    values (new.id, v_actor, 'edited', v_changes);
  end if;
  return new;
end $$;

-- แจ้งเตือนเก่าที่ไม่เข้ากติกาใหม่ — ทำเครื่องหมายว่าอ่านแล้ว (ไม่ลบ)
update public.notifications n
   set read_at = now()
  from public.profiles p
 where p.id = n.user_id
   and n.read_at is null
   and (
     (p.role = 'admin' and n.kind <> 'review')
     or (p.role <> 'admin' and n.kind not in ('new', 'redo'))
   );
