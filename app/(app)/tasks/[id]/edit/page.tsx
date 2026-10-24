import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadMasterData } from "@/lib/masterData";
import { loadTaskImages } from "@/lib/images";
import TaskForm from "@/components/TaskForm";
import { Back } from "@/components/icons";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, code, title, detail, category_id, bill_type_id, urgency, company_id, project_id, due_date, status, doc_date, doc_no, po_no, amount, department_id")
    .eq("id", id)
    .maybeSingle();
  if (!task) notFound();
  if ((task.status === "done" || task.status === "cancelled") && profile.role !== "admin") redirect(`/tasks/${id}`);

  const [data, images] = await Promise.all([loadMasterData(), loadTaskImages(id, "problem")]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href={`/tasks/${id}`} aria-label="ย้อนกลับ" className="w-11 h-11 rounded-xl flex items-center justify-center -ml-2"><Back /></Link>
        <h1 className="text-2xl font-bold">แก้ไขงาน {task.code}</h1>
      </div>
      <TaskForm
        {...data}
        initial={task}
        images={images}
        departmentChoices={profile.role === "admin" ? data.departments.filter((d) => d.is_active || d.id === task.department_id) : []}
      />
    </div>
  );
}
