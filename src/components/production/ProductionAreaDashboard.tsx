import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BarChart3, Pencil, Target, X } from "lucide-react";
import { saveProductionAreaGoals, subscribeToProductionAreaGoals } from "../../lib/firestore";
import type { ProductionAreaGoals, ProductionOrder, SystemUser } from "../../types";
import { formatAreaM2, getParaguayDayKey, getProductionAreaHistory, getProductionAreaReport, type ProductionAreaPeriod } from "../../utils/productionArea";

const emptyGoals: ProductionAreaGoals = { dailyM2: 0, weeklyM2: 0, monthlyM2: 0 };

export default function ProductionAreaDashboard({ orders, workers, canEditGoals }: { orders: ProductionOrder[]; workers: SystemUser[]; canEditGoals: boolean }) {
  const [goals, setGoals] = useState<ProductionAreaGoals>(emptyGoals);
  const [selectedUid, setSelectedUid] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState<ProductionAreaPeriod>("day");
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ dailyM2: "", weeklyM2: "", monthlyM2: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToProductionAreaGoals(selectedUid, setGoals, (loadError) => setError(loadError.message)), [selectedUid]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const report = useMemo(() => getProductionAreaReport(orders, now, selectedUid || undefined), [orders, now, selectedUid]);
  const workshopReport = useMemo(() => getProductionAreaReport(orders, now), [orders, now]);
  const history = useMemo(() => getProductionAreaHistory(report.completions, historyPeriod).slice(0, 12), [report.completions, historyPeriod]);
  const periods = [
    { label: "Hoy", value: report.todayM2, goal: selectedUid ? goals.dailyM2 : 0 },
    { label: "Esta semana", value: report.weekM2, goal: selectedUid ? goals.weeklyM2 : 0 },
    { label: "Este mes", value: report.monthM2, goal: selectedUid ? goals.monthlyM2 : 0 }
  ];
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const today = getParaguayDayKey(now);
    const [year, month, day] = today.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day - (6 - index)));
    const key = date.toISOString().slice(0, 10);
    return { key, label: date.toLocaleDateString("es-PY", { timeZone: "UTC", weekday: "short", day: "2-digit" }), area: report.daily.get(key) ?? 0 };
  }), [now, report.daily]);
  const maxDayArea = Math.max(1, ...days.map((item) => item.area));

  function startEditing() {
    setDraft({
      dailyM2: goals.dailyM2 ? String(goals.dailyM2) : "",
      weeklyM2: goals.weeklyM2 ? String(goals.weeklyM2) : "",
      monthlyM2: goals.monthlyM2 ? String(goals.monthlyM2) : ""
    });
    setError("");
    setEditing(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const parse = (value: string) => value.trim() ? Number(value.replace(",", ".")) : 0;
    const next = { dailyM2: parse(draft.dailyM2), weeklyM2: parse(draft.weeklyM2), monthlyM2: parse(draft.monthlyM2) };
    if (Object.values(next).some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Ingresá metas válidas en m². Dejá en blanco lo que todavía no esté definido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveProductionAreaGoals(selectedUid, next);
      setGoals((current) => ({ ...current, ...next }));
      setEditing(false);
      setMessage("Metas de taller guardadas.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las metas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-soft sm:p-5" aria-labelledby="production-area-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase text-next-blue"><BarChart3 className="h-4 w-4" aria-hidden="true" /> Rendimiento del taller</p>
          <h2 id="production-area-title" className="mt-1 text-xl font-black text-next-text">Metros cuadrados producidos</h2>
          <p className="mt-1 text-xs font-semibold text-next-muted">Cada unidad terminada se acredita al usuario que la marca. Fechas de Paraguay; semana de lunes a domingo.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-black uppercase text-next-muted">Encargado
            <select className="field mt-1 min-w-48" value={selectedUid} onChange={(event) => { setSelectedUid(event.target.value); setGoals(emptyGoals); setEditing(false); setMessage(""); setError(""); }}>
              <option value="">Todo el taller</option>
              {workers.map((worker) => <option key={worker.uid} value={worker.uid}>{worker.nombre}</option>)}
            </select>
          </label>
          {canEditGoals && selectedUid && !editing ? <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={startEditing}><Pencil className="h-4 w-4" aria-hidden="true" /> Configurar metas</button> : null}
        </div>
      </div>

      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-next-red" role="alert">{error}</p> : null}
      {message ? <p className="mt-3 rounded-lg bg-green-50 p-3 text-xs font-semibold text-next-green" role="status">{message}</p> : null}

      {editing ? (
        <form className="mt-4 rounded-xl bg-next-bg p-4" onSubmit={(event) => void submit(event)}>
          <p className="text-xs font-black uppercase text-next-text">Objetivos de {workers.find((worker) => worker.uid === selectedUid)?.nombre ?? "este encargado"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(["dailyM2", "weeklyM2", "monthlyM2"] as const).map((key) => (
              <label key={key} className="text-xs font-bold text-next-muted">{key === "dailyM2" ? "Meta diaria" : key === "weeklyM2" ? "Meta semanal" : "Meta mensual"} (m²)
                <input className="field mt-1" type="text" inputMode="decimal" value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} placeholder="Sin definir" />
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-black text-next-muted" type="button" disabled={saving} onClick={() => setEditing(false)}><X className="h-4 w-4" /> Cancelar</button>
            <button className="h-9 rounded-lg bg-next-blue px-4 text-xs font-black text-white disabled:opacity-50" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar metas"}</button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {periods.map((period) => {
          const percentage = period.goal > 0 ? Math.min(100, Math.round(period.value / period.goal * 100)) : 0;
          return <div key={period.label} className="rounded-xl border border-slate-200 bg-next-bg p-4">
            <p className="text-xs font-black uppercase text-next-muted">{period.label}</p>
            <p className="mt-1 text-2xl font-black text-next-text">{formatAreaM2(period.value)} <span className="text-sm text-next-muted">m²</span></p>
            <p className="mt-1 text-xs font-semibold text-next-muted">{period.goal > 0 ? `Meta: ${formatAreaM2(period.goal)} m² · ${Math.round(period.value / period.goal * 100)}%` : selectedUid ? "Meta pendiente de definir" : "Elegí un encargado para ver su meta"}</p>
            {period.goal > 0 ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`Meta ${period.label.toLowerCase()}`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-next-blue" style={{ width: `${percentage}%` }} /></div> : null}
          </div>;
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-black uppercase text-next-muted">Últimos 7 días</p>
          <div className="mt-3 grid grid-cols-7 items-end gap-2" aria-label="Metros cuadrados por día">
            {days.map((day) => <div key={day.key} className="min-w-0 text-center" title={`${day.key}: ${formatAreaM2(day.area)} m²`}><p className="mb-1 truncate text-[10px] font-bold text-next-muted">{formatAreaM2(day.area)}</p><div className="flex h-20 items-end rounded-md bg-slate-100"><div className="w-full rounded-md bg-next-blue" style={{ height: `${day.area > 0 ? Math.max(8, day.area / maxDayArea * 100) : 0}%` }} /></div><p className="mt-1 truncate text-[10px] font-bold capitalize text-next-muted">{day.label}</p></div>)}
          </div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-next-blue"><Target className="h-4 w-4" /> Órdenes actuales</p>
          <p className="mt-2 text-sm font-bold text-next-text">{formatAreaM2(workshopReport.finishedM2)} de {formatAreaM2(workshopReport.plannedM2)} m² terminados</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-next-muted">El total de órdenes incluye avances anteriores. Los períodos diarios, semanales y mensuales solo incluyen terminaciones registradas desde esta función.</p>
          {workshopReport.unitsWithoutArea > 0 ? <p className="mt-2 text-xs font-bold text-next-orange">{workshopReport.unitsWithoutArea} unidad{workshopReport.unitsWithoutArea === 1 ? "" : "es"} sin medidas o m² manuales; no se cuenta{workshopReport.unitsWithoutArea === 1 ? "" : "n"} en el área.</p> : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase text-next-muted">Historial de producción</p><p className="mt-1 text-xs font-semibold text-next-muted">Últimos períodos con actividad{selectedUid ? ` de ${workers.find((worker) => worker.uid === selectedUid)?.nombre ?? "este encargado"}` : " del taller"}.</p></div>
          <div className="inline-flex rounded-lg bg-next-bg p-1" aria-label="Agrupar historial">
            {(["day", "week", "month"] as const).map((period) => <button key={period} className={`rounded-md px-3 py-2 text-xs font-black ${historyPeriod === period ? "bg-white text-next-blue shadow-sm" : "text-next-muted"}`} type="button" aria-pressed={historyPeriod === period} onClick={() => setHistoryPeriod(period)}>{period === "day" ? "Días" : period === "week" ? "Semanas" : "Meses"}</button>)}
          </div>
        </div>
        {history.length ? <div className="mt-3 divide-y divide-slate-100">{history.map((item) => <div key={item.key} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-semibold text-next-text">{historyPeriod === "week" ? `Semana del ${item.key}` : historyPeriod === "month" ? `Mes ${item.key}` : item.key}</span><span className="font-black text-next-blue">{formatAreaM2(item.areaM2)} m²</span></div>)}</div> : <p className="mt-3 text-xs font-semibold text-next-muted">Todavía no hay unidades terminadas con registro de m² para esta selección.</p>}
      </div>
    </section>
  );
}
