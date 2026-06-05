import {
  BarChart3,
  CalendarClock,
  Factory,
  Receipt,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataCard from "../components/ui/DataCard";
import KpiCard from "../components/ui/KpiCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  getCobrosByObra,
  getCuadrillas,
  getObras,
  getProgressReportsByWork,
  getProgressRubricsByWork
} from "../lib/firestore";
import { canCreateWork } from "../lib/roles";
import type { Cobro, Cuadrilla, Obra, ProgressReport, WorkProgressRubric } from "../types";
import { formatCurrencyPYG, formatDateShort } from "../utils/formatters";
import { getFinancialStatus } from "../utils/finances";
import { calculateWeightedProgress } from "../utils/progress";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [progressRubrics, setProgressRubrics] = useState<WorkProgressRubric[]>([]);
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
        const [loadedReports, loadedRubrics] = await Promise.all([
          Promise.all(loadedObras.map((obra) => getProgressReportsByWork(obra.id))).then((items) => items.flat()),
          Promise.all(loadedObras.map((obra) => getProgressRubricsByWork(obra.id))).then((items) => items.flat())
        ]);
        setObras(loadedObras);
        setCobros(loadedCobros);
        setProgressReports(loadedReports);
        setProgressRubrics(loadedRubrics);
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
      utilidadEstimada: 0,
      margenBajo: obras.filter((obra) => getFinancialStatus(obra) === "Margen bajo").length,
      m2InstaladosSemana: calculateInstalledM2ThisWeek(progressReports, progressRubrics),
      flujoProyectado: saldoPendiente
    };
  }, [cobros, obras, progressReports, progressRubrics]);

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
        {canCreateWork(profile) ? (
          <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => navigate("/finanzas-obras")}>
            Nueva obra
          </button>
        ) : null}
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

function calculateInstalledM2ThisWeek(
  reports: ProgressReport[],
  rubrics: WorkProgressRubric[]
): number {
  const { start, end } = getCurrentWeekRange();
  const rubricsById = new Map(rubrics.map((rubro) => [rubro.id, rubro]));

  return Math.round(
    reports
      .filter((report) => isDateInRange(report.fecha, start, end) && !isCancelledReport(report))
      .flatMap((report) => report.entries)
      .reduce((total, entry) => {
        const executedToday = entry.cantidadEjecutadaHoy ?? 0;
        const rubric = rubricsById.get(entry.rubroId);

        if (executedToday <= 0 || !isInstalledSquareMeterRubric(rubric, entry.rubroNombre)) {
          return total;
        }

        return total + executedToday;
      }, 0)
  );
}

function getCurrentWeekRange() {
  const today = new Date();
  const start = new Date(today);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function isDateInRange(value: string, start: Date, end: Date) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function isCancelledReport(report: ProgressReport) {
  const status = `${report.observacionGeneral ?? ""} ${report.incidentes ?? ""}`.toLowerCase();
  return status.includes("cancelado") || status.includes("eliminado");
}

function isInstalledSquareMeterRubric(rubric: WorkProgressRubric | undefined, fallbackName: string) {
  const unit = normalizeText(rubric?.unidad ?? "");
  const name = normalizeText(rubric?.nombre ?? fallbackName);
  const isSquareMeter = unit === "m2" || unit === "m²" || unit.includes("metro cuadrado");
  const looksInstalled = name.includes("instalad") || name.includes("vidrio");
  const excluded = name.includes("sellado");

  return isSquareMeter && looksInstalled && !excluded;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
