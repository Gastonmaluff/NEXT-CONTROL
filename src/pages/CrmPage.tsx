import KanbanColumn from "../components/crm/KanbanColumn";
import DataCard from "../components/ui/DataCard";
import KpiCard from "../components/ui/KpiCard";
import { crmKpis, followUpAgenda, pipeline, salesAdvisors } from "../data/mockData";

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase text-next-blue">Comercial</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal">CRM DE OBRAS</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {crmKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[1180px] gap-4">
            {pipeline.map((column) => (
              <KanbanColumn key={column.title} {...column} />
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <DataCard title="Agenda de seguimiento">
            <div className="space-y-3">
              {followUpAgenda.map((item) => (
                <div
                  key={`${item.time}-${item.title}`}
                  className="rounded-md bg-next-bg px-3 py-3"
                >
                  <p className="text-xs font-black text-next-blue">{item.time}</p>
                  <p className="mt-1 text-sm font-bold text-next-text">{item.title}</p>
                </div>
              ))}
            </div>
          </DataCard>

          <DataCard title="Asesores comerciales">
            <div className="space-y-3">
              {salesAdvisors.map((advisor) => (
                <div
                  key={advisor.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-black text-next-text">{advisor.name}</p>
                    <p className="text-xs font-semibold text-next-muted">
                      {advisor.deals} oportunidades
                    </p>
                  </div>
                  <p className="text-sm font-black text-next-blue">{advisor.value}</p>
                </div>
              ))}
            </div>
          </DataCard>
        </aside>
      </section>
    </div>
  );
}
