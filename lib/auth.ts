import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile) ?? null;
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
