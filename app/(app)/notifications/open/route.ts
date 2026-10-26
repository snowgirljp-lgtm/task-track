import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** กดแจ้งเตือน → ทำเครื่องหมายอ่านแล้ว → ไปที่งาน */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  const supabase = await createClient();

  if (!Number.isFinite(id)) return NextResponse.redirect(`${origin}/notifications`);

  const { data } = await supabase.from("notifications").select("task_id, kind").eq("id", id).maybeSingle();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);

  if (data?.task_id) return NextResponse.redirect(`${origin}/tasks/${data.task_id}`);
  if (data?.kind === "approval") return NextResponse.redirect(`${origin}/admin/data#requests`);
  if (data?.kind === "approved") return NextResponse.redirect(`${origin}/tasks/new`);
  return NextResponse.redirect(`${origin}/notifications`);
}
