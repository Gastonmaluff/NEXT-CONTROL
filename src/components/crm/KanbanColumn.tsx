import KanbanCard from "./KanbanCard";

type Opportunity = {
  project: string;
  client: string;
  amount: string;
  followUp: string;
  priority: "Alta" | "Media" | "Baja";
};

type KanbanColumnProps = {
  title: string;
  opportunities: Opportunity[];
};

export default function KanbanColumn({ title, opportunities }: KanbanColumnProps) {
  return (
    <section className="flex min-h-[360px] min-w-[260px] flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-black text-next-text">{title}</h2>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-next-muted ring-1 ring-slate-200">
          {opportunities.length}
        </span>
      </div>
      <div className="space-y-3">
        {opportunities.map((opportunity) => (
          <KanbanCard key={opportunity.project} {...opportunity} />
        ))}
      </div>
    </section>
  );
}
