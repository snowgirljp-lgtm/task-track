import { createClient } from "./supabase/server";

export type ImageKind = "problem" | "solution";
export type TaskImage = { id: string; storage_path: string; url: string; kind: ImageKind };

/** ดึงรูปของงานพร้อมลิงก์ชั่วคราว (1 ชั่วโมง) — ส่ง kind เพื่อเลือกเฉพาะชนิด */
export async function loadTaskImages(taskId: string, kind?: ImageKind): Promise<TaskImage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("task_images").select("*").eq("task_id", taskId).order("sort");
  // แถวเก่าที่ยังไม่มีคอลัมน์ kind ถือเป็นรูปตอนแจ้งปัญหา
  const rows = (data ?? [])
    .map((r: any) => ({ id: r.id as string, storage_path: r.storage_path as string, kind: (r.kind ?? "problem") as ImageKind }))
    .filter((r) => !kind || r.kind === kind);
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage
    .from("task-images")
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? "" }));
}
