import { createClient } from "./supabase/server";
import { STATUS, todayTH } from "./labels";
import type { Status, Urgency } from "./types";

export type Filters = { range?: string; company?: string; department?: string; status?: string; q?: string };

export type ReportRow = {
  id: string;
  code: string;
  title: string;
  detail: string;
  status: Status;
  status_note: string | null;
  solution: string | null;
  urgency: Urgency;
  due_date: string;
  created_at: string;
  updated_at: string;
  company_id: string;
  company: { name: string } | null;
  project: { name: string } | null;
  category: { name: string } | null;
  department: { name: string } | null;
  owner: { full_name: string } | null;
  reporter: { full_name: string } | null;
};

export const RANGES: Record<string, string> = {
  month: "เดือนนี้",
  week: "7 วันล่าสุด",
  all: "ทั้งหมด",
};

export function rangeStart(range?: string) {
  if (range === "week") return new Date(Date.now() - 7 * 86400000).toISOString();
  if (range === "all") return null;
  return `${todayTH().slice(0, 7)}-01T00:00:00+07:00`; // ค่าเริ่มต้น = เดือนนี้
}

export async function loadReport(f: Filters): Promise<ReportRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(
      "id, code, title, detail, status, status_note, solution, urgency, due_date, created_at, updated_at, company_id, company:companies(name), project:projects(name), category:categories(name), department:departments(name), owner:profiles!tasks_owner_id_fkey(full_name), reporter:profiles!tasks_reporter_id_fkey(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  const start = rangeStart(f.range);
  if (start) query = query.gte("created_at", start);
  if (f.company) query = query.eq("company_id", f.company);
  if (f.department) query = query.eq("department_id", f.department);
  if (f.status && f.status in STATUS) query = query.eq("status", f.status);

  const { data } = await query;
  const rows = (data ?? []) as unknown as ReportRow[];
  const term = f.q?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((t) =>
    [t.title, t.code, t.company?.name, t.project?.name, t.category?.name, t.department?.name].some((v) => v?.toLowerCase().includes(term))
  );
}
