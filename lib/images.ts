import { createClient } from "./supabase/server";

export type TaskImage = { id: string; storage_path: string; url: string };

/** ดึงรูปของงานพร้อมลิงก์ชั่วคราว (1 ชั่วโมง) */
export async function loadTaskImages(taskId: string): Promise<TaskImage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_images")
    .select("id, storage_path")
    .eq("task_id", taskId)
    .order("sort");
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage
    .from("task-images")
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  return rows.map((r, i) => ({ id: r.id, storage_path: r.storage_path, url: signed?.[i]?.signedUrl ?? "" }));
}
