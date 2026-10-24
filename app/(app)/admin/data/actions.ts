"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/labels";
import type { Role } from "@/lib/types";

export type Result = { error?: string };

async function run(fn: (db: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: { message: string } | null }>): Promise<Result> {
  await requireAdmin();
  const db = await createClient();
  const { error } = await fn(db);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/admin/data");
  return {};
}

const ROLES: Role[] = ["reporter", "resolver", "admin"];
const clean = (s: string) => s.trim().replace(/\s+/g, " ");

// ---------- ผู้ใช้ ----------
export async function inviteUser(email: string, fullName: string, role: Role, departmentId: string | null): Promise<Result> {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (!clean(fullName)) return { error: "กรุณาใส่ชื่อ" };
  if (!ROLES.includes(role)) return { error: "บทบาทไม่ถูกต้อง" };
  const db = await createClient();
  const { data: exists } = await db.from("profiles").select("id").eq("email", e).maybeSingle();
  if (exists) return { error: "อีเมลนี้มีบัญชีอยู่แล้ว" };
  return run((d) => d.from("allowed_emails").insert({ email: e, full_name: clean(fullName), role, department_id: departmentId || null }));
}

export async function removeInvite(email: string): Promise<Result> {
  return run((d) => d.from("allowed_emails").delete().eq("email", email));
}

export async function setUserRole(id: string, role: Role): Promise<Result> {
  if (!ROLES.includes(role)) return { error: "บทบาทไม่ถูกต้อง" };
  return run((d) => d.from("profiles").update({ role }).eq("id", id));
}

export async function setUserDepartment(id: string, departmentId: string | null): Promise<Result> {
  return run((d) => d.from("profiles").update({ department_id: departmentId || null }).eq("id", id));
}

export async function setInviteDepartment(email: string, departmentId: string | null): Promise<Result> {
  return run((d) => d.from("allowed_emails").update({ department_id: departmentId || null }).eq("email", email));
}

export async function setUserActive(id: string, active: boolean): Promise<Result> {
  return run((d) => d.from("profiles").update({ is_active: active }).eq("id", id));
}

// ---------- บริษัท / โครงการ / หมวดหมู่ ----------
type Table = "companies" | "projects" | "categories" | "departments";

export async function addItem(table: Table, name: string, companyId?: string): Promise<Result> {
  const n = clean(name);
  if (!n) return { error: "กรุณาใส่ชื่อ" };
  if (table === "projects" && !companyId) return { error: "ไม่พบบริษัท" };
  const row = table === "projects" ? { name: n, company_id: companyId } : { name: n };
  return run((d) => d.from(table).insert(row));
}

export async function renameItem(table: Table, id: string, name: string): Promise<Result> {
  const n = clean(name);
  if (!n) return { error: "กรุณาใส่ชื่อ" };
  return run((d) => d.from(table).update({ name: n }).eq("id", id));
}

export async function setItemActive(table: Table, id: string, active: boolean): Promise<Result> {
  return run((d) => d.from(table).update({ is_active: active }).eq("id", id));
}
