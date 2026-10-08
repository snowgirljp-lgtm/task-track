# Task Track

ระบบแจ้งปัญหาและติดตามสถานะงาน ใช้ได้ทั้งมือถือและคอม

- หน้าเว็บ: Next.js
- ฐานข้อมูล การเข้าระบบ และที่เก็บรูป: Supabase
- นำขึ้นออนไลน์: Vercel

---

## ขั้นตอนติดตั้ง (ทำครั้งเดียว)

### 1. สร้างฐานข้อมูลใน Supabase

1. เปิดโปรเจกต์ใน [supabase.com](https://supabase.com) → เมนู **SQL Editor** → **New query**
2. เปิดไฟล์ `supabase/migrations/0001_init.sql` คัดลอกทั้งไฟล์ไปวาง แล้วกด **Run**
3. ถ้าขึ้น `Success` แปลว่าเรียบร้อย ระบบจะสร้างตาราง สิทธิ์ ที่เก็บรูป และตั้ง **snowgirl.jp@gmail.com** เป็น Admin ให้แล้ว

> รันไฟล์นี้ครั้งเดียวเท่านั้น ถ้ารันซ้ำจะขึ้น error ว่ามีตารางอยู่แล้ว (ไม่เสียหาย)

### 2. เปิดการเข้าระบบด้วย Google

**2.1 สร้างกุญแจที่ Google**

1. ไปที่ [console.cloud.google.com](https://console.cloud.google.com) → สร้างโปรเจกต์ใหม่ (ชื่ออะไรก็ได้)
2. เมนู **APIs & Services** → **OAuth consent screen** → เลือก **External** → กรอกชื่อแอป `Task Track` และอีเมลของคุณ → บันทึก
3. เมนู **Credentials** → **Create credentials** → **OAuth client ID** → ชนิด **Web application**
4. ช่อง **Authorized redirect URIs** ใส่
   `https://<รหัสโปรเจกต์>.supabase.co/auth/v1/callback`
   (ดูรหัสโปรเจกต์ได้จาก Supabase → Project Settings → API → Project URL)
5. กด Create แล้วจด **Client ID** และ **Client secret** ไว้

**2.2 ใส่กุญแจใน Supabase**

1. Supabase → **Authentication** → **Sign In / Providers** → **Google** → เปิดใช้
2. วาง Client ID และ Client secret → Save
3. ตรวจว่า **Email** provider เปิดอยู่ด้วย (ใช้สำหรับรหัสผ่านสำรองของ Admin)

**2.3 (แนะนำ) ข้อความภาษาไทยเมื่อคนนอกพยายามเข้า**

Supabase → **Authentication** → **Hooks** → **Before User Created** → เลือก **Postgres** → schema `public` → function `hook_before_user_created` → Save

> ถ้าไม่ตั้งข้อนี้ คนนอกก็ยังเข้าไม่ได้อยู่ดี แค่ข้อความแจ้งจะไม่ละเอียดเท่า

### 3. นำขึ้นออนไลน์ด้วย Vercel

1. ไปที่ [vercel.com](https://vercel.com) → เข้าด้วยบัญชี GitHub → **Add New** → **Project** → เลือก repo นี้
2. ที่หัวข้อ **Environment Variables** เพิ่ม 2 ค่า (ดูได้จาก Supabase → Project Settings → API):

   | ชื่อ | ค่า |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key (หรือ publishable key) |

   ⚠️ ห้ามใช้ `service_role` key เด็ดขาด
3. กด **Deploy** รอประมาณ 2–3 นาที จะได้ลิงก์เว็บ เช่น `https://task-track-xxx.vercel.app`

### 4. บอก Supabase ว่าเว็บอยู่ที่ไหน

Supabase → **Authentication** → **URL Configuration**

- **Site URL**: ลิงก์เว็บจาก Vercel
- **Redirect URLs**: เพิ่ม `https://<ลิงก์เว็บ>/auth/callback`

### 5. เริ่มใช้งาน

1. เปิดเว็บ → กด **เข้าสู่ระบบด้วย Google** → เลือก snowgirl.jp@gmail.com
2. ไปที่ **จัดการข้อมูล** → เพิ่มบริษัท โครงการ และผู้ใช้ (ใส่ Gmail + ชื่อ + บทบาท)
3. ไปที่ **โปรไฟล์** → ตั้ง **รหัสผ่านสำรอง** ไว้ใช้วันที่เข้าด้วย Google ไม่ได้

---

## กติกาที่ระบบล็อกไว้ในฐานข้อมูล

ล็อกไว้ที่ฐานข้อมูลโดยตรง จึงไม่มีใครข้ามขั้นตอนได้ แม้จะเรียกจากนอกหน้าเว็บ

- เข้าระบบได้เฉพาะ Gmail ที่ Admin เพิ่มไว้ และยังไม่ถูกระงับ
- ลำดับสถานะ: รอดำเนินการ → กำลังทำ → รอตรวจ → เสร็จแล้ว / ตรวจไม่ผ่าน → แก้ไขใหม่ → กำลังทำ
- คนที่กด "กำลังทำ" จะถูกบันทึกเป็นผู้รับผิดชอบอัตโนมัติ
- ส่ง "รอตรวจ" ได้เมื่อกรอกวิธีแก้แล้วเท่านั้น
- เสร็จแล้ว / แก้ไขใหม่ / ยกเลิก กดได้เฉพาะ Admin และส่งแก้ไขใหม่ต้องมีเหตุผล
- งานที่เสร็จหรือยกเลิกแล้ว แก้ไขได้เฉพาะ Admin
- ทุกการเปลี่ยนแปลงถูกเก็บในประวัติ ลบหรือแก้ประวัติไม่ได้
- บริษัท โครงการ หมวดหมู่ ลบไม่ได้ ใช้ "ปิดใช้" แทน
- Admin ระงับหรือเปลี่ยนบทบาทของตัวเองไม่ได้ (กันล็อกตัวเองออก)
- รูปแนบได้สูงสุด 5 รูปต่องาน ระบบย่อรูปให้ก่อนอัปโหลด

## ส่งออกไฟล์ (เฉพาะ Admin)

- **Excel**: ปุ่ม "ส่งออก Excel" ในหน้าภาพรวมหรือหน้างานทั้งหมด ได้รายการงานตามตัวกรองที่เลือก
- **PDF**: ปุ่ม "ส่งออก PDF" (สรุปรวม) หรือปุ่ม "PDF" ในหน้ารายละเอียดงาน → หน้าต่างพิมพ์จะเปิดขึ้น → เลือก **บันทึกเป็น PDF**

---

## สำหรับนักพัฒนา

```bash
npm install
cp .env.example .env.local   # ใส่ค่า Supabase
npm run dev                  # เปิด http://localhost:3000
```

ถ้าทดสอบในเครื่อง ให้เพิ่ม `http://localhost:3000/auth/callback` ใน Redirect URLs ของ Supabase ด้วย

โครงสร้างหลัก

```
supabase/migrations/   ตาราง สิทธิ์ (RLS) และกติกาสถานะ
app/login/             หน้าเข้าสู่ระบบ
app/(app)/             หน้าหลังเข้าระบบ: งาน, แจ้งปัญหา, แจ้งเตือน, โปรไฟล์
app/(app)/admin/       ภาพรวม, รายงาน PDF, จัดการข้อมูล
app/api/export/        ส่งออก Excel
components/            ส่วนประกอบหน้าจอที่ใช้ร่วมกัน
lib/                   การเชื่อม Supabase, ข้อความ/สี, สิทธิ์
```
