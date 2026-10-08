"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Admin ตั้งรหัสผ่านสำรอง ไว้เข้าระบบเมื่อเข้าด้วย Google ไม่ได้ */
export default function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, text: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
    if (pw !== pw2) return setMsg({ ok: false, text: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: "ตั้งรหัสผ่านไม่สำเร็จ: " + error.message });
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "ตั้งรหัสผ่านสำรองแล้ว" });
  }

  return (
    <form onSubmit={submit} className="card p-5 flex flex-col gap-3">
      <div>
        <h2 className="text-base font-bold">รหัสผ่านสำรอง (Admin)</h2>
        <p className="text-sm text-muted leading-relaxed">ใช้เข้าระบบด้วยอีเมลและรหัสผ่าน เผื่อวันที่เข้าด้วย Google ไม่ได้</p>
      </div>
      <div>
        <label htmlFor="pw" className="label">รหัสผ่านใหม่</label>
        <input id="pw" type="password" autoComplete="new-password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pw2" className="label">ยืนยันรหัสผ่าน</label>
        <input id="pw2" type="password" autoComplete="new-password" className="field" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      {msg && <div role="status" className={`text-sm ${msg.ok ? "text-[#17663A]" : "text-danger"}`}>{msg.text}</div>}
      <button type="submit" disabled={busy} className="btn btn-primary">บันทึกรหัสผ่าน</button>
    </form>
  );
}
