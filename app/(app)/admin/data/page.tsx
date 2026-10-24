import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadMasterData } from "@/lib/masterData";
import type { Profile, Role } from "@/lib/types";
import { CategoryPanel, CompanyPanel, DepartmentPanel, UserPanel } from "./panels";

export default async function AdminDataPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ companies, projects, categories, departments }, { data: profiles }, { data: invites }, { data: tasks }] = await Promise.all([
    loadMasterData(),
    supabase.from("profiles").select("id, email, full_name, role, is_active, department_id").order("full_name"),
    supabase.from("allowed_emails").select("email, full_name, role, department_id").order("created_at"),
    supabase.from("tasks").select("company_id, project_id, category_id, department_id"),
  ]);

  const count = (key: "company_id" | "project_id" | "category_id" | "department_id") => {
    const m: Record<string, number> = {};
    for (const t of tasks ?? []) m[t[key]] = (m[t[key]] ?? 0) + 1;
    return m;
  };

  const registered = new Set((profiles ?? []).map((p) => p.email));
  const pending = (invites ?? []).filter((i) => !registered.has(i.email)) as { email: string; full_name: string; role: Role; department_id: string | null }[];
  const userCount: Record<string, number> = {};
  for (const p of profiles ?? []) if (p.department_id) userCount[p.department_id] = (userCount[p.department_id] ?? 0) + 1;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">จัดการข้อมูล</h1>
      <UserPanel meId={me.id} users={(profiles ?? []) as Profile[]} pending={pending} departments={departments} />
      <DepartmentPanel departments={departments} taskCounts={count("department_id")} userCounts={userCount} />
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <CompanyPanel companies={companies} projects={projects} companyCount={count("company_id")} projectCount={count("project_id")} />
        <CategoryPanel categories={categories} counts={count("category_id")} />
      </div>
    </div>
  );
}
