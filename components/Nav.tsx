"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Chart, Gear, List, Logo, PlusCircle, User } from "./icons";

type Props = { isAdmin: boolean; unread: number; name: string };

function useActive() {
  const path = usePathname();
  return (href: string) => {
    if (href === "/") return path === "/" || (path.startsWith("/tasks/") && !path.startsWith("/tasks/new"));
    if (href === "/admin") return path === "/admin" || path.startsWith("/admin/report");
    return path.startsWith(href);
  };
}

function Badge({ n, className = "" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={`min-w-[22px] h-[22px] px-1 rounded-full bg-danger text-white text-xs font-bold flex items-center justify-center ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** แถบเมนูด้านซ้าย (จอคอม) */
export function SideNav({ isAdmin, unread, name }: Props) {
  const active = useActive();
  const item = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-3 h-11 px-3 rounded-[10px] ${active(href) ? "bg-brand text-white font-semibold" : "text-[#D4DEF2] hover:bg-white/10"}`}
    >
      {icon}
      {label}
    </Link>
  );
  return (
    <nav aria-label="เมนูหลัก" className="hidden md:flex print:hidden flex-col gap-1.5 w-60 shrink-0 bg-navy text-white px-4 py-6 min-h-dvh sticky top-0">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="w-9 h-9 rounded-[10px] bg-brand flex items-center justify-center">
          <Logo />
        </div>
        <span className="text-xl font-bold">Task Track</span>
      </div>
      {item("/", "งานทั้งหมด", <List size={20} />)}
      {item("/tasks/new", "แจ้งปัญหา", <PlusCircle size={20} />)}
      <Link
        href="/notifications"
        className={`flex items-center gap-3 h-11 px-3 rounded-[10px] font-semibold ${active("/notifications") ? "bg-brand text-white" : unread > 0 ? "bg-[#3A2410] text-white" : "text-[#D4DEF2] hover:bg-white/10"}`}
      >
        <Bell size={20} color={unread > 0 ? "#FB923C" : "currentColor"} filled={unread > 0} />
        <span className="flex-1">แจ้งเตือน</span>
        {unread > 0 && (
          <span className="min-w-6 h-6 px-1.5 rounded-full bg-alert text-white text-[13px] font-bold flex items-center justify-center">{unread}</span>
        )}
      </Link>
      {isAdmin && (
        <>
          <div className="text-xs text-[#9FB2D3] px-3 pt-4 pb-1">Admin</div>
          {item("/admin", "ภาพรวม", <Chart size={20} />)}
          {item("/admin/data", "จัดการข้อมูล", <Gear size={20} />)}
        </>
      )}
      <div className="flex-1" />
      {item("/profile", name, <User size={20} />)}
    </nav>
  );
}

/** หัวจอ + กระดิ่ง (มือถือ) */
export function TopBar({ unread }: { unread: number }) {
  return (
    <header className="md:hidden print:hidden sticky top-0 z-20 bg-white border-b border-line px-4 h-16 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[9px] bg-brand flex items-center justify-center">
          <Logo size={18} />
        </div>
        <span className="text-lg font-bold">Task Track</span>
      </Link>
      <Link
        href="/notifications"
        aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการใหม่` : "การแจ้งเตือน"}
        className={`relative w-12 h-12 rounded-[14px] flex items-center justify-center ${unread > 0 ? "bg-alert" : "border border-line bg-white"}`}
      >
        <Bell size={24} color={unread > 0 ? "#fff" : "#0F1B2D"} filled={unread > 0} />
        <Badge n={unread} className="absolute -top-1.5 -right-1.5 border-2 border-white" />
      </Link>
    </header>
  );
}

/** แถบเมนูด้านล่าง (มือถือ) */
export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const active = useActive();
  const cls = (href: string) =>
    `flex flex-col items-center justify-center gap-1 text-xs ${active(href) ? "text-brand font-semibold" : "text-muted"}`;
  return (
    <nav aria-label="เมนูด้านล่าง" className={`md:hidden print:hidden fixed bottom-0 inset-x-0 z-20 h-[68px] bg-white border-t border-line grid ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
      <Link href="/" className={cls("/")}><List />งาน</Link>
      <Link href="/tasks/new" className={cls("/tasks/new")}><PlusCircle />แจ้งปัญหา</Link>
      {isAdmin && <Link href="/admin" className={cls("/admin")}><Chart />Admin</Link>}
      <Link href="/profile" className={cls("/profile")}><User />โปรไฟล์</Link>
    </nav>
  );
}
