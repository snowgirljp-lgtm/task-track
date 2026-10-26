import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/labels";
import { Back } from "@/components/icons";

// สีตัวอักษรเฉพาะ 2 ประเภทที่ต้องเห็นชัด
const COLOR: Record<string, string> = { redo: "text-[#C2410C]", new: "text-brand", approval: "text-brand", rejected: "text-[#C2410C]" };
const LABEL: Record<string, string> = {
  approval: "คำขอรออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  new: "งานใหม่",
  in_progress: "มีคนรับงาน",
  review: "รอตรวจ",
  redo: "แก้ไขใหม่",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

async function markAllRead() {
  "use server";
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, message, read_at, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="ย้อนกลับ" className="w-11 h-11 rounded-xl flex items-center justify-center -ml-2"><Back /></Link>
          <h1 className="text-2xl font-bold">แจ้งเตือน</h1>
          {unread > 0 && <span className="text-[13px] font-bold px-2.5 py-0.5 rounded-[10px] bg-danger text-white">ใหม่ {unread}</span>}
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <button type="submit" className="min-h-10 px-2 text-sm font-semibold text-brand">อ่านทั้งหมด</button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-muted">ยังไม่มีแจ้งเตือน</div>
      ) : (
        <div className="card overflow-hidden">
          {items.map((n) => {
            const isUnread = !n.read_at;
            const [, ...rest] = n.message.split(": ");
            const title = rest.join(": ") || n.message;
            return (
              <Link
                key={n.id}
                href={`/notifications/open?id=${n.id}`}
                className={`flex flex-col gap-0.5 px-5 py-3.5 border-b border-line last:border-b-0 ${isUnread ? "bg-white" : "bg-canvas"}`}
              >
                <div className="flex justify-between gap-2">
                  <span className={`text-sm font-bold ${COLOR[n.kind] ?? "text-muted"}`}>{LABEL[n.kind] ?? n.kind}</span>
                  <span className="text-xs text-muted">{fmtDateTime(n.created_at)}</span>
                </div>
                <span className={`text-[15px] leading-snug ${isUnread ? "font-bold" : ""} ${COLOR[n.kind] ?? ""}`}>{title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
