import { CheckCircle2, Clock3, CircleDashed } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";

type ProductionItem = {
  label: string;
  status: "Completado" | "En proceso" | "Pendiente";
};

const statusMap = {
  Completado: { badge: "success", icon: CheckCircle2, color: "text-next-green" },
  "En proceso": { badge: "warning", icon: Clock3, color: "text-next-orange" },
  Pendiente: { badge: "neutral", icon: CircleDashed, color: "text-next-muted" }
} as const;

export default function ProductionChecklist({ items }: { items: ProductionItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const config = statusMap[item.status];
        const Icon = config.icon;
        return (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${config.color}`} aria-hidden="true" />
              <span className="truncate text-sm font-bold text-next-text">{item.label}</span>
            </div>
            <StatusBadge label={item.status} status={config.badge} />
          </li>
        );
      })}
    </ul>
  );
}
