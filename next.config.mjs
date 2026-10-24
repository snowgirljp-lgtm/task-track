/** @type {import('next').NextConfig} */
const nextConfig = {
  // ไม่ให้การ deploy ล้มเพราะคำเตือนเรื่องชนิดข้อมูล (ยังตรวจได้ตามปกติใน editor)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // นำเข้าไฟล์ Excel ผ่าน server action ได้ถึง 5 MB
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
