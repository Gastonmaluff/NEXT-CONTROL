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
import MonthlySalesDialog from "../components/dashboard/MonthlySalesDialog";
import ActualMetricDialog, { type ActualMetric } from "../components/dashboard/ActualMetricDialog";
import DashboardMetricDialog, { type DashboardMetric } from "../components/dashboard/DashboardMetricDialog";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import NewWorkWizard from "../components/work/NewWorkWizard";
import { useAuth } from "../context/AuthContext";
import {
  getCobrosByObra,
  getCheques,
  getMovementsByWork,
  getCuadrillas,
  getObras,
} from "../lib/firestore";
import { canCreateWork, canManageFinancesForUser, canViewFinancials, canViewModule } from "../lib/roles";
import type { Cobro, Cuadrilla, Obra, Cheque, FinancialMovement } from "../types";
import { formatCurrencyPYG, formatDateShort } from "../utils/formatters";
import { getFinancialStatus } from "../utils/finances";
import { calculateWeightedProgress } from "../utils/progress";
import { getCompletedInstallationUnits, periodBounds, type InstallationUnit } from "../utils/installationUnits";
import { loadInstallationGoals, loadInstallationUnits } from "../lib/installationRepository";
import { createCashForecast, loadCashForecast, retireCashForecast } from "../lib/cashForecast";
import { businessDay, getCashLines, getForecastLines, getWorkResults, type CashForecast } from "../utils/controlActual";
import { calculateMonthlyDashboardTotals, getCurrentDashboardMonth, getMonthlySalesWorks, getMonthlyReceipts, isDashboardMonth } from "../utils/dashboard";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [movements, setMovements] = useState<FinancialMovement[]>([]); const [cheques, setCheques] = useState<Cheque[]>([]); const [forecasts, setForecasts] = useState<CashForecast[]>([]);
  const [installationUnits, setInstallationUnits] = useState<InstallationUnit[]>([]); const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [financeError, setFinanceError] = useState(""); const [installError, setInstallError] = useState("");
  const [financeReady, setFinanceReady] = useState(false); const [installReady, setInstallReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newWorkOpen, setNewWorkOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [openMetric, setOpenMetric] = useState<DashboardMetric | null>(null); const [actualMetric, setActualMetric] = useState<ActualMetric | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentDashboardMonth());

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

  useEffect(() => {
    if (!profile?.active || !obras.length && loading) return;
    let cancelled = false;
    setFinanceReady(false); setInstallReady(false); setFinanceError(""); setInstallError("");
    if (canManageFinancesForUser(profile) && canViewFinancials(profile)) {
      void Promise.all([Promise.all(obras.map(work => getMovementsByWork(work.id))).then(values => values.flat()), getCheques(), loadCashForecast(profile)])
        .then(([items, checks, plans]) => { if (!cancelled) { setMovements(items); setCheques(checks); setForecasts(plans); setFinanceReady(true); } })
        .catch(e => { if (!cancelled) setFinanceError(e instanceof Error ? e.message : "No se pudieron cargar los datos financieros."); });
    } else setFinanceError("Tu usuario no tiene acceso a estos datos financieros.");
    if (profile.role === "admin") {
      void Promise.all([loadInstallationUnits(profile), loadInstallationGoals()])
        .then(([items, goals]) => { if (!cancelled) { setInstallationUnits(items); setWeekStartsOn(goals.weekStartsOn ?? 1); setInstallReady(true); } })
        .catch(e => { if (!cancelled) setInstallError(e instanceof Error ? e.message : "No se pudieron cargar las instalaciones."); });
    } else setInstallError("El resumen completo de instalaciones requiere acceso de administrador.");
    return () => { cancelled = true; };
  }, [profile?.uid, profile?.role, profile?.active, profile?.permissions?.canViewFinancials, obras, loading]);
  const today = businessDay();
  const cash = useMemo(() => getCashLines(movements, cheques, today), [movements, cheques, today]);
  const monthCash = cash.lines.filter(line => line.date.slice(0, 7) === selectedMonth);
  const income = monthCash.filter(line => line.direction === "ingreso").reduce((sum, line) => sum + line.amount, 0);
  const expense = monthCash.filter(line => line.direction === "egreso").reduce((sum, line) => sum + line.amount, 0);
  const forecast = useMemo(() => getForecastLines(cheques, forecasts, today, movements), [cheques, forecasts, today, movements]);
  const forecastIncome = forecast.lines.filter(line => line.direction === "ingreso").reduce((sum, line) => sum + line.amount, 0);
  const forecastExpense = forecast.lines.filter(line => line.direction === "egreso").reduce((sum, line) => sum + line.amount, 0);
  const workResults = useMemo(() => getWorkResults(obras, movements), [obras, movements]);
  const availableResults = workResults.filter(row => row.available);
  const week = periodBounds("semana", new Date(), weekStartsOn);
  const validatedUnits = getCompletedInstallationUnits(installationUnits, "validado", week.start, week.end);
  const completedUnits = validatedUnits.filter(unit => unit.measure === "m2");
  const installedM2 = completedUnits.reduce((sum, unit) => sum + unit.value, 0);
  const financialValue = (value: number) => financeReady ? formatCurrencyPYG(value) : "No disponible";
  const installationValue = installReady ? `${installedM2.toLocaleString("es-PY", {maximumFractionDigits: 2})} m²` : "No disponible";
  const metrics = useMemo(() => {
    const activeObras = obras.filter((obra) => !["Finalizada", "Cobrado"].includes(obra.estado));
    const monthlyTotals = calculateMonthlyDashboardTotals(obras, cobros, selectedMonth);
    const saldoPendiente = obras.reduce((sum, obra) => sum + obra.saldoPendienteCobro, 0);
    const atrasadas = obras.filter((obra) => obra.estado === "Atrasada");
    const pendienteProduccion = obras.filter((obra) =>
      obra.etapasProduccion.some((stage) => stage.estado !== "Completado")
    ).length;

    return {
      activeObras,
      totalMonto: monthlyTotals.ventas,
      totalCobrado: income,
      saldoPendiente,
      atrasadas,
      pendienteProduccion,
      utilidadEstimada: availableResults.reduce((sum, row) => sum + row.result, 0),
      margenBajo: obras.filter((obra) => getFinancialStatus(obra) === "Margen bajo").length,
      m2InstaladosSemana: installedM2,
      flujoProyectado: forecastIncome - forecastExpense
    };
  }, [cobros, obras, selectedMonth, income, installedM2, forecastIncome, forecastExpense, availableResults]);

  const monthlyReceipts = useMemo(() => getMonthlyReceipts(cobros, selectedMonth), [cobros, selectedMonth]);
  const monthlySalesWorks = useMemo(() => getMonthlySalesWorks(obras, selectedMonth), [obras, selectedMonth]);

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
          <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => setNewWorkOpen(true)}>
            Nueva obra
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-next-red">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-next-green">
          {message}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label htmlFor="control-month" className="text-sm font-bold text-next-text">Mes de ventas y cobros</label>
          <p className="mt-1 text-xs leading-5 text-next-muted">
            Ventas por fecha de inicio de la obra; cobros por fecha real. Los saldos y las alertas son generales.
          </p>
        </div>
        <input
          id="control-month"
          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-next-text sm:w-auto"
          type="month"
          required
          min="0001-01"
          max="9999-12"
          value={selectedMonth}
          onChange={(event) => {
            if (isDashboardMonth(event.target.value)) setSelectedMonth(event.target.value);
          }}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ventas del mes" value={formatCurrencyPYG(metrics.totalMonto)} icon={Receipt} onClick={canViewFinancials(profile) ? () => setSalesOpen(true) : undefined} />
        <KpiCard label="Cobrado del mes" value={financialValue(metrics.totalCobrado)} icon={Receipt} tone="green" onClick={canViewFinancials(profile) ? () => setActualMetric("receipts") : undefined} />
        <KpiCard label="Cuentas por cobrar" value={formatCurrencyPYG(metrics.saldoPendiente)} icon={CalendarClock} tone="orange" onClick={canViewFinancials(profile) ? () => setOpenMetric("receivable") : undefined} />
        <KpiCard label="Flujo previsto 30 días" value={!financeReady ? "No disponible" : forecast.lines.length ? formatCurrencyPYG(metrics.flujoProyectado) : forecast.issues.length ? "Revisar previsiones" : "Sin previsiones"} icon={BarChart3} onClick={canViewFinancials(profile) ? () => setActualMetric("forecast") : undefined} />
        <KpiCard label="Obras atrasadas" value={`${metrics.atrasadas.length}`} icon={CalendarClock} tone="red" onClick={() => setOpenMetric("late")} />
        <KpiCard label="Produccion pendiente" value={`${metrics.pendienteProduccion} obras`} icon={Factory} tone="orange" onClick={() => setOpenMetric("production")} />
        <KpiCard label="m² instalados esta semana" value={installationValue} icon={Truck} tone="green" onClick={() => setActualMetric("installed")} />
        <KpiCard label="Resultado parcial por obra" value={!financeReady ? "No disponible" : availableResults.length ? formatCurrencyPYG(metrics.utilidadEstimada) : "Sin costos registrados"} icon={BarChart3} tone="green" onClick={canViewFinancials(profile) ? () => setActualMetric("profit") : undefined} />
        <KpiCard label="Caja neta del mes" value={financialValue(income - expense)} icon={BarChart3} onClick={canViewFinancials(profile) ? () => setActualMetric("cash") : undefined} />
      </section>

      {financeReady && (cash.issues.length > 0 || monthlyReceipts.length > 0 || forecast.issues.length > 0 || forecast.overdue.length > 0 || workResults.some(item => !item.available)) && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Algunos datos requieren revisión o están incompletos. Abrí los indicadores para ver qué registros faltan o no se sumaron.</p>}

      {salesOpen && canViewFinancials(profile) && <MonthlySalesDialog month={selectedMonth} works={monthlySalesWorks} total={metrics.totalMonto} canOpenWork={canViewModule(profile, "finanzas_obras")} error={error} onClose={() => setSalesOpen(false)} />}
      {actualMetric && (actualMetric === "installed" || canViewFinancials(profile)) && <ActualMetricDialog kind={actualMetric} month={selectedMonth} today={today} works={obras} canOpenFinance={canViewModule(profile, "finanzas_obras")} cash={cash} monthCash={monthCash} income={income} expense={expense} forecast={forecast} forecastIncome={forecastIncome} forecastExpense={forecastExpense} workResults={workResults} completedUnits={completedUnits} nonAreaCount={validatedUnits.length - completedUnits.length} installedM2={installedM2} week={week} financeReady={financeReady} financeError={financeError} installReady={installReady} installError={installError} legacyCount={monthlyReceipts.length} onClose={() => setActualMetric(null)} onCreateForecast={async (data, id) => { if (!profile) throw new Error("Falta el usuario."); await createCashForecast(profile, data, id); setForecasts(await loadCashForecast(profile)); }} onRetireForecast={async id => { if (!profile) throw new Error("Falta el usuario."); await retireCashForecast(profile, id); setForecasts(await loadCashForecast(profile)); }} />}
      {openMetric && (!["receipts", "receivable", "forecast", "profit"].includes(openMetric) || canViewFinancials(profile)) && <DashboardMetricDialog kind={openMetric} month={selectedMonth} works={obras} receipts={monthlyReceipts} installedEntries={[]} totalReceipts={metrics.totalCobrado} totalReceivable={metrics.saldoPendiente} totalInstalled={metrics.m2InstaladosSemana} canOpenFinance={canViewFinancials(profile) && canViewModule(profile, "finanzas_obras")} canOpenWork={canViewModule(profile, "avance_obras")} error={error} onClose={() => setOpenMetric(null)} />}


      <section className="grid gap-5 xl:grid-cols-2">
        <DataCard title="Avance operativo" subtitle="Fiscalizacion, produccion, instalacion y cuadrillas.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Obras atrasadas" value={`${metrics.atrasadas.length}`} />
            <Metric label="m² instalados esta semana" value={installationValue} />
            <Metric label="Produccion pendiente" value={`${metrics.pendienteProduccion} obras`} />
            <Metric label="Cuadrillas activas" value={`${cuadrillas.filter((crew) => crew.estado !== "Disponible").length}`} />
          </div>
        </DataCard>

        <DataCard title="Finanzas" subtitle="Caja, rentabilidad y margen por obra.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Ventas del mes" value={formatCurrencyPYG(metrics.totalMonto)} />
            <Metric label="Cobrado del mes" value={financialValue(metrics.totalCobrado)} />
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

      {newWorkOpen ? (
        <NewWorkWizard
          defaultDestination="control"
          onClose={() => setNewWorkOpen(false)}
          onCreated={(obra, destination, notice) => {
            setNewWorkOpen(false);
            setMessage(notice ?? "Obra creada correctamente.");
            if (destination === "avance") navigate(`/avance-obras/${obra.id}`);
            if (destination === "finanzas") navigate(`/finanzas-obras/${obra.id}`);
            if (destination === "control") setObras((current) => [obra, ...current]);
          }}
        />
      ) : null}
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
