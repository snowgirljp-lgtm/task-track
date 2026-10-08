import { requireProfile } from "@/lib/auth";
import { ROLE } from "@/lib/labels";
import PasswordForm from "./PasswordForm";

export default async function ProfilePage() {
  const p = await requireProfile();
  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-bold">โปรไฟล์</h1>
      <section className="card p-5 flex flex-col gap-2">
        <div className="text-lg font-semibold">{p.full_name}</div>
        <div className="text-sm text-muted">{p.email}</div>
        <div><span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-[10px] bg-brand-soft text-[#1446A0]">{ROLE[p.role]}</span></div>
      </section>

      {p.role === "admin" && <PasswordForm />}

      <form action="/auth/signout" method="post">
        <button type="submit" className="btn btn-ghost w-full">ออกจากระบบ</button>
      </form>
    </div>
  );
}
