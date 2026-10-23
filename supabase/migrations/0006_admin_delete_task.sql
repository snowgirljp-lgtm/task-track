-- =====================================================================
-- Task Track — ให้ Admin ลบงานได้ (ลบถาวร พร้อมรูป ประวัติ และแจ้งเตือนของงานนั้น)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (ต่อจาก 0005)
-- =====================================================================

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.is_admin());
