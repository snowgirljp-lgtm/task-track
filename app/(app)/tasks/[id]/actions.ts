"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/labels";

/** ลบงานถาวร (เฉพาะ Admin) — ลบไฟล์รูปในที่เก็บก่อน แล้วลบงาน (รูป ประวัติ แจ้งเตือน ถูกลบตามอัตโนมัติ) */
export async function deleteTask(taskId: string): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: imgs } = await supabase.from("task_images").select("storage_path").eq("task_id", taskId);
  const paths = (imgs ?? []).map((i) => i.storage_path);

  const { data: deleted, error } = await supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error) return { error: friendlyError(error.message) };
  if (!deleted?.length) return { error: "ลบงานไม่สำเร็จ (อาจยังไม่ได้รัน SQL ไฟล์ 0006 หรือไม่มีสิทธิ์)" };

  if (paths.length) await supabase.storage.from("task-images").remove(paths);

  revalidatePath("/", "layout");
  return {};
}
