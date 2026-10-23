import type { Role, Status, Urgency } from "./types";

export const STATUS: Record<Status, { label: string; cls: string }> = {
  pending: { label: "รอดำเนินการ", cls: "bg-[#EEF1F5] text-[#3D4756]" },
  in_progress: { label: "กำลังทำ", cls: "bg-[#DCE8FF] text-[#1446A0]" },
  review: { label: "รอตรวจ", cls: "bg-[#FFF1D6] text-[#7A4A00]" },
  redo: { label: "แก้ไขใหม่", cls: "bg-[#FFE2D6] text-[#9A360A]" },
  done: { label: "เสร็จแล้ว", cls: "bg-[#DDF3E6] text-[#17663A]" },
  cancelled: { label: "ยกเลิก", cls: "bg-[#E5E7EB] text-[#4B5563]" },
};

export const STATUS_ORDER: Status[] = ["pending", "in_progress", "review", "redo", "done", "cancelled"];

export const URGENCY: Record<Urgency, { label: string; cls: string }> = {
  low: { label: "ต่ำ", cls: "text-[#4B5768]" },
  medium: { label: "ปานกลาง", cls: "text-[#7A4A00]" },
  high: { label: "สูง", cls: "text-[#B42318]" },
};

export const ROLE: Record<Role, string> = {
  reporter: "ผู้แจ้งปัญหา",
  resolver: "ผู้แก้ปัญหา",
  admin: "Admin",
};

export const FIELD: Record<string, string> = {
  title: "หัวข้อ",
  detail: "รายละเอียด",
  category_id: "หมวดหมู่",
  urgency: "ความเร่งด่วน",
  company_id: "บริษัท",
  project_id: "โครงการ",
  due_date: "วันที่ครบกำหนดส่ง",
  solution: "วิธีแก้",
};

const TZ = "Asia/Bangkok";

export function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: TZ });
}

export function fmtDateTime(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayTH() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function isOverdue(due: string, status: Status) {
  return due < todayTH() && status !== "done" && status !== "cancelled";
}

/** ข้อความ error จากฐานข้อมูลให้อ่านง่าย */
export function friendlyError(msg?: string | null) {
  if (!msg) return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  if (/duplicate key|23505/i.test(msg)) return "ชื่อนี้มีอยู่แล้ว";
  if (/row-level security|permission denied/i.test(msg)) return "คุณไม่มีสิทธิ์ทำรายการนี้";
  return msg;
}
