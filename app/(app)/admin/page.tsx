import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RANGES, loadReport } from "@/lib/report";
import { STATUS, STATUS_ORDER, fmtDate, isOverdue } from "@/lib/labels";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; company?: string }>;
}) {
  await requireAdmin();
  const { range = "month", company = "" } = await searchParams;
  const supabase = await createClient();
  const [{ data: companies }, rows] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    loadReport({ range, company }),
  ]);

  // งานที่ยังเปิดอยู่ทั้งหมด (ไม่จำกัดช่วงเวลา) ใช้สำหรับรายการรอตรวจ/เลยกำหนด
  const open = await loadReport({ range: "all", company });
  const active = open.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const review = active.filter((t) => t.status === "review");
  const late = active.filter((t) => isOverdue(t.due_date, t.status));

  const counts = STATUS_ORDER.map((s) => ({ s, n: rows.filter((t) => t.status === s).length }));
  const byCompany = Object.values(
    active.reduce<Record<string, { name: string; n: number }>>((acc, t) => {
      const k = t.company_id;
      acc[k] ??= { name: t.company?.name ?? "-", n: 0 };
      acc[k].n++;
      return acc;
    }, {})
  ).sort((a, b) => b.n - a.n);
  const maxCo = Math.max(1, ...byCompany.map((c) => c.n));

  const qs = new URLSearchParams({ range, ...(company ? { company } : {}) }).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">ภาพรวม</h1>
          <p className="text-sm text-muted">ตัวเลขตามช่วงเวลาที่แจ้งงาน · รอตรวจและเลยกำหนดแสดงทุกงานที่ยังเปิดอยู่</p>
        </div>
        <form className="flex flex-wrap gap-2" action="/admin">
          <select name="range" defaultValue={range} aria-label="ช่วงเวลา" className="field w-auto min-h-11 py-0">
            {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="company" defaultValue={company} aria-label="บริษัท" className="field w-auto min-h-11 py-0">
            <option value="">ทุกบริษัท</option>
            {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="btn btn-ghost">กรอง</button>
          <a href={`/api/export?${qs}`} className="btn btn-outline">ส่งออก Excel</a>
          <Link href={`/admin/report?${qs}`} className="btn btn-primary">ส่งออก PDF</Link>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {counts.map(({ s, n }) => (
          <Link key={s} href={`/?status=${s}`} className="card p-4 flex flex-col gap-2 hover:border-brand">
            <span className={`self-start text-[13px] font-semibold px-2.5 py-0.5 rounded-[10px] ${STATUS[s].cls}`}>{STATUS[s].label}</span>
            <span className="text-3xl font-bold leading-none">{n}</span>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_1.6fr] gap-4">
        <section className="card p-5 flex flex-col gap-3.5">
          <h2 className="text-lg font-bold">งานค้างแยกตามบริษัท</h2>
          {byCompany.length === 0 && <p className="text-sm text-muted">ไม่มีงานค้าง</p>}
          {byCompany.map((c) => (
            <div key={c.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm"><span>{c.name}</span><span className="font-semibold">{c.n} งาน</span></div>
              <div className="h-2.5 rounded-full bg-[#EEF1F5]">
                <div className="h-2.5 rounded-full bg-brand" style={{ width: `${(c.n / maxCo) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section className="card p-5 flex flex-col gap-3">
          <h2 className="text-lg font-bold">รอ Admin ตรวจ ({review.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted">
                  {["หัวข้อ", "บริษัท", "โครงการ", "ผู้รับผิดชอบ", ""].map((h) => (
                    <th key={h} className="py-2 px-1.5 font-medium border-b border-line">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {review.length === 0 && (
                  <tr><td colSpan={5} className="py-3 px-1.5 text-muted">ไม่มีงานรอตรวจ</td></tr>
                )}
                {review.map((t) => (
                  <tr key={t.id} className="border-b border-[#EEF1F5]">
                    <td className="py-2.5 px-1.5 font-medium">{t.title}</td>
                    <td className="py-2.5 px-1.5 text-muted">{t.company?.name}</td>
                    <td className="py-2.5 px-1.5 text-muted">{t.project?.name}</td>
                    <td className="py-2.5 px-1.5">{t.owner?.full_name ?? "-"}</td>
                    <td className="py-2.5 px-1.5 text-right"><Link href={`/tasks/${t.id}`} className="font-semibold text-brand">ตรวจงาน</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card p-5 flex flex-col gap-1">
        <h2 className="text-lg font-bold text-danger mb-2">เลยกำหนดเสร็จ ({late.length})</h2>
        {late.length === 0 && <p className="text-sm text-muted">ไม่มีงานเลยกำหนด</p>}
        {late.map((t) => (
          <Link key={t.id} href={`/tasks/${t.id}`} className="flex flex-wrap justify-between gap-2 text-sm py-2.5 border-b border-[#EEF1F5] last:border-b-0">
            <span className="font-medium">{t.title}</span>
            <span className="text-muted">{t.company?.name} › {t.project?.name} · กำหนด {fmtDate(t.due_date)} · {STATUS[t.status].label}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
