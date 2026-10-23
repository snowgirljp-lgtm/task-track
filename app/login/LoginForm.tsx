"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/icons";

export default function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function google() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
      setBusy(false);
    }
  }

  async function adminLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-[72px] h-[72px] rounded-[20px] bg-brand flex items-center justify-center">
            <Logo size={36} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Task Track</h1>
          <p className="text-muted">ระบบแจ้งปัญหาและติดตามสถานะงาน</p>
        </div>

        <div className="card p-6 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">เข้าสู่ระบบ</h2>
          <button type="button" onClick={google} disabled={busy} className="btn btn-ghost h-[52px] text-base">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f4fd1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
          <p className="text-sm text-muted leading-relaxed">
            ใช้ได้เฉพาะ Gmail ที่ Admin ลงทะเบียนไว้ หากเข้าไม่ได้ กรุณาติดต่อ Admin
          </p>

          {error && (
            <div role="alert" className="rounded-xl bg-[#FFF4E5] border border-[#F3D9A8] px-4 py-3 text-sm text-[#6B4300]">
              {error}
            </div>
          )}

          {showAdmin && (
            <form onSubmit={adminLogin} className="flex flex-col gap-3 border-t border-line pt-4">
              <div>
                <label htmlFor="email" className="label">อีเมล</label>
                <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="password" className="label">รหัสผ่าน</label>
                <input id="password" type="password" required autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={busy} className="btn btn-primary">เข้าสู่ระบบ</button>
            </form>
          )}
        </div>

        <button type="button" onClick={() => setShowAdmin((v) => !v)} className="text-sm text-brand hover:underline self-center min-h-11">
          {showAdmin ? "ซ่อนการเข้าด้วยรหัสผ่าน" : "สำหรับ Admin: เข้าด้วยอีเมลและรหัสผ่าน"}
        </button>
        <a href="/privacy" className="text-xs text-muted hover:underline self-center">นโยบายความเป็นส่วนตัว</a>
      </div>
    </main>
  );
}
