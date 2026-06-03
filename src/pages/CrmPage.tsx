import { BarChart3, FileSpreadsheet, Plus, Receipt, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import KpiCard from "../components/ui/KpiCard";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import {
  convertirOportunidadEnObra,
  createOportunidad,
  getOportunidades,
  updateOportunidad
} from "../lib/firestore";
import type { OportunidadCRM, PipelineStatus } from "../types";
import { formatCurrencyPYG, formatDateShort, getTodayInputDate } from "../utils/formatters";

const pipelineStatuses: PipelineStatus[] = [
  "Prospecto",
  "Presupuesto enviado",
  "Seguimiento",
  "Aprobado",
  "Perdido"
];

const emptyLead = {
  proyecto: "",
  cliente: "",
  arquitecto: "",
  montoEstimado: "",
  estado: "Prospecto" as PipelineStatus,
  prioridad: "Media" as "Alta" | "Media" | "Baja",
  proximoSeguimiento: getTodayInputDate(),
  observacion: ""
};

export default function CrmPage() {
  const [oportunidades, setOportunidades] = useState<OportunidadCRM[]>([]);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setOportunidades(await getOportunidades());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar clientes.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const activos = oportunidades.filter((item) => item.estado !== "Perdido").length;
    const enviados = oportunidades.filter((item) => item.estado === "Presupuesto enviado").length;
    const aprobados = oportunidades.filter((item) => item.estado === "Aprobado").length;
    const ventas = oportunidades.reduce((sum, item) => sum + item.montoEstimado, 0);
    const conversion = oportunidades.length ? Math.round((aprobados / oportunidades.length) * 100) : 0;
    return { activos, enviados, conversion, ventas };
  }, [oportunidades]);

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await createOportunidad({
        ...leadForm,
        montoEstimado: Number(leadForm.montoEstimado)
      });
      setLeadForm(emptyLead);
      setShowForm(false);
      setMessage("Prospecto creado.");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el lead.");
    }
  }

  async function handleStatusChange(id: string, estado: PipelineStatus) {
    try {
      await updateOportunidad(id, { estado });
      setMessage("Oportunidad actualizada.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar la oportunidad.");
    }
  }

  async function handleConvert(id: string) {
    try {
      await convertirOportunidadEnObra(id);
      setMessage("Oportunidad convertida en obra.");
      await load();
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "No se pudo convertir la oportunidad.");
    }
  }

  if (loading) {
    return <StateCard text="Cargando clientes..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Comercial</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">CLIENTES</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-next-muted">
            Clientes, prospectos, presupuestos enviados y seguimiento comercial.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy"
          type="button"
          onClick={() => setShowForm((current) => !current)}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo prospecto
        </button>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Prospectos activos" value={`${metrics.activos}`} icon={Users} />
        <KpiCard label="Presupuestos enviados" value={`${metrics.enviados}`} icon={FileSpreadsheet} tone="orange" />
        <KpiCard label="Tasa de conversion" value={`${metrics.conversion}%`} icon={BarChart3} tone="green" />
        <KpiCard label="Ventas estimadas" value={formatCurrencyPYG(metrics.ventas)} icon={Receipt} />
      </section>

      {showForm ? (
        <DataCard title="Nuevo prospecto">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleCreateLead}>
            <input className="field" required placeholder="Proyecto" value={leadForm.proyecto} onChange={(event) => setLeadForm({ ...leadForm, proyecto: event.target.value })} />
            <input className="field" required placeholder="Cliente" value={leadForm.cliente} onChange={(event) => setLeadForm({ ...leadForm, cliente: event.target.value })} />
            <input className="field" placeholder="Arquitecto" value={leadForm.arquitecto} onChange={(event) => setLeadForm({ ...leadForm, arquitecto: event.target.value })} />
            <input className="field" required type="number" placeholder="Monto estimado" value={leadForm.montoEstimado} onChange={(event) => setLeadForm({ ...leadForm, montoEstimado: event.target.value })} />
            <select className="field" value={leadForm.estado} onChange={(event) => setLeadForm({ ...leadForm, estado: event.target.value as PipelineStatus })}>
              {pipelineStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <select className="field" value={leadForm.prioridad} onChange={(event) => setLeadForm({ ...leadForm, prioridad: event.target.value as "Alta" | "Media" | "Baja" })}>
              <option>Alta</option>
              <option>Media</option>
              <option>Baja</option>
            </select>
            <input className="field" type="date" value={leadForm.proximoSeguimiento} onChange={(event) => setLeadForm({ ...leadForm, proximoSeguimiento: event.target.value })} />
            <input className="field" placeholder="Observacion" value={leadForm.observacion} onChange={(event) => setLeadForm({ ...leadForm, observacion: event.target.value })} />
            <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white sm:col-span-2" type="submit">
              Guardar prospecto
            </button>
          </form>
        </DataCard>
      ) : null}

      <section className="overflow-x-auto pb-2">
        <div className="flex min-w-[1180px] gap-4">
          {pipelineStatuses.map((status) => {
            const items = oportunidades.filter((item) => item.estado === status);
            return (
              <div key={status} className="w-[230px] shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black text-next-text">{status}</h2>
                  <StatusBadge label={`${items.length}`} status={badgeForPipeline(status)} />
                </div>
                <div className="space-y-3">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-lg border border-slate-100 bg-next-bg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-next-text">{item.proyecto}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-next-muted">{item.cliente}</p>
                        </div>
                        <StatusBadge label={item.prioridad} status={item.prioridad === "Alta" ? "critical" : item.prioridad === "Media" ? "warning" : "neutral"} />
                      </div>
                      <p className="mt-3 text-sm font-black text-next-blue">{formatCurrencyPYG(item.montoEstimado)}</p>
                      <p className="mt-1 text-xs font-semibold text-next-muted">
                        Seguimiento: {formatDateShort(item.proximoSeguimiento)}
                      </p>
                      <select
                        className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-black outline-none"
                        value={item.estado}
                        onChange={(event) => handleStatusChange(item.id, event.target.value as PipelineStatus)}
                      >
                        {pipelineStatuses.map((next) => <option key={next}>{next}</option>)}
                      </select>
                      {item.estado === "Aprobado" ? (
                        <button
                          className="mt-2 h-10 w-full rounded-md bg-next-blue px-3 text-xs font-black text-white"
                          type="button"
                          onClick={() => handleConvert(item.id)}
                        >
                          Convertir en obra
                        </button>
                      ) : null}
                    </article>
                  ))}
                  {!items.length ? <EmptyState text="Sin oportunidades." /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function badgeForPipeline(status: PipelineStatus): BadgeStatus {
  if (status === "Aprobado") return "success";
  if (status === "Perdido") return "critical";
  if (status === "Seguimiento" || status === "Presupuesto enviado") return "warning";
  return "info";
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
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
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-next-muted">
      {text}
    </div>
  );
}
