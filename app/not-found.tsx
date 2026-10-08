import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">ไม่พบหน้าที่ต้องการ</h1>
      <p className="text-muted">งานนี้อาจถูกลบ หรือลิงก์ไม่ถูกต้อง</p>
      <Link href="/" className="btn btn-primary">กลับหน้างานทั้งหมด</Link>
    </main>
  );
}
