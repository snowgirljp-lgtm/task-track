/** แสดงทันทีที่กดเปลี่ยนหน้า ระหว่างรอข้อมูล */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="กำลังโหลด">
      <div className="flex items-center gap-3">
        <span className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <span className="text-muted">กำลังโหลด...</span>
      </div>
      <div className="h-8 w-48 rounded-lg bg-line" />
      <div className="h-11 rounded-xl bg-white border border-line" />
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-32" />
        ))}
      </div>
    </div>
  );
}
