import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTaskImages } from "@/lib/images";
import { FIELD, STATUS, URGENCY, fmtDate, fmtDateTime, isOverdue } from "@/lib/labels";
import type { Status, Urgency } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import TaskActions from "@/components/TaskActions";
import { Back } from "@/components/icons";

type History = {
  id: number;
  action: string;
  from_status: Status | null;
  to_status: Status | null;
  note: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
};

function describe(h: History) {
  if (h.action === "created") return "แจ้งปัญหาใหม่";
  if (h.action === "status" && h.to_status) {
    const base = h.to_status === "in_progress" ? "รับงาน เปลี่ยนเป็น กำลังทำ" : `เปลี่ยนเป็น ${STATUS[h.to_status].label}`;
    return h.note ? `${base} — เหตุผล: ${h.note}` : base;
  }
  const fields = Object.keys(h.changes ?? {}).map((k) => FIELD[k] ?? k);
  return `แก้ไข ${fields.join(", ")}`;
}

const DOT: Record<string, string> = {
  created: "bg-[#6B7280]",
  edited: "bg-[#9AA3B2]",
  in_progress: "bg-brand",
  review: "bg-[#B7791F]",
  redo: "bg-[#C2410C]",
  done: "bg-[#17663A]",
  cancelled: "bg-[#6B7280]",
};

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, code, title, detail, status, status_note, solution, urgency, due_date, created_at, company:companies(name), project:projects(name), category:categories(name), owner:profiles!tasks_owner_id_fkey(full_name), reporter:profiles!tasks_reporter_id_fkey(full_name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!task) notFound();

  const t = task as any;
  const status = t.status as Status;
  const urgency = t.urgency as Urgency;
  const isAdmin = profile.role === "admin";
  const closed = status === "done" || status === "cancelled";

  const [images, { data: history }] = await Promise.all([
    loadTaskImages(id),
    supabase
      .from("task_history")
      .select("id, action, from_status, to_status, note, changes, created_at, actor:profiles(full_name)")
      .eq("task_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const showRedoReason = t.status_note && (status === "redo" || status === "in_progress");
  const late = isOverdue(t.due_date, status);

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="ย้อนกลับ" className="w-11 h-11 rounded-xl flex items-center justify-center -ml-2"><Back /></Link>
          <h1 className="text-lg font-bold">งาน {t.code}</h1>
        </div>
        <div className="flex gap-2">
          {isAdmin && <Link href={`/tasks/${id}/print`} className="btn btn-ghost text-sm min-h-10">PDF</Link>}
          {(!closed || isAdmin) && <Link href={`/tasks/${id}/edit`} className="btn btn-ghost text-sm min-h-10">แก้ไข</Link>}
        </div>
      </div>

      <section className="card p-4 flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status={status} />
          <span className={`text-[13px] font-semibold px-2.5 py-0.5 rounded-[10px] bg-[#F4F6FA] ${URGENCY[urgency].cls}`}>ด่วน: {URGENCY[urgency].label}</span>
          {late && <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-[10px] bg-[#FDE4E2] text-danger">เลยกำหนด</span>}
        </div>
        <h2 className="text-xl font-bold leading-snug">{t.title}</h2>
        <p className="text-[15px] leading-relaxed text-[#2E3A4D] whitespace-pre-line">{t.detail}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm border-t border-[#EEF1F5] pt-3">
          {[
            ["บริษัท", t.company?.name],
            ["โครงการ", t.project?.name],
            ["หมวดหมู่", t.category?.name],
            ["วันที่ครบกำหนดส่ง", fmtDate(t.due_date)],
            ["ผู้รับผิดชอบ", t.owner?.full_name ?? "ยังไม่มีผู้รับ"],
            ["ผู้แจ้ง", `${t.reporter?.full_name ?? "-"} · ${fmtDateTime(t.created_at)}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {images.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {images.map((img, i) => (
              <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="aspect-square rounded-[10px] overflow-hidden bg-[#C9D6EA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`รูปที่ ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </section>

      {showRedoReason && (
        <div className="rounded-[14px] bg-[#FFE9DF] border border-[#F5C3AC] px-4 py-3.5 flex flex-col gap-1">
          <span className="text-sm font-bold text-[#9A360A]">Admin ส่งกลับให้แก้ไขใหม่</span>
          <span className="text-sm text-[#5C2408] leading-relaxed">เหตุผล: {t.status_note}</span>
        </div>
      )}
      {status === "cancelled" && t.status_note && (
        <div className="rounded-[14px] bg-[#EEF1F5] px-4 py-3.5 text-sm">เหตุผลที่ยกเลิก: {t.status_note}</div>
      )}

      <TaskActions taskId={id} status={status} solution={t.solution ?? ""} isAdmin={isAdmin} />

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="text-base font-bold">ประวัติ</h3>
        {((history ?? []) as unknown as History[]).map((h) => (
          <div key={h.id} className="flex gap-3">
            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${DOT[h.action === "status" ? h.to_status ?? "" : h.action] ?? "bg-[#9AA3B2]"}`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-relaxed">{describe(h)}</span>
              <span className="text-xs text-muted">{h.actor?.full_name ?? "ระบบ"} · {fmtDateTime(h.created_at)}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
