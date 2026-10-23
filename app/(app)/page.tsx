import Link from "next/link";
import Form from "next/form";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS, STATUS_ORDER, URGENCY, fmtDate, isOverdue } from "@/lib/labels";
import type { Status, Urgency } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { Chevron, Plus, Search } from "@/components/icons";

type Row = {
  id: string;
  code: string;
  title: string;
  status: Status;
  urgency: Urgency;
  due_date: string;
  company: { name: string } | null;
  project: { name: string } | null;
  category: { name: string } | null;
  owner: { full_name: string } | null;
};

export default async function TaskListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await requireProfile();
  const { q = "", status: statusParam } = await searchParams;
  // ค่าเริ่มต้นเมื่อเปิดหน้า: Admin → รอตรวจ, คนอื่น → รอดำเนินการ ("all" = ทั้งหมด)
  const status = statusParam && (statusParam === "all" || statusParam in STATUS)
    ? statusParam
    : profile.role === "admin" ? "review" : "pending";
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "id, code, title, status, urgency, due_date, company:companies(name), project:projects(name), category:categories(name), owner:profiles!tasks_owner_id_fkey(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (status !== "all") query = query.eq("status", status);

  // ดึงทั้ง 3 อย่างพร้อมกัน
  const [{ data }, { data: latest }, { count: unread }] = await Promise.all([
    query,
    supabase
      .from("notifications")
      .select("message")
      .eq("user_id", profile.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null),
  ]);

  const term = q.trim().toLowerCase();
  const tasks = ((data ?? []) as unknown as Row[]).filter(
    (t) =>
      !term ||
      [t.title, t.code, t.company?.name, t.project?.name, t.category?.name].some((v) => v?.toLowerCase().includes(term))
  );

  const chip = (value: string, label: string) => {
    const on = status === value;
    const params = new URLSearchParams();
    params.set("status", value);
    if (q) params.set("q", q);
    return (
      <Link
        key={value}
        href={`/?${params.toString()}`}
        className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-medium flex items-center border ${on ? "bg-brand text-white border-brand" : "bg-white text-ink border-field"}`}
      >
        {label}
      </Link>
    );
  };

  const exportHref = `/api/export?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(q ? { q } : {}) }).toString()}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold">รายการงาน</h1>
        <div className="flex gap-2">
          {profile.role === "admin" && (
            <a href={exportHref} className="btn btn-outline">ส่งออก Excel</a>
          )}
          <Link href="/tasks/new" className="btn btn-primary hidden md:inline-flex">
            <Plus size={20} /> แจ้งปัญหา
          </Link>
        </div>
      </div>

      {(unread ?? 0) > 0 && (
        <Link href="/notifications" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#FFF1E8] border border-[#F8C9A8] text-[#7C2D06]">
          <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-danger" />
          <span className="flex-1 text-sm leading-relaxed">
            <b>แจ้งเตือนใหม่ {unread} รายการ</b>
            {latest?.[0] && <> · {latest[0].message}</>}
          </span>
          <Chevron size={18} />
        </Link>
      )}

      <Form data-nav-form="true" className="flex items-center gap-2 h-11 rounded-xl bg-white border border-line px-3" action="/">
        <Search size={18} color="#4B5768" />
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาหัวข้อ, รหัสงาน, บริษัท, โครงการ"
          aria-label="ค้นหางาน"
          className="flex-1 bg-transparent outline-none text-[15px]"
        />
      </Form>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {chip("all", "ทั้งหมด")}
        {STATUS_ORDER.map((s) => chip(s, STATUS[s].label))}
      </div>

      {tasks.length === 0 ? (
        <div className="card p-8 text-center text-muted">ไม่พบงาน</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tasks.map((t) => {
            const late = isOverdue(t.due_date, t.status);
            return (
              <Link key={t.id} href={`/tasks/${t.id}`} className="card px-4 py-3.5 flex flex-col gap-2 hover:border-brand">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={t.status} />
                  <span className={`text-[13px] font-semibold ${URGENCY[t.urgency].cls}`}>ด่วน: {URGENCY[t.urgency].label}</span>
                </div>
                <div className="text-base font-semibold leading-snug">{t.title}</div>
                <div className="text-[13px] text-muted">
                  {t.company?.name} › {t.project?.name} · {t.category?.name}
                </div>
                <div className="flex justify-between text-[13px] text-muted border-t border-[#EEF1F5] pt-2">
                  <span className={late ? "text-danger font-semibold" : ""}>
                    {late ? "เลยกำหนดส่ง " : "ครบกำหนดส่ง "}
                    {fmtDate(t.due_date)}
                  </span>
                  <span>{t.owner?.full_name ?? "ยังไม่มีผู้รับ"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Link
        href="/tasks/new"
        className="md:hidden fixed right-4 bottom-[84px] z-10 h-[52px] px-5 rounded-full bg-brand text-white font-semibold flex items-center gap-2 shadow-lg"
      >
        <Plus size={20} /> แจ้งปัญหา
      </Link>
    </div>
  );
}
