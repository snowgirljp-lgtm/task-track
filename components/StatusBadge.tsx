import { STATUS } from "@/lib/labels";
import type { Status } from "@/lib/types";

export default function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={`inline-block text-[13px] font-semibold px-2.5 py-0.5 rounded-[10px] whitespace-nowrap ${s.cls} ${className}`}>
      {s.label}
    </span>
  );
}
