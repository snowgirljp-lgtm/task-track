"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { URGENCY, friendlyError } from "@/lib/labels";
import type { Named, Project, Urgency } from "@/lib/types";
import { Camera, X } from "./icons";

const MAX_IMAGES = 5;

/** หมายเหตุใต้ช่อง "วันที่ครบกำหนดส่ง" — เพิ่มข้อใหม่ได้โดยเพิ่มบรรทัดในรายการนี้ */
const DUE_NOTES = [
  "เซ็นต์บิล/ส่งของใหม่เคลียให้จบภายใน 3 วัน ยกเว้นปลายทางอยู่ต่างจังหวัดภายใน 7 วันได้ (กรณีสิ้นเดือนต้องเคลียให้จบก่อนวันที่ 25)",
];

type Existing = { id: string; storage_path: string; url: string };

type Initial = {
  id: string;
  title: string;
  detail: string;
  category_id: string;
  urgency: Urgency;
  company_id: string;
  project_id: string;
  due_date: string;
};

type Props = {
  companies: Named[];
  projects: Project[];
  categories: Named[];
  initial?: Initial;
  images?: Existing[];
};

/** ย่อรูปก่อนอัปโหลด (ด้านยาวไม่เกิน 1600px, JPEG) */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function TaskForm({ companies, projects, categories, initial, images = [] }: Props) {
  const router = useRouter();
  const editing = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [urgency, setUrgency] = useState<Urgency>(initial?.urgency ?? "medium");
  const [companyId, setCompanyId] = useState(initial?.company_id ?? "");
  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [kept, setKept] = useState<Existing[]>(images);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // แสดงเฉพาะที่เปิดใช้ (ยกเว้นค่าที่งานนี้เลือกไว้เดิม)
  const keep = <T extends Named>(list: T[], current?: string) => list.filter((x) => x.is_active || x.id === current);
  const companyOptions = keep(companies, initial?.company_id);
  const categoryOptions = keep(categories, initial?.category_id);
  const projectOptions = useMemo(
    () => keep(projects, initial?.project_id).filter((p) => p.company_id === companyId),
    [projects, companyId, initial?.project_id]
  );

  const total = kept.length + files.length;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_IMAGES - total;
    const picked = Array.from(list).slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setFiles((f) => [...f, ...picked]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId || !companyId || !projectId || !dueDate) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (total < 1) {
      setError("กรุณาแนบรูปอย่างน้อย 1 รูป");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const values = {
      title: title.trim(),
      detail: detail.trim(),
      category_id: categoryId,
      urgency,
      company_id: companyId,
      project_id: projectId,
      due_date: dueDate,
    };

    let taskId = initial?.id;
    if (editing) {
      const { error } = await supabase.from("tasks").update(values).eq("id", taskId!);
      if (error) return fail(error.message);
      const removed = images.filter((img) => !kept.some((k) => k.id === img.id));
      if (removed.length) {
        await supabase.from("task_images").delete().in("id", removed.map((r) => r.id));
        await supabase.storage.from("task-images").remove(removed.map((r) => r.storage_path));
      }
    } else {
      const { data, error } = await supabase.from("tasks").insert(values).select("id").single();
      if (error || !data) return fail(error?.message);
      taskId = data.id;
    }

    for (let i = 0; i < files.length; i++) {
      const blob = await shrink(files[i].file);
      const path = `${taskId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("task-images").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) return fail("อัปโหลดรูปไม่สำเร็จ: " + up.error.message);
      const { error } = await supabase.from("task_images").insert({ task_id: taskId, storage_path: path, sort: kept.length + i });
      if (error) return fail(error.message);
    }

    router.push(`/tasks/${taskId}`);
    router.refresh();
  }

  function fail(msg?: string) {
    setError(friendlyError(msg));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-xl">
      <div>
        <label htmlFor="title" className="label req">หัวข้อปัญหา</label>
        <input id="title" required className="field" placeholder="เช่น ไฟดับชั้น 3" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label htmlFor="detail" className="label req">รายละเอียด</label>
        <textarea id="detail" required rows={4} className="field resize-y" placeholder="อธิบายปัญหาที่พบ" value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>

      <div>
        <div className="flex justify-between items-baseline mb-2">
          <span className="label req mb-0">รูปภาพ</span>
          <span className="text-[13px] text-muted">{total} / {MAX_IMAGES} รูป</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {kept.map((img) => (
            <Thumb key={img.id} src={img.url} onRemove={() => setKept((k) => k.filter((x) => x.id !== img.id))} />
          ))}
          {files.map((f, i) => (
            <Thumb key={f.preview} src={f.preview} onRemove={() => setFiles((list) => list.filter((_, j) => j !== i))} />
          ))}
          {total < MAX_IMAGES && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-[#9FB2D3] bg-white text-brand text-[13px] flex flex-col items-center justify-center gap-1 cursor-pointer">
              <Camera size={24} />
              ถ่าย/เลือกรูป
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="cat" className="label req">หมวดหมู่</label>
        <select id="cat" required className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">เลือกหมวดหมู่</option>
          {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <fieldset>
        <legend className="label req">ความเร่งด่วน</legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(URGENCY) as Urgency[]).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={urgency === u}
              onClick={() => setUrgency(u)}
              className={`h-11 rounded-xl text-[15px] ${urgency === u ? "border-2 border-brand bg-brand-soft text-[#1446A0] font-semibold" : "border border-field bg-white"}`}
            >
              {URGENCY[u].label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="co" className="label req">บริษัท</label>
        <select
          id="co"
          required
          className="field"
          value={companyId}
          onChange={(e) => { setCompanyId(e.target.value); setProjectId(""); }}
        >
          <option value="">เลือกบริษัท</option>
          {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="proj" className="label req">
          โครงการ <span className="font-normal text-[13px] text-muted">(ตามบริษัทที่เลือก)</span>
        </label>
        <select id="proj" required disabled={!companyId} className="field disabled:bg-canvas" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">{companyId ? "เลือกโครงการ" : "เลือกบริษัทก่อน"}</option>
          {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="due" className="label req">วันที่ครบกำหนดส่ง</label>
        <input id="due" type="date" required className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <div className="mt-2 rounded-xl bg-[#FEF3F2] border border-[#F5C2BD] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#B42318]">
          <div className="font-semibold mb-0.5">หมายเหตุ</div>
          <ol className="list-decimal pl-5">
            {DUE_NOTES.map((n) => <li key={n}>{n}</li>)}
          </ol>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl bg-[#FDE4E2] text-danger px-4 py-3 text-sm">{error}</div>}

      <button type="submit" disabled={busy} className="btn btn-primary h-[54px] text-[17px]">
        {busy ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : "ส่งเรื่องแจ้งปัญหา"}
      </button>
      {!editing && <p className="text-[13px] text-muted text-center -mt-2">งานใหม่จะอยู่ในสถานะ "รอดำเนินการ" และแจ้งเตือนทุกคน</p>}
    </form>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-[#C9D6EA]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="w-full h-full object-cover" />
      <button type="button" onClick={onRemove} aria-label="ลบรูปนี้" className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
        <X size={16} />
      </button>
    </div>
  );
}
