"use client";

import { useEffect } from "react";

/** เปิดหน้าต่างพิมพ์อัตโนมัติ — เลือก "บันทึกเป็น PDF" ได้จากหน้าต่างนี้ */
export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary print:hidden">
      พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}
