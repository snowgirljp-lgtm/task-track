"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * แถบ "กำลังโหลด..." ที่ขึ้นทันทีเมื่อกดลิงก์หรือค้นหา และหายเมื่อหน้าใหม่แสดงแล้ว
 */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  // หน้าใหม่แสดงแล้ว → ซ่อน
  useEffect(() => {
    setLoading(false);
  }, [pathname, search]);

  // กันค้าง: ถ้าผ่านไป 20 วินาทีแล้วยังไม่เปลี่ยนหน้า ให้ซ่อนเอง
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 20000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    const current = () => window.location.pathname + window.location.search;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/")) return; // ดาวน์โหลดไฟล์ ไม่ได้เปลี่ยนหน้า
      if (url.pathname + url.search === current()) return;
      setLoading(true);
    }

    // เฉพาะฟอร์มค้นหา/กรองที่ติดป้าย data-nav-form (ฟอร์มอื่นมีสถานะ "กำลังบันทึก" ของตัวเอง)
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      if (form?.dataset?.navForm !== "true") return;
      const params = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
      const target = new URL(form.action, window.location.href);
      if (target.pathname + "?" + params.toString() === current()) return;
      setLoading(true);
    }

    // ลิงก์ต้องฟังช่วง capture เพราะ Next.js จะ preventDefault ทีหลังเพื่อเปลี่ยนหน้าเอง
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  if (!loading) return null;
  return (
    <div role="status" aria-live="polite" className="fixed top-0 inset-x-0 z-50 print:hidden pointer-events-none">
      <div className="h-1 bg-brand-soft overflow-hidden">
        <div className="h-1 w-1/3 bg-brand animate-[tt-slide_1s_ease-in-out_infinite]" />
      </div>
      <div className="flex justify-center pt-2">
        <span className="flex items-center gap-2 rounded-full bg-navy text-white text-sm font-medium px-4 py-1.5 shadow-lg">
          <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          กำลังโหลด...
        </span>
      </div>
    </div>
  );
}
