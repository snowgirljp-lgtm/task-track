"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/labels";
import type { Status } from "@/lib/types";
import { shrink } from "@/lib/shrink";
import { Thumb } from "./TaskForm";
import { Camera } from "./icons";

const MAX_SOLUTION_IMAGES = 5;

type SolImage = { id: string; storage_path: string; url: string };
type Props = { taskId: string; status: Status; solution: string; solutionImages: SolImage[]; isAdmin: boolean };

export default function TaskActions({ taskId, status, solution: initialSolution, solutionImages, isAdmin }: Props) {
  const router = useRouter();
  const [solution, setSolution] = useState(initialSolution);
  const [kept, setKept] = useState<SolImage[]>(solutionImages);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
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
  const totalImages = kept.length + files.length;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_SOLUTION_IMAGES - totalImages;
    const picked = Array.from(list).slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setFiles((f) => [...f, ...picked]);
    setSaved(false);
  }

  /** บันทึกรูปหลังแก้: ลบรูปที่เอาออก + อัปโหลดรูปใหม่ */
  async function syncImages() {
    const supabase = createClient();
    const removed = solutionImages.filter((img) => !kept.some((k) => k.id === img.id));
    if (removed.length) {
      const { error } = await supabase.from("task_images").delete().in("id", removed.map((r) => r.id));
      if (error) throw new Error(error.message);
      await supabase.storage.from("task-images").remove(removed.map((r) => r.storage_path));
    }
    const uploaded: SolImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const blob = await shrink(files[i].file);
      const path = `${taskId}/solution-${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("task-images").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + up.error.message);
      const { data, error } = await supabase
        .from("task_images")
        .insert({ task_id: taskId, storage_path: path, sort: kept.length + i, kind: "solution" })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message);
      uploaded.push({ id: data.id, storage_path: path, url: files[i].preview });
    }
    setKept((k) => [...k, ...uploaded]);
    setFiles([]);
  }

  async function saveSolution(sendToReview: boolean) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await syncImages();
    } catch (e) {
      setBusy(false);
      setError(friendlyError((e as Error).message));
      return;
    }
    setBusy(false);
    const ok = await update(sendToReview ? { solution, status: "review" } : { solution });
    if (ok && !sendToReview) setSaved(true);
  }

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
        <section className="card p-4 flex flex-col gap-3 border-2 border-brand">
          <div className="flex flex-col gap-2">
            <label htmlFor="solution" className="label req mb-0 text-base">วิธีแก้</label>
            <textarea
              id="solution"
              rows={4}
              className="field resize-y leading-relaxed"
              placeholder="อธิบายว่าแก้ปัญหาอย่างไร"
              value={solution}
              onChange={(e) => { setSolution(e.target.value); setSaved(false); }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <span className="label req mb-0">รูปหลังแก้</span>
              <span className="text-[13px] text-muted">{totalImages} / {MAX_SOLUTION_IMAGES} รูป</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {kept.map((img) => (
                <Thumb key={img.id} src={img.url} onRemove={() => { setKept((k) => k.filter((x) => x.id !== img.id)); setSaved(false); }} />
              ))}
              {files.map((f, i) => (
                <Thumb key={f.preview} src={f.preview} onRemove={() => setFiles((list) => list.filter((_, j) => j !== i))} />
              ))}
              {totalImages < MAX_SOLUTION_IMAGES && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-[#9FB2D3] bg-white text-brand text-[13px] flex flex-col items-center justify-center gap-1 cursor-pointer text-center px-1">
                  <Camera size={24} />
                  อัปโหลดรูป
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>

          <span className="text-[13px] text-muted">ต้องกรอกวิธีแก้ และแนบรูปหลังแก้อย่างน้อย 1 รูป จึงจะส่งตรวจได้</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => saveSolution(false)} className="btn btn-ghost">
              {busy ? "กำลังบันทึก..." : saved ? "บันทึกแล้ว ✓" : "บันทึกไว้ก่อน"}
            </button>
            <button
              type="button"
              disabled={busy || !solution.trim() || totalImages < 1}
              onClick={() => saveSolution(true)}
              className="btn btn-primary"
            >
              แก้ไขเรียบร้อยแล้ว
            </button>
          </div>
        </section>
      )}

      {(status === "review" || closed) && (initialSolution || solutionImages.length > 0) && (
        <section className="card p-4 flex flex-col gap-2">
          <h3 className="text-base font-bold">วิธีแก้</h3>
          {initialSolution && <p className="text-[15px] leading-relaxed whitespace-pre-line">{initialSolution}</p>}
          {solutionImages.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {solutionImages.map((img, i) => (
                <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="aspect-square rounded-[10px] overflow-hidden bg-[#C9D6EA]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`รูปหลังแก้ ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {status === "review" && !isAdmin && (
        <div className="rounded-[14px] bg-[#FFF7C2] text-[#6B5300] px-4 py-3 text-sm font-medium">รอ Admin ตรวจงาน</div>
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
