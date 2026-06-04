import type { LucideIcon } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: string;
};

const toneClasses: Record<string, string> = {
  blue: "bg-next-light text-next-blue",
  green: "bg-green-50 text-next-green",
  orange: "bg-orange-50 text-next-orange",
  red: "bg-red-50 text-next-red"
};

export default function KpiCard({ label, value, icon: Icon, tone = "blue" }: KpiCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-next-muted">{label}</p>
          <p className="mt-3 max-w-full whitespace-nowrap text-[clamp(1rem,1.35vw,1.5rem)] font-black leading-none tracking-normal text-next-text">
            {value}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
            toneClasses[tone] ?? toneClasses.blue
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
