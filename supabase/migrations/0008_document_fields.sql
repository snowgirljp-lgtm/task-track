-- =====================================================================
-- Task Track — ข้อมูลเอกสารในงาน
--   วันที่เอกสาร/วันที่เกิดเหตุ, เลขที่เอกสาร, เลขที่ PO, จำนวนเงิน
--   (หมวดหมู่ ใช้เป็น "ประเภทบิล" — ตารางเดิม Admin จัดการรายการได้เหมือนเดิม)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (ต่อจาก 0007)
-- =====================================================================

alter table public.tasks add column if not exists doc_date date;
alter table public.tasks add column if not exists doc_no   text;
alter table public.tasks add column if not exists po_no    text;
alter table public.tasks add column if not exists amount   numeric(14, 2) check (amount is null or amount >= 0);
create index if not exists tasks_doc_no_idx on public.tasks (doc_no);
create index if not exists tasks_po_no_idx  on public.tasks (po_no);

-- บันทึกประวัติเมื่อแก้ช่องใหม่ด้วย
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
   where o.key in ('title', 'detail', 'category_id', 'urgency', 'company_id', 'project_id', 'due_date', 'solution', 'department_id', 'doc_date', 'doc_no', 'po_no', 'amount')
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
