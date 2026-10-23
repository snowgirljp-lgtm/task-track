"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTask } from "@/app/(app)/tasks/[id]/actions";

/** ปุ่มลบงาน (เฉพาะ Admin) — ต้องกดยืนยันอีกครั้งก่อนลบ */
export default function DeleteTask({ taskId, code }: { taskId: string; code: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirmDelete() {
    setError(null);
    start(async () => {
      const r = await deleteTask(taskId);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.replace("/?status=all");
      router.refresh();
    });
  }

  return (
    <section className="card p-4 flex flex-col gap-2.5 border-[#F5C2BD]">
      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} className="btn bg-white border border-[#B42318] text-[#B42318] self-start">
          ลบงานนี้
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-[#B42318] font-semibold leading-relaxed">
            ยืนยันลบงาน {code}? งาน รูป ประวัติ และแจ้งเตือนของงานนี้จะถูกลบถาวร กู้คืนไม่ได้
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => setAsking(false)} className="btn btn-ghost">
              ไม่ลบ
            </button>
            <button type="button" disabled={pending} onClick={confirmDelete} className="btn bg-[#B42318] text-white">
              {pending ? "กำลังลบ..." : "ยืนยันลบถาวร"}
            </button>
          </div>
        </div>
      )}
      {error && <div role="alert" className="text-sm text-danger">{error}</div>}
      <span className="text-xs text-muted">เฉพาะ Admin · ถ้าแค่ไม่ต้องทำงานนี้แล้ว แนะนำให้ "ยกเลิกงาน" แทน เพื่อเก็บประวัติไว้</span>
    </section>
  );
}
