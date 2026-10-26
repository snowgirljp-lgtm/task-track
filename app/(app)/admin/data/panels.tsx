"use client";

import { useState, useTransition } from "react";
import { ROLE } from "@/lib/labels";
import type { Named, Profile, Project, Role } from "@/lib/types";
import { Pencil } from "@/components/icons";
import {
  addItem,
  inviteUser,
  removeInvite,
  renameItem,
  setInviteDepartments,
  decideRequest,
  setItemActive,
  setUserActive,
  toggleUserDepartment,
  setUserRole,
  type Result,
} from "./actions";
import { importCompaniesProjects, type ImportResult } from "./import";

/** เรียก server action แล้วแสดง error */
function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const exec = (fn: () => Promise<Result>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else onOk?.();
    });
  return { pending, error, exec };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <div role="alert" className="text-sm text-danger">{error}</div> : null;
}

const pill = (on: boolean) =>
  `text-[13px] font-semibold px-2.5 py-0.5 rounded-[10px] ${on ? "bg-[#DDF3E6] text-[#17663A]" : "bg-[#E5E7EB] text-[#4B5563]"}`;

// =====================================================================
// ผู้ใช้
// =====================================================================
/** เลือกได้หลายแผนก — กดป้ายเพื่อเพิ่ม/เอาออก */
function DeptToggles({
  value,
  departments,
  onToggle,
  disabled,
  label,
}: {
  value: string[];
  departments: Named[];
  onToggle: (id: string, on: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const options = departments.filter((d) => d.is_active || value.includes(d.id));
  if (options.length === 0) return <span className="text-[13px] text-muted">ยังไม่มีแผนก</span>;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((d) => {
        const on = value.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(d.id, !on)}
            className={`h-8 px-2.5 rounded-full text-[13px] border ${on ? "bg-brand-soft border-brand text-[#1446A0] font-semibold" : "bg-white border-field text-muted"}`}
          >
            {on ? "✓ " : "+ "}
            {d.name}
          </button>
        );
      })}
    </div>
  );
}

export function UserPanel({
  meId,
  users,
  pending,
  departments,
}: {
  meId: string;
  users: Profile[];
  pending: { email: string; full_name: string; role: Role; department_ids: string[] }[];
  departments: Named[];
}) {
  const { pending: busy, error, exec } = useAction();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("reporter");
  const [depts, setDepts] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const noDept = users.filter((u) => u.is_active && u.role !== "admin" && !(u.department_ids ?? []).length).length;

  return (
    <section className="card p-5 flex flex-col gap-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold">ผู้ใช้ที่เข้าระบบได้</h2>
          <p className="text-[13px] text-muted">
            เฉพาะ Gmail ที่ "ใช้งาน" เท่านั้นที่เข้าระบบได้ · ผู้ที่ถูกระงับจะเข้าไม่ได้ทันที แต่งานและประวัติเดิมยังอยู่ครบ
          </p>
          <p className="text-[13px] text-muted">ผู้ใช้อยู่ได้หลายแผนก และเห็นงานของทุกแผนกที่สังกัด (และงานที่ตัวเองแจ้ง) · Admin เห็นทุกแผนก</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-primary">+ เพิ่มผู้ใช้</button>
      </div>

      {noDept > 0 && (
        <div className="rounded-xl bg-[#FFF1D6] text-[#7A4A00] px-3.5 py-2.5 text-sm">
          มีผู้ใช้ {noDept} คนที่ยังไม่มีแผนก — จะเห็นเฉพาะงานที่ตัวเองแจ้ง กรุณากดเลือกแผนกในตารางด้านล่าง
        </div>
      )}

      {open && (
        <form
          className="grid sm:grid-cols-[1.4fr_1fr_auto] gap-2 items-end bg-canvas rounded-xl p-3"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => inviteUser(email, name, role, depts), () => { setEmail(""); setName(""); setRole("reporter"); setDepts([]); setOpen(false); });
          }}
        >
          <div>
            <label htmlFor="inv-email" className="label text-sm">Gmail</label>
            <input id="inv-email" type="email" required className="field min-h-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" />
          </div>
          <div>
            <label htmlFor="inv-name" className="label text-sm">ชื่อที่แสดง</label>
            <input id="inv-name" required className="field min-h-10" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="inv-role" className="label text-sm">บทบาท</label>
            <select id="inv-role" className="field min-h-10" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE) as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <span className="label text-sm">แผนก (เลือกได้หลายแผนก)</span>
            <DeptToggles
              label="แผนกของผู้ใช้ใหม่"
              value={depts}
              departments={departments}
              onToggle={(id, on) => setDepts((d) => (on ? [...d, id] : d.filter((x) => x !== id)))}
            />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary min-h-10 sm:col-span-3 sm:justify-self-start">บันทึก</button>
        </form>
      )}

      <ErrorText error={error} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm border-collapse">
          <thead>
            <tr className="text-left text-muted">
              {["ชื่อ", "Gmail", "บทบาท", "แผนก", "สถานะ"].map((h) => (
                <th key={h} className="py-2 px-1.5 font-medium border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === meId;
              return (
                <tr key={u.id} className="border-b border-[#EEF1F5]">
                  <td className="py-2.5 px-1.5 font-medium">{u.full_name}{self && <span className="text-muted font-normal"> (คุณ)</span>}</td>
                  <td className="py-2.5 px-1.5 text-muted">{u.email}</td>
                  <td className="py-2.5 px-1.5">
                    <select
                      aria-label={`บทบาทของ ${u.full_name}`}
                      disabled={self || busy}
                      className="h-9 rounded-lg border border-field bg-white px-2 text-sm"
                      value={u.role}
                      onChange={(e) => exec(() => setUserRole(u.id, e.target.value as Role))}
                    >
                      {(Object.keys(ROLE) as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5 px-1.5">
                    {u.role === "admin" ? (
                      <span className="text-muted text-[13px]">เห็นทุกแผนก</span>
                    ) : (
                      <DeptToggles
                        label={`แผนกของ ${u.full_name}`}
                        value={u.department_ids ?? []}
                        departments={departments}
                        disabled={busy}
                        onToggle={(id, on) => exec(() => toggleUserDepartment(u.id, id, on))}
                      />
                    )}
                  </td>
                  <td className="py-2.5 px-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={pill(u.is_active)}>{u.is_active ? "ใช้งาน" : "ระงับใช้งาน"}</span>
                      {!self && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => exec(() => setUserActive(u.id, !u.is_active))}
                          className={`h-[34px] px-3 rounded-lg text-[13px] font-semibold bg-white border ${u.is_active ? "border-field text-[#9A360A]" : "border-brand text-brand"}`}
                        >
                          {u.is_active ? "ระงับใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {pending.map((p) => (
              <tr key={p.email} className="border-b border-[#EEF1F5]">
                <td className="py-2.5 px-1.5 font-medium">{p.full_name}</td>
                <td className="py-2.5 px-1.5 text-muted">{p.email}</td>
                <td className="py-2.5 px-1.5">{ROLE[p.role]}</td>
                <td className="py-2.5 px-1.5">
                  <DeptToggles
                    label={`แผนกของ ${p.full_name}`}
                    value={p.department_ids ?? []}
                    departments={departments}
                    disabled={busy}
                    onToggle={(id, on) =>
                      exec(() => setInviteDepartments(p.email, on ? [...(p.department_ids ?? []), id] : (p.department_ids ?? []).filter((x) => x !== id)))
                    }
                  />
                </td>
                <td className="py-2.5 px-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-[10px] bg-[#FFF1D6] text-[#7A4A00]">ยังไม่เคยเข้า</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirm(`ลบ ${p.email} ออกจากรายชื่อ?`) && exec(() => removeInvite(p.email))}
                      className="h-[34px] px-3 rounded-lg text-[13px] font-semibold bg-white border border-field text-[#9A360A]"
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// =====================================================================
// แถวที่แก้ชื่อ / ปิด-เปิดใช้ได้ (ใช้ร่วมกันทั้งบริษัท โครงการ หมวดหมู่)
// =====================================================================
function EditableRow({
  table,
  item,
  count,
  small,
  extra,
}: {
  table: "companies" | "projects" | "categories" | "departments" | "bill_types";
  item: Named;
  count?: number;
  small?: boolean;
  extra?: React.ReactNode;
}) {
  const { pending, error, exec } = useAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const h = small ? "h-8" : "h-9";

  return (
    <div className="flex flex-col gap-1">
      {editing ? (
        <form
          className="flex gap-1.5 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => renameItem(table, item.id, name), () => setEditing(false));
          }}
        >
          <input autoFocus aria-label="แก้ชื่อ" value={name} onChange={(e) => setName(e.target.value)} className={`flex-1 min-w-0 ${h} rounded-lg border-2 border-brand px-2.5 text-sm`} />
          <button type="submit" disabled={pending} className={`${h} px-3 rounded-lg bg-brand text-white text-[13px] font-semibold`}>บันทึก</button>
          <button type="button" onClick={() => { setEditing(false); setName(item.name); }} className={`${h} px-2.5 rounded-lg border border-field bg-white text-[13px]`}>ยกเลิก</button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span className={`flex-1 ${small ? "text-sm" : "text-[15px] font-bold"} ${item.is_active ? "" : "text-[#6B7280] line-through"}`}>{item.name}</span>
          {count !== undefined && <span className="text-xs text-muted whitespace-nowrap">{count} งาน</span>}
          <button type="button" aria-label={`แก้ชื่อ ${item.name}`} onClick={() => setEditing(true)} className={`${small ? "w-8" : "w-9"} ${h} rounded-lg border border-field bg-white flex items-center justify-center text-brand`}>
            <Pencil size={small ? 14 : 16} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => exec(() => setItemActive(table, item.id, !item.is_active))}
            className={`${h} px-2.5 rounded-lg border border-field bg-white text-xs font-semibold ${item.is_active ? "text-[#9A360A]" : "text-brand"}`}
          >
            {item.is_active ? "ปิดใช้" : "เปิดใช้"}
          </button>
          {extra}
        </div>
      )}
      <ErrorText error={error} />
    </div>
  );
}

function AddForm({ placeholder, onAdd, small }: { placeholder: string; onAdd: (name: string) => Promise<Result>; small?: boolean }) {
  const { pending, error, exec } = useAction();
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          exec(() => onAdd(name), () => setName(""));
        }}
      >
        <input aria-label={placeholder} placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} className={`flex-1 min-w-0 ${small ? "h-9" : "h-10"} rounded-[10px] border border-field px-3 text-sm`} />
        <button type="submit" disabled={pending || !name.trim()} className={`btn btn-primary ${small ? "min-h-9" : "min-h-10"} text-sm`}>เพิ่ม</button>
      </form>
      <ErrorText error={error} />
    </div>
  );
}

// =====================================================================
// บริษัท และ โครงการ
// =====================================================================
export function CompanyPanel({
  companies,
  projects,
  companyCount,
  projectCount,
}: {
  companies: Named[];
  projects: Project[];
  companyCount: Record<string, number>;
  projectCount: Record<string, number>;
}) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  return (
    <section className="card p-5 flex flex-col gap-3">
      <h2 className="text-lg font-bold">บริษัท และ โครงการ</h2>
      <ImportBox />
      <AddForm placeholder="ชื่อบริษัทใหม่" onAdd={(n) => addItem("companies", n)} />
      {companies.length === 0 && <p className="text-sm text-muted">ยังไม่มีบริษัท</p>}
      {companies.map((c) => (
        <div key={c.id} className="border border-line rounded-xl px-3.5 py-3 flex flex-col gap-2">
          <EditableRow
            table="companies"
            item={c}
            count={companyCount[c.id] ?? 0}
            extra={
              <button type="button" onClick={() => setAddingTo(addingTo === c.id ? null : c.id)} className="h-9 px-2.5 rounded-lg bg-brand-soft text-brand text-[13px] font-semibold whitespace-nowrap">
                + โครงการ
              </button>
            }
          />
          <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-[#DCE8FF]">
            {projects.filter((p) => p.company_id === c.id).map((p) => (
              <EditableRow key={p.id} table="projects" item={p} count={projectCount[p.id] ?? 0} small />
            ))}
            {addingTo === c.id && <AddForm small placeholder="ชื่อโครงการใหม่" onAdd={(n) => addItem("projects", n, c.id)} />}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted leading-relaxed">
        ลบไม่ได้ ให้กด "ปิดใช้" แทน งานเก่ายังแสดงชื่อเดิม · ปิดใช้บริษัท = โครงการของบริษัทนั้นจะไม่มีให้เลือกตอนแจ้งปัญหาใหม่
      </p>
    </section>
  );
}

// =====================================================================
// หมวดหมู่
// =====================================================================
export function CategoryPanel({ categories, counts }: { categories: Named[]; counts: Record<string, number> }) {
  return (
    <section className="card p-5 flex flex-col gap-3">
      <h2 className="text-lg font-bold">หมวดหมู่ปัญหา</h2>
      {categories.map((c) => (
        <div key={c.id} className="border border-line rounded-[10px] px-2.5 py-2">
          <EditableRow table="categories" item={c} count={counts[c.id] ?? 0} small />
        </div>
      ))}
      <AddForm placeholder="ชื่อหมวดหมู่ใหม่" onAdd={(n) => addItem("categories", n)} />
      <p className="text-xs text-muted leading-relaxed">
        หมวดหมู่ที่ใช้งานแล้วลบไม่ได้ ให้กด "ปิดใช้" แทน งานเก่ายังแสดงชื่อเดิม แต่จะไม่มีให้เลือกตอนแจ้งปัญหาใหม่
      </p>
    </section>
  );
}

// =====================================================================
// แผนก
// =====================================================================
export function DepartmentPanel({
  departments,
  taskCounts,
  userCounts,
}: {
  departments: Named[];
  taskCounts: Record<string, number>;
  userCounts: Record<string, number>;
}) {
  return (
    <section className="card p-5 flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold">แผนก</h2>
        <p className="text-[13px] text-muted">งานที่แจ้งจะเป็นของแผนกคนแจ้งโดยอัตโนมัติ</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {departments.map((d) => (
          <div key={d.id} className="border border-line rounded-[10px] px-2.5 py-2 flex flex-col gap-1">
            <EditableRow table="departments" item={d} count={taskCounts[d.id] ?? 0} small />
            <span className="text-xs text-muted pl-0.5">{userCounts[d.id] ?? 0} คน</span>
          </div>
        ))}
      </div>
      {departments.length === 0 && <p className="text-sm text-muted">ยังไม่มีแผนก เพิ่มแผนกแรกด้านล่าง</p>}
      <AddForm placeholder="ชื่อแผนกใหม่" onAdd={(n) => addItem("departments", n)} />
      <p className="text-xs text-muted leading-relaxed">ลบไม่ได้ ให้กด "ปิดใช้" แทน · ปิดใช้แผนกแล้ว คนในแผนกยังเห็นงานเดิมได้</p>
    </section>
  );
}

// =====================================================================
// ประเภทบิล
// =====================================================================
export function BillTypePanel({ billTypes, counts }: { billTypes: Named[]; counts: Record<string, number> }) {
  return (
    <section className="card p-5 flex flex-col gap-3">
      <h2 className="text-lg font-bold">ประเภทบิล</h2>
      {billTypes.map((c) => (
        <div key={c.id} className="border border-line rounded-[10px] px-2.5 py-2">
          <EditableRow table="bill_types" item={c} count={counts[c.id] ?? 0} small />
        </div>
      ))}
      {billTypes.length === 0 && <p className="text-sm text-muted">ยังไม่มีประเภทบิล เพิ่มรายการแรกด้านล่าง</p>}
      <AddForm placeholder="ชื่อประเภทบิลใหม่" onAdd={(n) => addItem("bill_types", n)} />
      <p className="text-xs text-muted leading-relaxed">ลบไม่ได้ ให้กด "ปิดใช้" แทน งานเก่ายังแสดงชื่อเดิม</p>
    </section>
  );
}

// =====================================================================
// นำเข้าบริษัทและโครงการจาก Excel
// =====================================================================
function ImportBox() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  return (
    <form
      className="rounded-xl bg-canvas border border-dashed border-[#9FB2D3] p-3.5 flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        setResult(null);
        start(async () => {
          const r = await importCompaniesProjects(fd);
          setResult(r);
          if (!r.error) {
            form.reset();
            setFileName("");
          }
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">นำเข้าจากไฟล์ Excel</span>
        <a href="/api/import-template" className="text-sm font-semibold text-brand underline">ดาวน์โหลดไฟล์ตัวอย่าง</a>
      </div>
      <p className="text-xs text-muted leading-relaxed">
        ไฟล์ .xlsx มี 2 คอลัมน์ คือ <b>บริษัท</b> และ <b>โครงการ</b> (1 แถว = 1 โครงการ) · ข้อมูลที่มีอยู่แล้วจะถูกข้าม
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-ghost min-h-10 text-sm cursor-pointer">
          เลือกไฟล์
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => { setFileName(e.target.files?.[0]?.name ?? ""); setResult(null); }}
          />
        </label>
        <span className="text-sm text-muted truncate max-w-[50%]">{fileName || "ยังไม่ได้เลือกไฟล์"}</span>
        <button type="submit" disabled={pending || !fileName} className="btn btn-primary min-h-10 text-sm ml-auto">
          {pending ? "กำลังนำเข้า..." : "นำเข้า"}
        </button>
      </div>
      {result?.error && <div role="alert" className="text-sm text-danger">{result.error}</div>}
      {result && !result.error && (
        <div role="status" className="rounded-lg bg-[#DDF3E6] text-[#17663A] px-3 py-2 text-sm leading-relaxed">
          นำเข้าเรียบร้อย อ่านได้ {result.rows} แถว · เพิ่มบริษัทใหม่ {result.companiesAdded} · เพิ่มโครงการใหม่ {result.projectsAdded}
          {result.skipped ? ` · ข้าม ${result.skipped} โครงการที่มีอยู่แล้ว` : ""}
          {result.problems?.length ? (
            <ul className="mt-1 text-[#7A4A00] list-disc pl-5">
              {result.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : null}
        </div>
      )}
    </form>
  );
}

// =====================================================================
// คำขอเพิ่มบริษัท/โครงการ รออนุมัติ
// =====================================================================
export function RequestPanel({
  companies,
  projects,
  allCompanies,
  names,
}: {
  companies: Named[];
  projects: Project[];
  allCompanies: Named[];
  names: Record<string, string>;
}) {
  const { pending: busy, error, exec } = useAction();
  const total = companies.length + projects.length;
  if (total === 0) return null;
  const coName = (id: string) => allCompanies.find((c) => c.id === id)?.name ?? "-";

  const row = (table: "companies" | "projects", item: Named, label: string, sub: string) => (
    <div key={item.id} className="flex flex-wrap items-center gap-2 py-2.5 border-b border-[#EEF1F5] last:border-b-0">
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-soft text-[#1446A0]">{label}</span>
      <div className="flex-1 min-w-[180px]">
        <div className="font-semibold">{item.name}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      <button type="button" disabled={busy} onClick={() => exec(() => decideRequest(table, item.id, true))} className="btn min-h-9 text-sm bg-[#17663A] text-white">
        อนุมัติ
      </button>
      <button type="button" disabled={busy} onClick={() => exec(() => decideRequest(table, item.id, false))} className="btn min-h-9 text-sm bg-white border border-[#C2410C] text-[#9A360A]">
        ไม่อนุมัติ
      </button>
    </div>
  );

  return (
    <section id="requests" className="card p-5 flex flex-col gap-2 border-2 border-[#F0CF5E] bg-[#FFFDF2]">
      <h2 className="text-lg font-bold">คำขอเพิ่มบริษัท/โครงการ รออนุมัติ ({total})</h2>
      <p className="text-[13px] text-muted">ผู้ขอจะได้รับแจ้งเตือนผล และเลือกใช้ในงานได้หลังอนุมัติ · อนุมัติโครงการ = อนุมัติบริษัทของโครงการนั้นให้ด้วย</p>
      <ErrorText error={error} />
      <div className="flex flex-col">
        {companies.map((c) => row("companies", c, "บริษัท", `ขอโดย ${names[c.requested_by ?? ""] ?? "-"}`))}
        {projects.map((p) => row("projects", p, "โครงการ", `บริษัท ${coName(p.company_id)} · ขอโดย ${names[p.requested_by ?? ""] ?? "-"}`))}
      </div>
    </section>
  );
}
