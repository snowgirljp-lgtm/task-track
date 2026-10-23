import Link from "next/link";

export const metadata = { title: "นโยบายความเป็นส่วนตัว – Task Track" };

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-5 leading-relaxed">
      <h1 className="text-2xl font-bold">นโยบายความเป็นส่วนตัว</h1>
      <p className="text-sm text-muted">Task Track · ปรับปรุงล่าสุด ตุลาคม 2569</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">ระบบนี้คืออะไร</h2>
        <p>
          Task Track เป็นระบบภายในสำหรับแจ้งปัญหาและติดตามสถานะงาน ใช้ได้เฉพาะผู้ที่ผู้ดูแลระบบ (Admin)
          ลงทะเบียนไว้เท่านั้น
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">ข้อมูลที่เราเก็บ</h2>
        <ul className="list-disc pl-6">
          <li>ชื่อและอีเมลจากบัญชี Google ที่ใช้เข้าระบบ</li>
          <li>ข้อมูลงานที่ผู้ใช้กรอก เช่น หัวข้อ รายละเอียด รูปภาพ วิธีแก้</li>
          <li>ประวัติการแก้ไขงาน ว่าใครทำอะไร เมื่อไร</li>
        </ul>
        <p>เราไม่ขอสิทธิ์เข้าถึงอีเมล ไฟล์ หรือข้อมูลอื่นในบัญชี Google ของคุณ</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">เราใช้ข้อมูลอย่างไร</h2>
        <p>
          ใช้เพื่อยืนยันตัวตน แยกสิทธิ์ตามบทบาท แสดงงาน ส่งแจ้งเตือนในระบบ และทำรายงานภายในเท่านั้น
          ไม่ขาย ไม่แบ่งปัน และไม่ใช้เพื่อการโฆษณา
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">การจัดเก็บและความปลอดภัย</h2>
        <p>
          ข้อมูลเก็บในฐานข้อมูล Supabase ที่จำกัดสิทธิ์การเข้าถึงตามบทบาท รูปภาพเปิดดูได้เฉพาะผู้ที่เข้าระบบแล้ว
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">ติดต่อ</h2>
        <p>
          หากต้องการขอดู แก้ไข หรือลบข้อมูลของคุณ ติดต่อผู้ดูแลระบบที่{" "}
          <a href="mailto:snowgirl.jp@gmail.com" className="text-brand underline">snowgirl.jp@gmail.com</a>
        </p>
      </section>

      <Link href="/login" className="text-brand underline self-start">กลับหน้าเข้าสู่ระบบ</Link>
    </main>
  );
}
