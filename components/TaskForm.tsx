"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { URGENCY, friendlyError } from "@/lib/labels";
import type { Named, Project, Urgency } from "@/lib/types";
import { shrink } from "@/lib/shrink";
import { Camera, X } from "./icons";
import SearchSelect from "./SearchSelect";

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
  bill_type_id: string | null;
  urgency: Urgency;
  company_id: string;
  project_id: string;
  due_date: string;
  doc_date: string | null;
  doc_no: string | null;
  po_no: string | null;
  amount: number | null;
};

type Props = {
  companies: Named[];
  projects: Project[];
  categories: Named[];
  billTypes?: Named[];
  initial?: Initial;
  images?: Existing[];
};

export default function TaskForm({ companies, projects, categories, billTypes = [], initial, images = [] }: Props) {
  const router = useRouter();
  const editing = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [billTypeId, setBillTypeId] = useState(initial?.bill_type_id ?? "");
  const [urgency, setUrgency] = useState<Urgency>(initial?.urgency ?? "medium");
  const [companyId, setCompanyId] = useState(initial?.company_id ?? "");
  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [docDate, setDocDate] = useState(initial?.doc_date ?? "");
  const [docNo, setDocNo] = useState(initial?.doc_no ?? "");
  const [poNo, setPoNo] = useState(initial?.po_no ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [kept, setKept] = useState<Existing[]>(images);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // แสดงเฉพาะที่เปิดใช้ (ยกเว้นค่าที่งานนี้เลือกไว้เดิม)
  const keep = <T extends Named>(list: T[], current?: string) => list.filter((x) => x.is_active || x.id === current);
  const companyOptions = keep(companies, initial?.company_id);
  const categoryOptions = keep(categories, initial?.category_id);
  const billTypeOptions = keep(billTypes, initial?.bill_type_id ?? undefined);
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
    const amountNum = Number(amount.replace(/,/g, ""));
    if (!categoryId || !billTypeId || !companyId || !projectId || !dueDate || !docDate || !docNo.trim() || amount.trim() === "") {
      setError("กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบ");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setError("จำนวนเงินไม่ถูกต้อง");
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
      bill_type_id: billTypeId,
      urgency,
      company_id: companyId,
      project_id: projectId,
      due_date: dueDate,
      doc_date: docDate,
      doc_no: docNo.trim(),
      po_no: poNo.trim() || null,
      amount: amountNum,
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
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-3xl">
      {/* 1. หัวข้อปัญหา */}
      <div>
        <label htmlFor="title" className="label req">หัวข้อปัญหา</label>
        <input id="title" required className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {/* 2. รายละเอียด */}
      <div>
        <label htmlFor="detail" className="label req">
          รายละเอียด <span className="font-normal text-[13px] text-muted">(อธิบายสาเหตุ เช่น คนขับลงของผิดไซต์งาน รับสินค้ากลับทันที)</span>
        </label>
        <textarea id="detail" required rows={4} className="field resize-y" value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>

      {/* 3. วันที่เอกสาร/วันที่เกิดเหตุ + หมวดหมู่ */}
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="docdate" className="label req">วันที่เอกสาร/วันที่เกิดเหตุ</label>
          <input id="docdate" type="date" required className="field" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="cat" className="label req">หมวดหมู่</label>
          <select id="cat" required className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">เลือกหมวดหมู่</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* 4. บริษัท + โครงการ */}
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="co" className="label req">บริษัท</label>
          <SearchSelect
            id="co"
            required
            value={companyId}
            options={companyOptions}
            placeholder="พิมพ์ค้นหาบริษัท"
            onChange={(v) => { if (v !== companyId) { setCompanyId(v); setProjectId(""); } }}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="proj" className="label req">โครงการ</label>
          <SearchSelect
            id="proj"
            required
            disabled={!companyId}
            value={projectId}
            options={projectOptions}
            placeholder={companyId ? "พิมพ์ค้นหาโครงการ" : "เลือกบริษัทก่อน"}
            emptyText="ไม่พบโครงการในบริษัทนี้"
            onChange={setProjectId}
          />
        </div>
      </div>

      {/* 5. ประเภทบิล + เลขที่เอกสาร + เลขที่ PO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="col-span-2 sm:col-span-1 min-w-0">
          <label htmlFor="bill" className="label req">ประเภทบิล</label>
          <select id="bill" required className="field" value={billTypeId} onChange={(e) => setBillTypeId(e.target.value)}>
            <option value="">{billTypeOptions.length ? "เลือกประเภทบิล" : "ยังไม่มีรายการ (ให้ Admin เพิ่ม)"}</option>
            {billTypeOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="docno" className="label req">เลขที่เอกสาร</label>
          <input id="docno" required className="field" value={docNo} onChange={(e) => setDocNo(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="pono" className="label">เลขที่ PO</label>
          <input id="pono" className="field" value={poNo} onChange={(e) => setPoNo(e.target.value)} />
        </div>
      </div>

      {/* 6. จำนวนเงิน */}
      <div className="sm:max-w-[calc(50%-6px)]">
        <label htmlFor="amount" className="label req">จำนวนเงิน (บาท)</label>
        <input
          id="amount"
          required
          inputMode="decimal"
          className="field text-right tabular-nums"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
        />
      </div>

      {/* 7. รูปภาพ */}
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

      {/* 8. ความเร่งด่วน + วันที่ครบกำหนดส่ง */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <fieldset className="min-w-0">
            <legend className="label req">ความเร่งด่วน</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(URGENCY) as Urgency[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={urgency === u}
                  onClick={() => setUrgency(u)}
                  className={`h-12 rounded-xl text-[15px] ${urgency === u ? "border-2 border-brand bg-brand-soft text-[#1446A0] font-semibold" : "border border-field bg-white"}`}
                >
                  {URGENCY[u].label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="min-w-0">
            <label htmlFor="due" className="label req">วันที่ครบกำหนดส่ง</label>
            <input id="due" type="date" required className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl bg-[#FEF3F2] border border-[#F5C2BD] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#B42318]">
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

export function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
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
