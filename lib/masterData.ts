import { createClient } from "./supabase/server";
import type { Named, Project } from "./types";

export async function loadMasterData() {
  const supabase = await createClient();
  const [co, pr, ca] = await Promise.all([
    supabase.from("companies").select("id, name, is_active").order("name"),
    supabase.from("projects").select("id, name, is_active, company_id").order("name"),
    supabase.from("categories").select("id, name, is_active").order("name"),
  ]);
  return {
    companies: (co.data ?? []) as Named[],
    projects: (pr.data ?? []) as Project[],
    categories: (ca.data ?? []) as Named[],
  };
}
