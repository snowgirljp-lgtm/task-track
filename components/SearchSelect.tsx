"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Option = { id: string; name: string };

type Props = {
  id?: string;
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyText?: string;
  /** รายการที่ขอไว้แล้ว แต่ยังรออนุมัติ (แสดงแต่เลือกไม่ได้) */
  pending?: Option[];
  /** แสดงปุ่ม "+ ขอเพิ่ม" เมื่อพิมพ์ชื่อที่ไม่มีในรายการ */
  onCreate?: (name: string) => void;
  createLabel?: string;
};

/** ช่องเลือกแบบพิมพ์ค้นหาได้ — พิมพ์บางส่วนของชื่อแล้วเลือกจากรายการ */
export default function SearchSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "พิมพ์เพื่อค้นหา",
  disabled,
  required,
  emptyText = "ไม่พบรายการ",
  pending = [],
  onCreate,
  createLabel = "ขอเพิ่ม",
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);
  const [text, setText] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // ค่าที่เลือกเปลี่ยนจากภายนอก (เช่น ล้างโครงการเมื่อเปลี่ยนบริษัท)
  useEffect(() => {
    setText(selected?.name ?? "");
  }, [value, selected?.name]);

  const filtered = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t || (selected && text === selected.name)) return options;
    return options.filter((o) => o.name.toLowerCase().includes(t));
  }, [text, options, selected]);
  const typed = text.trim();
  const pendingMatches = pending.filter((o) => !typed || o.name.toLowerCase().includes(typed.toLowerCase()));
  const exists = [...options, ...pending].some((o) => o.name.trim().toLowerCase() === typed.toLowerCase());
  const canCreate = !!onCreate && typed.length > 0 && !exists && !(selected && text === selected.name);

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setText(selected?.name ?? "");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [selected?.name]);

  function pick(o: Option) {
    onChange(o.id);
    setText(o.name);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setText(selected?.name ?? "");
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        className="field pr-9 disabled:bg-canvas"
        placeholder={placeholder}
        value={text}
        onFocus={(e) => { setOpen(true); setActive(0); e.target.select(); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); if (value) onChange(""); }}
        onKeyDown={onKey}
      />
      {/* ช่องซ่อนให้ฟอร์มตรวจว่าเลือกแล้ว */}
      {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} className="absolute inset-x-0 bottom-0 h-0 opacity-0 pointer-events-none" />}
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5768" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      {open && !disabled && (
        <ul id={listId} role="listbox" className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-white shadow-lg py-1">
          {filtered.length === 0 && pendingMatches.length === 0 && !canCreate && <li className="px-3.5 py-2.5 text-sm text-muted">{emptyText}</li>}
          {filtered.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3.5 py-2.5 text-[15px] cursor-pointer ${i === active ? "bg-brand-soft" : ""} ${o.id === value ? "font-semibold text-[#1446A0]" : ""}`}
            >
              {o.name}
            </li>
          ))}
          {pendingMatches.map((o) => (
            <li key={o.id} role="option" aria-disabled="true" aria-selected={false} className="px-3.5 py-2.5 text-[15px] text-muted cursor-not-allowed flex justify-between gap-2">
              <span>{o.name}</span>
              <span className="text-xs font-semibold text-[#7A4A00] bg-[#FFF3E6] rounded-full px-2 py-0.5 shrink-0">รออนุมัติ</span>
            </li>
          ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); onCreate!(typed); }}
              className="px-3.5 py-2.5 text-[15px] cursor-pointer text-brand font-semibold border-t border-line hover:bg-brand-soft"
            >
              + {createLabel} “{typed}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
