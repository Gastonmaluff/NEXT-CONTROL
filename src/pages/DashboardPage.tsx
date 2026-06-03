import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Factory,
  Receipt,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import KpiCard from "../components/ui/KpiCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import { getCobrosByObra, getCuadrillas, getObras } from "../lib/firestore";
import type { Cobro, Cuadrilla, Obra } from "../types";
import { formatCurrencyPYG, formatDateShort } from "../utils/formatters";
import { getFinancialStatus } from "../utils/finances";
import { calculateWeightedProgress } from "../utils/progress";

export default function DashboardPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const loadedObras = await getObras();
        const loadedCobros = (await Promise.all(
          loadedObras.map((obra) => getCobrosByObra(obra.id))
        )).flat();
        setObras(loadedObras);
        setCobros(loadedCobros);
        setCuadrillas(await getCuadrillas());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const metrics = useMemo(() => {
    const activeObras = obras.filter((obra) => !["Finalizada", "Cobrado"].includes(obra.estado));
    const totalMonto = obras.reduce((sum, obra) => sum + obra.montoAprobado, 0);
    const totalCobrado = cobros.reduce((sum, cobro) => sum + cobro.monto, 0);
    const saldoPendiente = obras.reduce((sum, obra) => sum + obra.saldoPendienteCobro, 0);
    const atrasadas = obras.filter((obra) => obra.estado === "Atrasada");
    const pendienteProduccion = obras.filter((obra) =>
      obra.etapasProduccion.some((stage) => stage.estado !== "Completado")
    ).length;

    return {
      activeObras,
      totalMonto,
      totalCobrado,
      saldoPendiente,
      atrasadas,
      pendienteProduccion,
      utilidadEstimada: Math.round(totalMonto * 0.18),
      margenBajo: obras.filter((obra) => getFinancialStatus(obra) === "Margen bajo").length,
      m2InstaladosSemana: 1256,
      flujoProyectado: saldoPendiente + Math.round(totalCobrado * 0.18)
    };
  }, [cobros, obras]);

  const statusRows = useMemo(() => {
    const total = Math.max(obras.length, 1);
    return Object.entries(
      obras.reduce<Record<string, number>>((acc, obra) => {
        acc[obra.estado] = (acc[obra.estado] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([label, value]) => ({
      label,
      value,
      percent: Math.round((value / total) * 100),
      status: getBadgeForStatus(label)
    }));
  }, [obras]);

  const upcoming = [...obras]
    .filter((obra) => obra.fechaEntrega)
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega))
    .slice(0, 3);

  if (loading) {
    return <StateCard text="Cargando control..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Centro de control</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-next-text">
            CONTROL
          </h1>
        </div>
        <p className="max-w-xl text-sm font-medium leading-6 text-next-muted">
          Centro de control gerencial para obras, finanzas, produccion e instalaciones.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-next-red">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ventas del mes" value={formatCurrencyPYG(metrics.totalMonto)} icon={Receipt} />
        <KpiCard label="Cobrado del mes" value={formatCurrencyPYG(metrics.totalCobrado)} icon={Receipt} tone="green" />
        <KpiCard label="Cuentas por cobrar" value={formatCurrencyPYG(metrics.saldoPendiente)} icon={CalendarClock} tone="orange" />
        <KpiCard label="Flujo proyectado 30 dias" value={formatCurrencyPYG(metrics.flujoProyectado)} icon={BarChart3} />
        <KpiCard label="Obras atrasadas" value={`${metrics.atrasadas.length}`} icon={CalendarClock} tone="red" />
        <KpiCard label="Produccion pendiente" value={`${metrics.pendienteProduccion} obras`} icon={Factory} tone="orange" />
        <KpiCard label="M2 instalados esta semana" value={`${metrics.m2InstaladosSemana} m2`} icon={Truck} tone="green" />
        <KpiCard label="Utilidad estimada" value={formatCurrencyPYG(metrics.utilidadEstimada)} icon={BarChart3} tone="green" />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DataCard title="Avance operativo" subtitle="Fiscalizacion, produccion, instalacion y cuadrillas.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Obras atrasadas" value={`${metrics.atrasadas.length}`} />
            <Metric label="M2 instalados esta semana" value={`${metrics.m2InstaladosSemana} m2`} />
            <Metric label="Produccion pendiente" value={`${metrics.pendienteProduccion} obras`} />
            <Metric label="Cuadrillas activas" value={`${cuadrillas.filter((crew) => crew.estado !== "Disponible").length}`} />
          </div>
        </DataCard>

        <DataCard title="Finanzas" subtitle="Caja, rentabilidad y margen por obra.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Ventas del mes" value={formatCurrencyPYG(metrics.totalMonto)} />
            <Metric label="Cobrado del mes" value={formatCurrencyPYG(metrics.totalCobrado)} />
            <Metric label="Cuentas por cobrar" value={formatCurrencyPYG(metrics.saldoPendiente)} />
            <Metric label="Obras con margen bajo" value={`${metrics.margenBajo}`} />
          </div>
        </DataCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
        <DataCard title="Obras por estado" subtitle="Distribucion operativa">
          <div className="space-y-5">
            {statusRows.length ? (
              statusRows.map((item) => (
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
              ))
            ) : (
              <EmptyState text="Todavia no hay obras cargadas." />
            )}
          </div>
        </DataCard>

        <DataCard title="Proximos vencimientos">
          <div className="space-y-4">
            {upcoming.map((obra) => (
              <div
                key={obra.id}
                className="flex items-center justify-between gap-4 rounded-md bg-next-bg px-3 py-3"
              >
                <div>
                  <p className="text-sm font-black text-next-text">{obra.nombre}</p>
                  <p className="text-xs font-semibold text-next-muted">{formatDateShort(obra.fechaEntrega)}</p>
                </div>
                <p className="text-right text-sm font-black text-next-blue">
                  {formatCurrencyPYG(obra.saldoPendienteCobro)}
                </p>
              </div>
            ))}
          </div>
        </DataCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DataCard title="Obras criticas">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-next-muted">
                <tr>
                  <th className="pb-3 font-black">Obra</th>
                  <th className="pb-3 font-black">Cliente</th>
                  <th className="pb-3 font-black">Avance</th>
                  <th className="pb-3 text-right font-black">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {obras
                  .filter((obra) => obra.estado === "Atrasada" || obra.saldoPendienteCobro > 0)
                  .slice(0, 6)
                  .map((obra) => (
                    <tr key={obra.id}>
                      <td className="py-4 font-black text-next-text">{obra.nombre}</td>
                      <td className="py-4 font-semibold text-next-muted">{obra.cliente}</td>
                      <td className="py-4 font-black text-next-blue">
                        {calculateWeightedProgress(obra.rubrosAvance)}%
                      </td>
                      <td className="py-4 text-right">
                        <StatusBadge label={obra.estado} status={getBadgeForStatus(obra.estado)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DataCard>

        <DataCard title="Cuadrillas activas hoy">
          <div className="space-y-4">
            {cuadrillas.map((crew) => {
              const obra = obras.find((item) => item.id === crew.obraId);
              return (
                <div key={crew.id} className="rounded-md border border-slate-100 px-3 py-3">
                  <p className="text-sm font-black text-next-text">{crew.nombre}</p>
                  <p className="mt-1 text-sm font-semibold text-next-muted">
                    {obra?.nombre ?? "Sin obra asignada"}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase text-next-blue">{crew.estado}</p>
                </div>
              );
            })}
          </div>
        </DataCard>
      </section>
    </div>
  );
}

function getBadgeForStatus(status: string): BadgeStatus {
  if (status === "Atrasada" || status === "Pausada") return "critical";
  if (status === "Prospecto" || status === "Presupuesto enviado" || status === "Seguimiento") return "warning";
  if (status === "Finalizada" || status === "Cobrado") return "success";
  if (status === "Produccion" || status === "Instalacion" || status === "Facturacion") return "info";
  return "neutral";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-next-bg px-3 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
    </div>
  );
}

function StateCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-next-muted shadow-soft">
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-next-bg px-4 py-8 text-center text-sm font-semibold text-next-muted">
      {text}
    </div>
  );
}
