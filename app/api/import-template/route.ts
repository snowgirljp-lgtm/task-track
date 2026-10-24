import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/** ไฟล์ตัวอย่างสำหรับนำเข้าบริษัทและโครงการ */
export async function GET() {
  const profile = await getProfile();
  if (!profile || !profile.is_active || profile.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้น" }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("บริษัทและโครงการ", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "บริษัท", key: "company", width: 32 },
    { header: "โครงการ", key: "project", width: 32 },
  ];
  ws.addRows([
    { company: "[ชื่อบริษัท A]", project: "[ชื่อโครงการ A1]" },
    { company: "[ชื่อบริษัท A]", project: "[ชื่อโครงการ A2]" },
    { company: "[ชื่อบริษัท B]", project: "[ชื่อโครงการ B1]" },
  ]);
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4FD1" } };

  const note = wb.addWorksheet("วิธีใช้");
  note.getColumn(1).width = 90;
  [
    "วิธีกรอก",
    "1 แถว = 1 โครงการ ถ้าบริษัทมีหลายโครงการ ให้พิมพ์ชื่อบริษัทซ้ำในแต่ละแถว",
    "ลบแถวตัวอย่างในแผ่นงานแรกออก แล้วกรอกข้อมูลจริงแทน",
    "บริษัท/โครงการที่มีในระบบแล้วจะถูกข้าม ไม่สร้างซ้ำ (เทียบชื่อแบบไม่สนตัวพิมพ์เล็ก-ใหญ่)",
    "ถ้าใส่แค่ชื่อบริษัท ไม่มีโครงการ ระบบจะเพิ่มเฉพาะบริษัท",
  ].forEach((t, i) => {
    const c = note.getCell(i + 1, 1);
    c.value = t;
    if (i === 0) c.font = { bold: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="task-track-import-template.xlsx"`,
    },
  });
}
