import type { LucideIcon } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: string;
  onClick?: () => void;
};

const toneClasses: Record<string, string> = {
  blue: "bg-next-light text-next-blue",
  green: "bg-green-50 text-next-green",
  orange: "bg-orange-50 text-next-orange",
  red: "bg-red-50 text-next-red"
};

export default function KpiCard({ label, value, icon: Icon, tone = "blue", onClick }: KpiCardProps) {
  const content = (
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
  );
  const card = "rounded-lg border border-slate-200 bg-white p-4 shadow-soft";
  if (onClick) return <button type="button" onClick={onClick} className={`${card} w-full text-left transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200`} aria-label={`${label}: ${value}. Ver detalle`}>
    {content}<span className="mt-3 block text-xs font-bold text-next-blue">Ver detalle →</span>
  </button>;
  return <article className={card}>{content}</article>;
}
