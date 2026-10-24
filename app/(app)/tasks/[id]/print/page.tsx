import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTaskImages } from "@/lib/images";
import { STATUS, URGENCY, fmtDate, fmtDateTime, fmtMoney } from "@/lib/labels";
import type { Status, Urgency } from "@/lib/types";
import AutoPrint from "@/components/AutoPrint";

export default async function PrintTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      "code, title, detail, status, status_note, solution, urgency, due_date, created_at, updated_at, doc_date, doc_no, po_no, amount, company:companies(name), project:projects(name), category:categories(name), department:departments(name), owner:profiles!tasks_owner_id_fkey(full_name), reporter:profiles!tasks_reporter_id_fkey(full_name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const t = data as any;
  const all = await loadTaskImages(id);
  const images = all.filter((i) => i.kind === "problem");
  const solutionImages = all.filter((i) => i.kind === "solution");

  const rows: [string, string][] = [
    ["สถานะ", STATUS[t.status as Status].label],
    ["ความเร่งด่วน", URGENCY[t.urgency as Urgency].label],
    ["แผนก", t.department?.name ?? "-"],
    ["บริษัท", t.company?.name ?? "-"],
    ["โครงการ", t.project?.name ?? "-"],
    ["วันที่เอกสาร/วันที่เกิดเหตุ", fmtDate(t.doc_date)],
    ["ประเภทบิล", t.category?.name ?? "-"],
    ["เลขที่เอกสาร", t.doc_no || "-"],
    ["เลขที่ PO", t.po_no || "-"],
    ["จำนวนเงิน", fmtMoney(t.amount)],
    ["วันที่ครบกำหนดส่ง", fmtDate(t.due_date)],
    ["ผู้แจ้ง", `${t.reporter?.full_name ?? "-"} (${fmtDateTime(t.created_at)})`],
    ["ผู้รับผิดชอบ", t.owner?.full_name ?? "-"],
    ["อัปเดตล่าสุด", fmtDateTime(t.updated_at)],
  ];

  return (
    <article className="max-w-3xl mx-auto flex flex-col gap-5 bg-white p-6 print:p-0">
      <div className="flex items-start justify-between gap-4 border-b-2 border-brand pb-3">
        <div>
          <div className="text-sm text-muted">Task Track · รายงานงาน</div>
          <h1 className="text-2xl font-bold">{t.code} — {t.title}</h1>
        </div>
        <AutoPrint />
      </div>

      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line">
              <th className="text-left font-medium text-muted py-2 w-40">{k}</th>
              <td className="py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section>
        <h2 className="font-bold mb-1">รายละเอียดปัญหา</h2>
        <p className="whitespace-pre-line leading-relaxed">{t.detail}</p>
      </section>
      <section>
        <h2 className="font-bold mb-1">วิธีแก้</h2>
        <p className="whitespace-pre-line leading-relaxed">{t.solution || "-"}</p>
        {solutionImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {solutionImages.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id} src={img.url} alt={`รูปหลังแก้ ${i + 1}`} className="w-full rounded-lg border border-line break-inside-avoid" />
            ))}
          </div>
        )}
      </section>
      {t.status_note && (
        <section>
          <h2 className="font-bold mb-1">หมายเหตุจาก Admin</h2>
          <p className="whitespace-pre-line leading-relaxed">{t.status_note}</p>
        </section>
      )}

      {images.length > 0 && (
        <section>
          <h2 className="font-bold mb-2">รูปตอนแจ้งปัญหา</h2>
          <div className="grid grid-cols-2 gap-3">
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id} src={img.url} alt={`รูปที่ ${i + 1}`} className="w-full rounded-lg border border-line break-inside-avoid" />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
