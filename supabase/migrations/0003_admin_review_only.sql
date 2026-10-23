-- =====================================================================
-- Task Track — Admin รับแจ้งเตือนเฉพาะงาน "รอตรวจ"
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันครั้งเดียว ต่อจาก 0002)
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

    -- งานใหม่: แจ้งทุกคนยกเว้น Admin
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

    v_msg := case new.status
               when 'in_progress' then 'มีคนรับงาน: '
               when 'review'      then 'รอตรวจ: '
               when 'redo'        then 'ส่งกลับแก้ไขใหม่: '
               when 'done'        then 'เสร็จแล้ว: '
               when 'cancelled'   then 'ยกเลิก: '
               else 'อัปเดต: '
             end || new.title;

    -- ผู้แจ้ง/ผู้รับผิดชอบ: ได้ทุกการเปลี่ยนสถานะ (ถ้าไม่ใช่ Admin)
    -- Admin: ได้เฉพาะเมื่องานเข้าสถานะ "รอตรวจ"
    insert into public.notifications (user_id, task_id, kind, message)
    select p.id, new.id, new.status::text, v_msg
    from public.profiles p
    where p.is_active
      and p.id is distinct from v_actor
      and (
        (p.role = 'admin' and new.status = 'review')
        or (p.role <> 'admin' and (p.id = new.reporter_id or p.id = new.owner_id))
      );

  elsif v_changes is not null then
    insert into public.task_history (task_id, actor_id, action, changes)
    values (new.id, v_actor, 'edited', v_changes);
  end if;
  return new;
end $$;

-- แจ้งเตือนเก่าของ Admin ที่ไม่ใช่ "รอตรวจ" — ทำเครื่องหมายว่าอ่านแล้ว (ไม่ลบ)
update public.notifications n
   set read_at = now()
  from public.profiles p
 where p.id = n.user_id
   and p.role = 'admin'
   and n.kind <> 'review'
   and n.read_at is null;
