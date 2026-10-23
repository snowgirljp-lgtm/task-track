import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, SideNav, TopBar } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // ดึงพร้อมกัน — RLS ให้เห็นเฉพาะแจ้งเตือนของตัวเองอยู่แล้ว
  const [profile, { count }] = await Promise.all([
    requireProfile(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const unread = count ?? 0;
  const isAdmin = profile.role === "admin";

  return (
    <div className="flex min-h-dvh">
      <SideNav isAdmin={isAdmin} unread={unread} name={profile.full_name} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar unread={unread} />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-12 print:p-0 print:max-w-none">
          {children}
        </main>
      </div>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
