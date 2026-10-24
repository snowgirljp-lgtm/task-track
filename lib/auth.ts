import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // middleware ตรวจสอบตัวตนกับ Supabase แล้วในทุกคำขอ ที่นี่จึงอ่านจาก cookie ได้เลย (ไม่ต้องถามซ้ำ)
  // ฐานข้อมูลยังตรวจ token เองทุกครั้งผ่าน RLS จึงปลอดภัย
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  const [{ data }, { data: deps }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_departments").select("department_id").eq("user_id", userId),
  ]);
  if (!data) return null;
  return { ...(data as Profile), department_ids: (deps ?? []).map((d) => d.department_id as string) };
});

export async function requireProfile() {
  const p = await getProfile();
  if (!p) redirect("/auth/signout?error=not_allowed");
  if (!p.is_active) redirect("/auth/signout?error=suspended");
  return p;
}

export async function requireAdmin() {
  const p = await requireProfile();
  if (p.role !== "admin") redirect("/");
  return p;
}
