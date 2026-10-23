-- =====================================================================
-- Task Track — รูปหลังแก้ (ประกอบวิธีแก้)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันครั้งเดียว ต่อจาก 0001)
-- =====================================================================

-- แยกรูปเป็น 2 ชนิด: problem = รูปตอนแจ้งปัญหา, solution = รูปหลังแก้
alter table public.task_images
  add column if not exists kind text not null default 'problem'
  check (kind in ('problem', 'solution'));

-- จำกัดไม่เกิน 5 รูป แยกตามชนิด
create or replace function public.task_images_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.task_images where task_id = new.task_id and kind = new.kind) >= 5 then
    raise exception 'แนบรูปได้สูงสุด 5 รูป';
  end if;
  return new;
end $$;

-- กติกาสถานะ: เพิ่มเงื่อนไข "ต้องมีรูปหลังแก้อย่างน้อย 1 รูป" ก่อนส่งตรวจ
create or replace function public.tasks_before_update()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_admin boolean := public.is_admin();
  v_from  public.task_status := old.status;
  v_to    public.task_status := new.status;
  v_note  text := nullif(btrim(coalesce(new.status_note, '')), '');
begin
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
      new.owner_id := auth.uid();

    elsif v_from = 'in_progress' and v_to = 'review' then
      if coalesce(btrim(new.solution), '') = '' then
        raise exception 'กรุณากรอกวิธีแก้ก่อนส่งตรวจ';
      end if;
      if not exists (select 1 from public.task_images where task_id = new.id and kind = 'solution') then
        raise exception 'กรุณาแนบรูปหลังแก้อย่างน้อย 1 รูป';
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
