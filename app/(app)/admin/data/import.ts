"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/labels";

export type ImportResult = {
  error?: string;
  rows?: number;
  companiesAdded?: number;
  projectsAdded?: number;
  skipped?: number;
  problems?: string[];
};

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const key = (s: string) => s.toLowerCase();

/**
 * นำเข้าบริษัทและโครงการจากไฟล์ Excel
 * คอลัมน์: "บริษัท" และ "โครงการ" (1 แถว = 1 โครงการ, ชื่อบริษัทซ้ำได้)
 * ข้อมูลที่มีอยู่แล้วจะถูกข้าม ไม่สร้างซ้ำ
 */
export async function importCompaniesProjects(formData: FormData): Promise<ImportResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์ Excel" };
  if (!/\.xlsx$/i.test(file.name)) return { error: "รองรับเฉพาะไฟล์ .xlsx" };
  if (file.size > 5 * 1024 * 1024) return { error: "ไฟล์ใหญ่เกิน 5 MB" };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "อ่านไฟล์ไม่ได้ กรุณาบันทึกเป็น .xlsx แล้วลองใหม่" };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "ไม่พบแผ่นงานในไฟล์" };

  // หาแถวหัวตาราง (ภายใน 10 แถวแรก) ถ้าไม่เจอ ใช้คอลัมน์ A = บริษัท, B = โครงการ
  let headerRow = 0;
  let coCol = 1;
  let prCol = 2;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    let c = 0;
    let p = 0;
    row.eachCell((cell, col) => {
      const t = clean(cell.text);
      if (/บริษัท|company/i.test(t)) c = col;
      if (/โครงการ|project/i.test(t)) p = col;
    });
    if (c && p) {
      headerRow = r;
      coCol = c;
      prCol = p;
      break;
    }
  }

  const pairs: { company: string; project: string }[] = [];
  const problems: string[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const company = clean(row.getCell(coCol).text);
    const project = clean(row.getCell(prCol).text);
    if (!company && !project) continue;
    if (!company) {
      problems.push(`แถว ${r}: ไม่มีชื่อบริษัท`);
      continue;
    }
    pairs.push({ company, project });
  }
  if (pairs.length === 0) return { error: "ไม่พบข้อมูลในไฟล์ (ต้องมีคอลัมน์ บริษัท และ โครงการ)" };
  if (pairs.length > 5000) return { error: "นำเข้าได้ไม่เกิน 5,000 แถวต่อครั้ง" };

  const db = await createClient();

  // บริษัท
  const { data: existingCo, error: e1 } = await db.from("companies").select("id, name");
  if (e1) return { error: friendlyError(e1.message) };
  const coId = new Map<string, string>((existingCo ?? []).map((c) => [key(c.name), c.id as string]));
  const newCompanies = [...new Map(pairs.filter((p) => !coId.has(key(p.company))).map((p) => [key(p.company), p.company])).values()];
  if (newCompanies.length) {
    const { data, error } = await db.from("companies").insert(newCompanies.map((name) => ({ name }))).select("id, name");
    if (error) return { error: friendlyError(error.message) };
    for (const c of data ?? []) coId.set(key(c.name), c.id);
  }

  // โครงการ
  const { data: existingPr, error: e2 } = await db.from("projects").select("company_id, name");
  if (e2) return { error: friendlyError(e2.message) };
  const seen = new Set((existingPr ?? []).map((p) => `${p.company_id}|${key(p.name)}`));
  const newProjects: { company_id: string; name: string }[] = [];
  let skipped = 0;
  for (const p of pairs) {
    if (!p.project) continue;
    const cid = coId.get(key(p.company));
    if (!cid) continue;
    const k = `${cid}|${key(p.project)}`;
    if (seen.has(k)) {
      skipped++;
      continue;
    }
    seen.add(k);
    newProjects.push({ company_id: cid, name: p.project });
  }
  if (newProjects.length) {
    const { error } = await db.from("projects").insert(newProjects);
    if (error) return { error: friendlyError(error.message) };
  }

  revalidatePath("/admin/data");
  return {
    rows: pairs.length,
    companiesAdded: newCompanies.length,
    projectsAdded: newProjects.length,
    skipped,
    problems: problems.slice(0, 20),
  };
}
