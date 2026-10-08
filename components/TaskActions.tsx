"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/labels";
import type { Status } from "@/lib/types";

type Props = { taskId: string; status: Status; solution: string; isAdmin: boolean };

export default function TaskActions({ taskId, status, solution: initialSolution, isAdmin }: Props) {
  const router = useRouter();
  const [solution, setSolution] = useState(initialSolution);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"none" | "redo" | "cancel">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function update(values: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const { error } = await supabase.from("tasks").update(values).eq("id", taskId);
    setBusy(false);
    if (error) {
      setError(friendlyError(error.message));
      return false;
    }
    setMode("none");
    setReason("");
    router.refresh();
    return true;
  }

  const closed = status === "done" || status === "cancelled";

  return (
    <div className="flex flex-col gap-4">
      {(status === "pending" || status === "redo") && (
        <section className="card p-4 flex flex-col gap-3">
          <p className="text-sm text-muted">
            {status === "pending" ? "กดรับงานเพื่อเริ่มทำ ระบบจะบันทึกคุณเป็นผู้รับผิดชอบ" : "กดรับงานเพื่อแก้ไขต่อ"}
          </p>
          <button type="button" disabled={busy} onClick={() => update({ status: "in_progress" })} className="btn btn-primary h-[52px] text-base">
            {status === "pending" ? "รับงาน (เริ่มทำ)" : "รับงานแก้ไขต่อ"}
          </button>
        </section>
      )}

      {status === "in_progress" && (
        <section className="card p-4 flex flex-col gap-2.5 border-2 border-brand">
          <label htmlFor="solution" className="label req mb-0 text-base">วิธีแก้</label>
          <textarea
            id="solution"
            rows={4}
            className="field resize-y leading-relaxed"
            placeholder="อธิบายว่าแก้ปัญหาอย่างไร"
            value={solution}
            onChange={(e) => { setSolution(e.target.value); setSaved(false); }}
          />
          <span className="text-[13px] text-muted">ต้องกรอกวิธีแก้ก่อนจึงจะส่งตรวจได้</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => { if (await update({ solution })) setSaved(true); }}
              className="btn btn-ghost"
            >
              {saved ? "บันทึกแล้ว ✓" : "บันทึกวิธีแก้"}
            </button>
            <button
              type="button"
              disabled={busy || !solution.trim()}
              onClick={() => update({ solution, status: "review" })}
              className="btn btn-primary"
            >
              บันทึกและส่งตรวจ
            </button>
          </div>
        </section>
      )}

      {(status === "review" || closed) && initialSolution && (
        <section className="card p-4 flex flex-col gap-1.5">
          <h3 className="text-base font-bold">วิธีแก้</h3>
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{initialSolution}</p>
        </section>
      )}

      {status === "review" && !isAdmin && (
        <div className="rounded-[14px] bg-[#FFF1D6] text-[#7A4A00] px-4 py-3 text-sm font-medium">รอ Admin ตรวจงาน</div>
      )}

      {isAdmin && !closed && (
        <section className="card p-4 flex flex-col gap-2.5 border-dashed border-[#9FB2D3]">
          <span className="text-sm font-bold text-[#1446A0]">สำหรับ Admin</span>
          {status === "review" && mode === "none" && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => update({ status: "done" })} className="btn bg-[#17663A] text-white">เสร็จแล้ว</button>
              <button type="button" disabled={busy} onClick={() => setMode("redo")} className="btn bg-white border border-[#C2410C] text-[#9A360A]">ส่งแก้ไขใหม่</button>
            </div>
          )}

          {mode !== "none" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="reason" className={`label mb-0 ${mode === "redo" ? "req" : ""}`}>
                {mode === "redo" ? "เหตุผลที่ส่งกลับแก้ไข" : "เหตุผลที่ยกเลิก (ถ้ามี)"}
              </label>
              <textarea id="reason" rows={3} className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setMode("none"); setReason(""); }} className="btn btn-ghost">ยกเลิก</button>
                <button
                  type="button"
                  disabled={busy || (mode === "redo" && !reason.trim())}
                  onClick={() => update({ status: mode === "redo" ? "redo" : "cancelled", status_note: reason })}
                  className={`btn text-white ${mode === "redo" ? "bg-[#C2410C]" : "bg-[#4B5563]"}`}
                >
                  {mode === "redo" ? "ยืนยันส่งแก้ไขใหม่" : "ยืนยันยกเลิกงาน"}
                </button>
              </div>
            </div>
          )}

          {mode === "none" && (
            <button type="button" onClick={() => setMode("cancel")} className="min-h-11 text-sm text-[#4B5563] underline self-center">
              ยกเลิกงานนี้
            </button>
          )}
        </section>
      )}

      {error && <div role="alert" className="rounded-xl bg-[#FDE4E2] text-danger px-4 py-3 text-sm">{error}</div>}
    </div>
  );
}
