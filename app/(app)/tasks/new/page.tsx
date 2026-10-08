import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { loadMasterData } from "@/lib/masterData";
import TaskForm from "@/components/TaskForm";
import { Back } from "@/components/icons";

export default async function NewTaskPage() {
  await requireProfile();
  const data = await loadMasterData();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href="/" aria-label="ย้อนกลับ" className="w-11 h-11 rounded-xl flex items-center justify-center -ml-2"><Back /></Link>
        <h1 className="text-2xl font-bold">แจ้งปัญหาใหม่</h1>
      </div>
      {data.companies.filter((c) => c.is_active).length === 0 ? (
        <div className="card p-6 text-muted">ยังไม่มีบริษัทในระบบ กรุณาให้ Admin เพิ่มบริษัทและโครงการก่อน</div>
      ) : (
        <TaskForm {...data} />
      )}
    </div>
  );
}
