import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RANGES, loadReport } from "@/lib/report";
import { STATUS, STATUS_ORDER, URGENCY, fmtDate, fmtDateTime } from "@/lib/labels";
import AutoPrint from "@/components/AutoPrint";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; company?: string; department?: string }>;
}) {
  await requireAdmin();
  const { range = "month", company = "", department = "" } = await searchParams;
  const supabase = await createClient();
  const rows = await loadReport({ range, company, department });
  const { data: dep } = department
    ? await supabase.from("departments").select("name").eq("id", department).maybeSingle()
    : { data: null };
  const { data: co } = company
    ? await supabase.from("companies").select("name").eq("id", company).maybeSingle()
    : { data: null };

  return (
    <article className="flex flex-col gap-5 bg-white p-6 print:p-0">
      <div className="flex items-start justify-between gap-4 border-b-2 border-brand pb-3">
        <div>
          <div className="text-sm text-muted">Task Track · รายงานสรุป</div>
          <h1 className="text-2xl font-bold">
            {RANGES[range] ?? RANGES.month} · {co?.name ?? "ทุกบริษัท"} · {dep?.name ?? "ทุกแผนก"}
          </h1>
          <div className="text-xs text-muted">พิมพ์เมื่อ {fmtDateTime(new Date().toISOString())}</div>
        </div>
        <AutoPrint />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="border border-line rounded-lg p-2.5">
            <div className="text-xs text-muted">{STATUS[s].label}</div>
            <div className="text-2xl font-bold">{rows.filter((t) => t.status === s).length}</div>
          </div>
        ))}
      </div>

      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="text-left bg-[#F4F6FA]">
            {["รหัส", "หัวข้อ", "แผนก", "บริษัท", "โครงการ", "หมวดหมู่", "ประเภทบิล", "เลขที่เอกสาร", "ด่วน", "ครบกำหนดส่ง", "สถานะ", "ผู้รับผิดชอบ"].map((h) => (
              <th key={h} className="py-1.5 px-1.5 font-semibold border-b border-line">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-[#EEF1F5] break-inside-avoid">
              <td className="py-1.5 px-1.5 whitespace-nowrap">{t.code}</td>
              <td className="py-1.5 px-1.5">{t.title}</td>
              <td className="py-1.5 px-1.5">{t.department?.name ?? "-"}</td>
              <td className="py-1.5 px-1.5">{t.company?.name}</td>
              <td className="py-1.5 px-1.5">{t.project?.name}</td>
              <td className="py-1.5 px-1.5">{t.category?.name}</td>
              <td className="py-1.5 px-1.5">{t.bill_type?.name ?? "-"}</td>
              <td className="py-1.5 px-1.5">{t.doc_no ?? "-"}</td>
              <td className="py-1.5 px-1.5">{URGENCY[t.urgency].label}</td>
              <td className="py-1.5 px-1.5 whitespace-nowrap">{fmtDate(t.due_date)}</td>
              <td className="py-1.5 px-1.5 whitespace-nowrap">{STATUS[t.status].label}</td>
              <td className="py-1.5 px-1.5">{t.owner?.full_name ?? "-"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={12} className="py-3 text-muted">ไม่มีงานในช่วงนี้</td></tr>
          )}
        </tbody>
      </table>
    </article>
  );
}
