import type { BadgeStatus } from "../../data/mockData";

type StatusBadgeProps = {
  label: string;
  status?: BadgeStatus;
};

const statusClasses: Record<BadgeStatus, string> = {
  success: "bg-green-50 text-next-green ring-green-100",
  warning: "bg-orange-50 text-next-orange ring-orange-100",
  critical: "bg-red-50 text-next-red ring-red-100",
  info: "bg-next-light text-next-blue ring-blue-100",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200"
};

export default function StatusBadge({ label, status = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusClasses[status]}`}
    >
      {label}
    </span>
  );
}
