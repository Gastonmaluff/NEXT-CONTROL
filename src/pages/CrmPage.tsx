import { BarChart3, FileSpreadsheet, Mail, MessageCircle, Plus, Receipt, Save, Users, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import CurrencyInput from "../components/ui/CurrencyInput";
import KpiCard from "../components/ui/KpiCard";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import {
  convertirOportunidadEnObra,
  createCliente,
  createOportunidad,
  getClientes,
  getOportunidades,
  updateCliente,
  updateOportunidad
} from "../lib/firestore";
import type { Cliente, OportunidadCRM, PipelineStatus } from "../types";
import { formatCurrencyPYG, formatDateShort, getTodayInputDate } from "../utils/formatters";
import { toTitleCase } from "../utils/text";

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

const emptyClient = {
  nombre: "",
  ruc: "",
  telefono: "",
  whatsapp: "",
  email: "",
  direccion: "",
  ciudad: "",
  contactoPrincipal: "",
  observaciones: ""
};

export default function CrmPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [oportunidades, setOportunidades] = useState<OportunidadCRM[]>([]);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [clientQuery, setClientQuery] = useState("");
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
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
      const [loadedClients, loadedOpportunities] = await Promise.all([
        getClientes(),
        getOportunidades()
      ]);
      setClientes(loadedClients);
      setOportunidades(loadedOpportunities);
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

  const filteredClients = useMemo(() => {
    return clientes.filter((cliente) =>
      `${cliente.nombre} ${cliente.ruc ?? ""} ${cliente.telefono ?? ""} ${cliente.email ?? ""}`.toLowerCase().includes(clientQuery.toLowerCase())
    );
  }, [clientes, clientQuery]);

  function openNewClient() {
    setEditingClient(null);
    setClientForm(emptyClient);
    setClientModalOpen(true);
  }

  function openEditClient(cliente: Cliente) {
    setEditingClient(cliente);
    setClientForm({
      nombre: cliente.nombre,
      ruc: cliente.ruc ?? "",
      telefono: cliente.telefono ?? "",
      whatsapp: cliente.whatsapp ?? "",
      email: cliente.email ?? "",
      direccion: cliente.direccion ?? "",
      ciudad: cliente.ciudad ?? "",
      contactoPrincipal: cliente.contactoPrincipal ?? "",
      observaciones: cliente.observaciones ?? ""
    });
    setClientModalOpen(true);
  }

  async function handleSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        nombre: toTitleCase(clientForm.nombre),
        ruc: clientForm.ruc.trim() || undefined,
        telefono: clientForm.telefono.trim() || undefined,
        whatsapp: clientForm.whatsapp.trim() || undefined,
        email: clientForm.email.trim() || undefined,
        direccion: clientForm.direccion.trim() || undefined,
        ciudad: clientForm.ciudad ? toTitleCase(clientForm.ciudad) : undefined,
        contactoPrincipal: clientForm.contactoPrincipal ? toTitleCase(clientForm.contactoPrincipal) : undefined,
        observaciones: clientForm.observaciones.trim() || undefined
      };

      if (editingClient) {
        await updateCliente(editingClient.id, payload);
        setMessage("Cliente actualizado.");
      } else {
        const duplicated = clientes.find((cliente) =>
          cliente.nombre.trim().toLowerCase() === clientForm.nombre.trim().toLowerCase()
          || (cliente.ruc && clientForm.ruc && cliente.ruc.trim() === clientForm.ruc.trim())
        );
        if (duplicated) {
          setError("Ya existe un cliente con ese nombre o RUC.");
          return;
        }
        await createCliente(payload);
        setMessage("Cliente creado.");
      }
      setClientModalOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el cliente.");
    }
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await createOportunidad({
        ...leadForm,
        proyecto: toTitleCase(leadForm.proyecto),
        cliente: toTitleCase(leadForm.cliente),
        arquitecto: leadForm.arquitecto ? toTitleCase(leadForm.arquitecto) : "",
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

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Clientes activos</p>
            <h2 className="text-xl font-black text-next-text">Clientes creados</h2>
          </div>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-next-blue px-3 text-xs font-black text-white" type="button" onClick={openNewClient}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo cliente
          </button>
        </div>
        <input className="field" placeholder="Buscar cliente por nombre, RUC, telefono o email" value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} />
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredClients.map((cliente) => (
            <ClientCard key={cliente.id} cliente={cliente} onEdit={() => openEditClient(cliente)} />
          ))}
          {!filteredClients.length ? <EmptyState text="Todavia no hay clientes activos." /> : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Prospectos activos" value={`${metrics.activos}`} icon={Users} />
        <KpiCard label="Presupuestos enviados" value={`${metrics.enviados}`} icon={FileSpreadsheet} tone="orange" />
        <KpiCard label="Tasa de conversion" value={`${metrics.conversion}%`} icon={BarChart3} tone="green" />
        <KpiCard label="Ventas estimadas" value={formatCurrencyPYG(metrics.ventas)} icon={Receipt} />
      </section>

      <div>
        <p className="text-xs font-black uppercase text-next-blue">Prospectos</p>
        <h2 className="mt-1 text-xl font-black text-next-text">Pipeline comercial</h2>
      </div>

      {showForm ? (
        <DataCard title="Nuevo prospecto">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleCreateLead}>
            <input className="field" required placeholder="Proyecto" value={leadForm.proyecto} onBlur={() => setLeadForm({ ...leadForm, proyecto: toTitleCase(leadForm.proyecto) })} onChange={(event) => setLeadForm({ ...leadForm, proyecto: event.target.value })} />
            <input className="field" required placeholder="Cliente" value={leadForm.cliente} onBlur={() => setLeadForm({ ...leadForm, cliente: toTitleCase(leadForm.cliente) })} onChange={(event) => setLeadForm({ ...leadForm, cliente: event.target.value })} />
            <input className="field" placeholder="Arquitecto" value={leadForm.arquitecto} onBlur={() => setLeadForm({ ...leadForm, arquitecto: toTitleCase(leadForm.arquitecto) })} onChange={(event) => setLeadForm({ ...leadForm, arquitecto: event.target.value })} />
            <CurrencyInput required placeholder="Monto estimado" value={Number(leadForm.montoEstimado || 0)} onValueChange={(value) => setLeadForm({ ...leadForm, montoEstimado: String(value) })} />
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

      {clientModalOpen ? (
        <ClientModal
          form={clientForm}
          setForm={setClientForm}
          title={editingClient ? "Editar cliente" : "Nuevo cliente"}
          onClose={() => setClientModalOpen(false)}
          onSubmit={handleSaveClient}
        />
      ) : null}
    </div>
  );
}

function ClientCard({ cliente, onEdit }: { cliente: Cliente; onEdit: () => void }) {
  return (
    <article className="rounded-lg border border-slate-100 bg-next-bg p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-next-text">{cliente.nombre}</h3>
          <p className="mt-1 text-xs font-semibold text-next-muted">
            {[cliente.ruc, cliente.contactoPrincipal, cliente.ciudad].filter(Boolean).join(" · ") || "Sin datos secundarios"}
          </p>
          <p className="mt-1 text-xs font-semibold text-next-muted">
            {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {cliente.whatsapp ? <QuickLink href={`https://wa.me/${cleanPhone(cliente.whatsapp)}`} label="WhatsApp" icon="whatsapp" /> : null}
          {cliente.email ? <QuickLink href={`mailto:${cliente.email}`} label="Email" icon="email" /> : null}
          <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={onEdit}>Editar</button>
        </div>
      </div>
    </article>
  );
}

function ClientModal({
  form,
  onClose,
  onSubmit,
  setForm,
  title
}: {
  form: typeof emptyClient;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setForm: (form: typeof emptyClient) => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-2xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-next-text">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          <input className="field" required placeholder="Nombre / razon social" value={form.nombre} onBlur={() => setForm({ ...form, nombre: toTitleCase(form.nombre) })} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
          <input className="field" placeholder="RUC opcional" value={form.ruc} onChange={(event) => setForm({ ...form, ruc: event.target.value })} />
          <input className="field" placeholder="Telefono" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} />
          <input className="field" placeholder="WhatsApp" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
          <input className="field" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input className="field" placeholder="Direccion" value={form.direccion} onChange={(event) => setForm({ ...form, direccion: event.target.value })} />
          <input className="field" placeholder="Ciudad" value={form.ciudad} onBlur={() => setForm({ ...form, ciudad: toTitleCase(form.ciudad) })} onChange={(event) => setForm({ ...form, ciudad: event.target.value })} />
          <input className="field" placeholder="Contacto principal" value={form.contactoPrincipal} onBlur={() => setForm({ ...form, contactoPrincipal: toTitleCase(form.contactoPrincipal) })} onChange={(event) => setForm({ ...form, contactoPrincipal: event.target.value })} />
          <input className="field sm:col-span-2" placeholder="Observaciones" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} />
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white sm:col-span-2" type="submit">
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar cliente
          </button>
        </form>
      </section>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: "whatsapp" | "email"; label: string }) {
  const Icon = icon === "whatsapp" ? MessageCircle : Mail;
  return (
    <a className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-next-blue" href={href} target="_blank" rel="noreferrer">
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, "");
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
