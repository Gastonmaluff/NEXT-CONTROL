import DataCard from "../components/ui/DataCard";
import KpiCard from "../components/ui/KpiCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import {
  activeCrews,
  cashflowBars,
  criticalWorks,
  dashboardKpis,
  dueDates,
  worksByStatus
} from "../data/mockData";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Centro de control</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-next-text">
            NEXT CONTROL
          </h1>
        </div>
        <p className="max-w-xl text-sm font-medium leading-6 text-next-muted">
          Dashboard gerencial para obras, producción, instalaciones, cobranzas y materiales.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
        <DataCard
          title="Flujo de caja proyectado 30 días"
          subtitle="Ingresos previstos por semana"
        >
          <div className="flex h-72 items-end gap-4 rounded-lg bg-next-light/45 px-4 pb-4 pt-8">
            {cashflowBars.map((bar) => (
              <div key={bar.label} className="flex h-full flex-1 flex-col justify-end gap-3">
                <div
                  className="flex min-h-10 items-start justify-center rounded-md bg-next-blue px-2 pt-3 text-center text-xs font-black text-white shadow-lg shadow-blue-900/10"
                  style={{ height: `${bar.value}%` }}
                >
                  {bar.amount}
                </div>
                <p className="text-center text-xs font-black text-next-muted">{bar.label}</p>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="Obras por estado" subtitle="Distribución operativa">
          <div className="space-y-5">
            {worksByStatus.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-next-text">{item.label}</p>
                    <p className="text-xs font-semibold text-next-muted">{item.value} obras</p>
                  </div>
                  <StatusBadge label={`${item.percent}%`} status={item.status} />
                </div>
                <ProgressBar
                  value={item.percent}
                  tone={item.status === "critical" ? "red" : item.status === "warning" ? "orange" : "blue"}
                />
              </div>
            ))}
          </div>
        </DataCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <DataCard title="Obras críticas">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-next-muted">
                <tr>
                  <th className="pb-3 font-black">Obra</th>
                  <th className="pb-3 font-black">Cliente</th>
                  <th className="pb-3 font-black">Estado</th>
                  <th className="pb-3 text-right font-black">Demora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criticalWorks.map((work) => (
                  <tr key={work.project}>
                    <td className="py-4 font-black text-next-text">{work.project}</td>
                    <td className="py-4 font-semibold text-next-muted">{work.client}</td>
                    <td className="py-4">
                      <StatusBadge label={work.status} status={work.badge} />
                    </td>
                    <td className="py-4 text-right font-black text-next-text">{work.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>

        <DataCard title="Próximos vencimientos">
          <div className="space-y-4">
            {dueDates.map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between gap-4 rounded-md bg-next-bg px-3 py-3"
              >
                <div>
                  <p className="text-sm font-black text-next-text">{item.title}</p>
                  <p className="text-xs font-semibold text-next-muted">{item.date}</p>
                </div>
                <p className="text-right text-sm font-black text-next-blue">{item.amount}</p>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="Cuadrillas activas hoy">
          <div className="space-y-4">
            {activeCrews.map((crew) => (
              <div key={crew.crew} className="rounded-md border border-slate-100 px-3 py-3">
                <p className="text-sm font-black text-next-text">{crew.crew}</p>
                <p className="mt-1 text-sm font-semibold text-next-muted">{crew.project}</p>
                <p className="mt-2 text-xs font-black uppercase text-next-blue">{crew.progress}</p>
              </div>
            ))}
          </div>
        </DataCard>
      </section>
    </div>
  );
}
