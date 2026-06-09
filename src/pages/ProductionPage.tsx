import { CalendarDays, CheckCircle2, Factory, PackageCheck, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  createProgressActivity,
  getObras,
  getProgressRubricsByWork,
  updateProgressRubric
} from "../lib/firestore";
import type { Obra, ProductionItemStatus, WorkProgressRubric } from "../types";
import { formatDateShort } from "../utils/formatters";
import { formatUnitLabel } from "../utils/units";
import { getProductionRows, productionProgress, type ProductionWorkRow } from "../utils/workBreakdown";

const statusLabels: Record<ProductionItemStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  parcial: "Parcial",
  completado: "Completado"
};

export default function ProductionPage() {
  const { profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [rubrics, setRubrics] = useState<WorkProgressRubric[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | ProductionItemStatus>("todos");
  const [selectedRow, setSelectedRow] = useState<ProductionWorkRow | null>(null);
  const [form, setForm] = useState({ cantidadHoy: "", estado: "en_proceso" as ProductionItemStatus, observacion: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loadedWorks = await getObras();
      const loadedRubrics = (await Promise.all(loadedWorks.map((obra) => getProgressRubricsByWork(obra.id)))).flat();
      setObras(loadedWorks);
      setRubrics(loadedRubrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar produccion.");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => getProductionRows(obras, rubrics), [obras, rubrics]);
  const filteredRows = rows.filter((row) => {
    const text = `${row.obra.nombre} ${row.obra.clienteNombre ?? row.obra.cliente} ${row.rubro.nombre} ${row.descripcion}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "todos" || row.estado === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const stats = {
    total: rows.length,
    pendientes: rows.filter((row) => row.estado === "pendiente").length,
    enProceso: rows.filter((row) => row.estado === "en_proceso" || row.estado === "parcial").length,
    completados: rows.filter((row) => row.estado === "completado").length
  };

  function openUpdate(row: ProductionWorkRow) {
    setSelectedRow(row);
    setForm({
      cantidadHoy: "",
      estado: row.estado === "pendiente" ? "en_proceso" : row.estado,
      observacion: row.observacion ?? ""
    });
  }

  async function saveProduction() {
    if (!selectedRow || saving) return;
    const quantityToday = Number(form.cantidadHoy || 0);
    if (!Number.isFinite(quantityToday) || quantityToday < 0) {
      setError("Carga una cantidad producida valida.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const produced = Math.min(selectedRow.cantidadTotal, selectedRow.cantidadProducida + quantityToday);
      const nextStatus: ProductionItemStatus = produced >= selectedRow.cantidadTotal
        ? "completado"
        : produced > 0
          ? "parcial"
          : form.estado;
      const timestamp = new Date().toISOString();

      if (selectedRow.item) {
        await updateProgressRubric(selectedRow.rubro.id, {
          items: (selectedRow.rubro.items ?? []).map((item) =>
            item.id === selectedRow.item?.id
              ? {
                  ...item,
                  cantidadProducida: produced,
                  estadoProduccion: nextStatus,
                  observacion: form.observacion.trim() || item.observacion,
                  updatedAt: timestamp,
                  updatedBy: profile?.uid ?? "produccion"
                }
              : item
          )
        });
      } else {
        await updateProgressRubric(selectedRow.rubro.id, {
          cantidadProducida: produced,
          estadoProduccion: nextStatus,
          observacionProduccion: form.observacion.trim() || selectedRow.rubro.observacionProduccion,
          fechaProduccionActualizada: timestamp,
          responsableProduccion: profile?.nombre ?? "Produccion"
        });
      }

      await createProgressActivity({
        obraId: selectedRow.obra.id,
        tipo: "produccion",
        descripcion: `Produccion actualizada: ${selectedRow.descripcion}.`,
        userId: profile?.uid ?? "produccion",
        userName: profile?.nombre ?? "Produccion",
        fechaHora: timestamp,
        newValue: {
          rubroId: selectedRow.rubro.id,
          itemId: selectedRow.item?.id,
          cantidadProducidaHoy: quantityToday,
          cantidadProducidaAcumulada: produced,
          estado: nextStatus
        }
      });

      setMessage("Produccion actualizada correctamente.");
      setSelectedRow(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la produccion.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <StateCard text="Cargando produccion..." />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase text-next-blue">Taller</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">PRODUCCION</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Items enviados a taller desde el desglose operativo de cada obra. Produccion no modifica el avance fisico instalado.
          </p>
        </div>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DataCard title="Items en produccion"><Metric icon={Factory} value={stats.total} /></DataCard>
        <DataCard title="Pendientes"><Metric icon={CalendarDays} value={stats.pendientes} tone="orange" /></DataCard>
        <DataCard title="En proceso / parcial"><Metric icon={PackageCheck} value={stats.enProceso} /></DataCard>
        <DataCard title="Completados"><Metric icon={CheckCircle2} value={stats.completados} tone="green" /></DataCard>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-next-muted" aria-hidden="true" />
            <input className="field pl-9" placeholder="Buscar por obra, cliente, rubro o item" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "todos" | ProductionItemStatus)}>
            <option value="todos">Todos los estados</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </section>

      <section className="grid gap-3">
        {filteredRows.length ? filteredRows.map((row) => (
          <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={statusLabels[row.estado]} status={badgeForProduction(row.estado)} />
                  <span className="text-xs font-black uppercase text-next-muted">{row.rubro.nombre}</span>
                </div>
                <h2 className="mt-2 text-lg font-black text-next-text">{row.descripcion}</h2>
                <p className="mt-1 text-sm font-semibold text-next-muted">
                  {row.obra.nombre} · {row.obra.clienteNombre ?? row.obra.cliente}
                </p>
                <p className="mt-1 text-xs font-semibold text-next-muted">
                  Fecha comprometida: {row.obra.fechaComprometida || row.obra.fechaEntrega ? formatDateShort(row.obra.fechaComprometida ?? row.obra.fechaEntrega) : "-"}
                </p>
              </div>
              <button className="h-10 rounded-md bg-next-blue px-4 text-xs font-black text-white" type="button" onClick={() => openUpdate(row)}>
                Actualizar produccion
              </button>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_140px] lg:items-center">
              <div className="rounded-md bg-next-bg px-3 py-2">
                <p className="text-xs font-bold uppercase text-next-muted">Cantidad</p>
                <p className="mt-1 text-sm font-black text-next-text">
                  {row.cantidadProducida} / {row.cantidadTotal} {formatUnitLabel(row.unidad, row.cantidadTotal)}
                </p>
              </div>
              <ProgressBar value={productionProgress(row.cantidadProducida, row.cantidadTotal)} />
              <p className="text-right text-2xl font-black text-next-blue">{productionProgress(row.cantidadProducida, row.cantidadTotal)}%</p>
            </div>
          </article>
        )) : <EmptyState text="No hay items marcados para fabricar en taller." />}
      </section>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
          <section className="mx-auto max-w-lg rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-next-blue">Actualizar produccion</p>
                <h2 className="mt-1 text-xl font-black text-next-text">{selectedRow.descripcion}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedRow(null)}>×</button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-black uppercase text-next-muted">
                Cantidad producida hoy
                <input className="field mt-1" min={0} step="0.01" type="number" value={form.cantidadHoy} onChange={(event) => setForm({ ...form, cantidadHoy: event.target.value })} />
              </label>
              <label className="text-xs font-black uppercase text-next-muted">
                Estado
                <select className="field mt-1" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as ProductionItemStatus })}>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase text-next-muted">
                Observacion
                <textarea className="field mt-1 min-h-24" value={form.observacion} onChange={(event) => setForm({ ...form, observacion: event.target.value })} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="h-10 rounded-md border border-slate-200 px-4 text-xs font-black text-next-muted" type="button" onClick={() => setSelectedRow(null)}>Cancelar</button>
              <button className="h-10 rounded-md bg-next-blue px-4 text-xs font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={() => void saveProduction()}>
                {saving ? "Guardando..." : "Guardar avance"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ icon: Icon, value, tone = "blue" }: { icon: typeof Factory; value: number; tone?: "blue" | "green" | "orange" }) {
  const classes = tone === "green" ? "bg-green-50 text-next-green" : tone === "orange" ? "bg-orange-50 text-next-orange" : "bg-next-light text-next-blue";
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-3xl font-black text-next-text">{value}</p>
      <span className={`flex h-10 w-10 items-center justify-center rounded-md ${classes}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  );
}

function badgeForProduction(status: ProductionItemStatus) {
  if (status === "completado") return "success";
  if (status === "parcial") return "warning";
  if (status === "en_proceso") return "info";
  return "neutral";
}

function StateCard({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-bold text-next-muted shadow-soft">{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}
