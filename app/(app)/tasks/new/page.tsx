import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { loadMasterData } from "@/lib/masterData";
import TaskForm from "@/components/TaskForm";
import { Back } from "@/components/icons";

export default async function NewTaskPage() {
  const profile = await requireProfile();
  const data = await loadMasterData();
  // Admin เลือกได้ทุกแผนก / คนอื่นเลือกได้เฉพาะแผนกที่สังกัด
  const departmentChoices = data.departments.filter(
    (d) => d.is_active && (profile.role === "admin" || (profile.department_ids ?? []).includes(d.id))
  );
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href="/" aria-label="ย้อนกลับ" className="w-11 h-11 rounded-xl flex items-center justify-center -ml-2"><Back /></Link>
        <h1 className="text-2xl font-bold">แจ้งปัญหาใหม่</h1>
      </div>
      {data.companies.filter((c) => c.is_active && (!c.approval || c.approval === "approved")).length === 0 && (
        <div className="card p-4 text-sm text-muted">ยังไม่มีบริษัทในระบบ — พิมพ์ชื่อในช่องบริษัทแล้วกด “ขอเพิ่มบริษัท” เพื่อส่งให้ Admin อนุมัติ</div>
      )}
      <TaskForm {...data} departmentChoices={departmentChoices} />
    </div>
  );
}
