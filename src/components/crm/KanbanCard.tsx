import { CalendarClock } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";

type OpportunityPriority = "Alta" | "Media" | "Baja";

type KanbanCardProps = {
  project: string;
  client: string;
  amount: string;
  followUp: string;
  priority: OpportunityPriority;
};

const priorityStatus = {
  Alta: "critical",
  Media: "warning",
  Baja: "neutral"
} as const;

export default function KanbanCard({
  project,
  client,
  amount,
  followUp,
  priority
}: KanbanCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-black text-next-text">{project}</h3>
          <p className="mt-1 text-xs font-semibold text-next-muted">{client}</p>
        </div>
        <StatusBadge label={priority} status={priorityStatus[priority]} />
      </div>
      <p className="mt-4 text-sm font-black text-next-blue">{amount}</p>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-next-muted">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        <span>{followUp}</span>
      </div>
    </article>
  );
}
