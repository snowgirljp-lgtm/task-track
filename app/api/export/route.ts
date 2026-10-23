import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { loadReport } from "@/lib/report";
import { STATUS, URGENCY, todayTH } from "@/lib/labels";

export const runtime = "nodejs";

const TZ = "Asia/Bangkok";
const dt = (d?: string | null) => (d ? new Date(d).toLocaleString("th-TH", { timeZone: TZ }) : "");

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.is_active || profile.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้น" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const rows = await loadReport({
    range: sp.get("range") ?? "all",
    company: sp.get("company") ?? undefined,
    status: sp.get("status") ?? undefined,
    q: sp.get("q") ?? undefined,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Task Track";
  const ws = wb.addWorksheet("งาน", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "รหัส", key: "code", width: 10 },
    { header: "หัวข้อ", key: "title", width: 32 },
    { header: "รายละเอียด", key: "detail", width: 40 },
    { header: "หมวดหมู่", key: "category", width: 14 },
    { header: "ความเร่งด่วน", key: "urgency", width: 12 },
    { header: "บริษัท", key: "company", width: 20 },
    { header: "โครงการ", key: "project", width: 20 },
    { header: "วันที่ครบกำหนดส่ง", key: "due", width: 18 },
    { header: "สถานะ", key: "status", width: 14 },
    { header: "ผู้แจ้ง", key: "reporter", width: 18 },
    { header: "ผู้รับผิดชอบ", key: "owner", width: 18 },
    { header: "วิธีแก้", key: "solution", width: 40 },
    { header: "หมายเหตุ Admin", key: "note", width: 30 },
    { header: "วันที่แจ้ง", key: "created", width: 20 },
    { header: "อัปเดตล่าสุด", key: "updated", width: 20 },
  ];
  for (const t of rows) {
    ws.addRow({
      code: t.code,
      title: t.title,
      detail: t.detail,
      category: t.category?.name ?? "",
      urgency: URGENCY[t.urgency].label,
      company: t.company?.name ?? "",
      project: t.project?.name ?? "",
      due: t.due_date,
      status: STATUS[t.status].label,
      reporter: t.reporter?.full_name ?? "",
      owner: t.owner?.full_name ?? "",
      solution: t.solution ?? "",
      note: t.status_note ?? "",
      created: dt(t.created_at),
      updated: dt(t.updated_at),
    });
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4FD1" } };
  ws.eachRow((row) => (row.alignment = { vertical: "top", wrapText: true }));

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="task-track-${todayTH()}.xlsx"`,
    },
  });
}
