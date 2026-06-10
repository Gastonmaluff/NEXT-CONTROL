import { Mail, MessageCircle, Plus, Save, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  createProveedor,
  getCheques,
  getFinancialWorks,
  getMovementsByWork,
  getProveedores,
  updateProveedor
} from "../lib/firestore";
import type { Cheque, FinancialMovement, Obra, Proveedor, SupplierCategory } from "../types";
import { formatCurrencyPYG, formatDateShort } from "../utils/formatters";
import { toTitleCase } from "../utils/text";

const supplierCategories: SupplierCategory[] = ["Vidrio", "Aluminio", "Accesorios", "Transporte", "Mano de obra", "Otros"];

const emptySupplierForm = {
  nombre: "",
  ruc: "",
  telefono: "",
  whatsapp: "",
  email: "",
  direccion: "",
  categoriaPrincipal: "Vidrio" as SupplierCategory,
  contactoPrincipal: "",
  observaciones: ""
};

export default function SuppliersPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [form, setForm] = useState(emptySupplierForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedSuppliers, loadedWorks, loadedCheques] = await Promise.all([
        getProveedores(),
        getFinancialWorks(),
        getCheques()
      ]);
      const loadedMovements = (await Promise.all(loadedWorks.map((obra) => getMovementsByWork(obra.id)))).flat();
      setProveedores(loadedSuppliers);
      setObras(loadedWorks);
      setMovements(loadedMovements);
      setCheques(loadedCheques);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar proveedores.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return proveedores.filter((proveedor) =>
      `${proveedor.nombre} ${proveedor.ruc ?? ""} ${proveedor.categoriaPrincipal}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [proveedores, query]);

  function openCreate() {
    setEditing(null);
    setForm(emptySupplierForm);
    setModalOpen(true);
  }

  function openEdit(proveedor: Proveedor) {
    setEditing(proveedor);
    setForm({
      nombre: proveedor.nombre,
      ruc: proveedor.ruc ?? "",
      telefono: proveedor.telefono ?? "",
      whatsapp: proveedor.whatsapp ?? "",
      email: proveedor.email ?? "",
      direccion: proveedor.direccion ?? "",
      categoriaPrincipal: proveedor.categoriaPrincipal,
      contactoPrincipal: proveedor.contactoPrincipal ?? "",
      observaciones: proveedor.observaciones ?? ""
    });
    setModalOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const payload = {
      nombre: toTitleCase(form.nombre),
      ruc: form.ruc.trim() || undefined,
      telefono: form.telefono.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      email: form.email.trim() || undefined,
      direccion: form.direccion.trim() || undefined,
      categoriaPrincipal: form.categoriaPrincipal,
      contactoPrincipal: form.contactoPrincipal ? toTitleCase(form.contactoPrincipal) : undefined,
      observaciones: form.observaciones.trim() || undefined
    };

    try {
      if (editing) {
        await updateProveedor(editing.id, payload);
        setMessage("Proveedor actualizado.");
      } else {
        await createProveedor(payload);
        setMessage("Proveedor creado.");
      }
      setModalOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el proveedor.");
    }
  }

  if (loading) {
    return <StateCard text="Cargando proveedores..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Compras</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">PROVEEDORES</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-next-muted">
            Proveedores, contactos, compras recientes y cheques pendientes.
          </p>
        </div>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={openCreate}>
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo proveedor
        </button>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <input className="field" placeholder="Buscar proveedor por nombre, RUC o categoria" value={query} onChange={(event) => setQuery(event.target.value)} />
      </section>

      <section className="space-y-4">
        {filtered.map((proveedor) => (
          <SupplierCard
            key={proveedor.id}
            cheques={getSupplierCheques(proveedor, cheques)}
            movements={getSupplierMovements(proveedor, movements)}
            obras={obras}
            proveedor={proveedor}
            onEdit={() => openEdit(proveedor)}
          />
        ))}
        {!filtered.length ? <EmptyState text="Todavia no hay proveedores cargados." /> : null}
      </section>

      {modalOpen ? (
        <SupplierModal
          form={form}
          setForm={setForm}
          title={editing ? "Editar proveedor" : "Nuevo proveedor"}
          onClose={() => setModalOpen(false)}
          onSubmit={save}
        />
      ) : null}
    </div>
  );
}

function SupplierCard({
  cheques,
  movements,
  obras,
  onEdit,
  proveedor
}: {
  cheques: Cheque[];
  movements: FinancialMovement[];
  obras: Obra[];
  onEdit: () => void;
  proveedor: Proveedor;
}) {
  const compras = movements.filter((movement) => movement.tipo === "compra");
  const totalComprado = compras.reduce((sum, movement) => sum + movement.monto, 0);
  const [chequesOpen, setChequesOpen] = useState(false);
  const chequesPendientes = cheques.filter((cheque) => cheque.tipo === "emitido" && !["debitado", "anulado", "rechazado"].includes(cheque.estado));
  const lastMovement = compras[0];
  const relatedWorks = Array.from(new Set(compras.map((movement) => obras.find((obra) => obra.id === movement.obraId)?.nombre).filter(Boolean)));

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-next-blue">{proveedor.categoriaPrincipal}</p>
          <h2 className="mt-1 text-xl font-black text-next-text">{proveedor.nombre}</h2>
          <p className="mt-1 text-sm font-semibold text-next-muted">{[proveedor.ruc, proveedor.contactoPrincipal].filter(Boolean).join(" · ") || "Sin RUC/contacto"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {proveedor.whatsapp ? <ContactButton href={`https://wa.me/${cleanPhone(proveedor.whatsapp)}`} label="WhatsApp" icon="whatsapp" /> : null}
            {proveedor.email ? <ContactButton href={`mailto:${proveedor.email}`} label="Email" icon="email" /> : null}
            <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={onEdit}>Editar proveedor</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
          <Metric label="Total comprado" value={formatCurrencyPYG(totalComprado)} />
          <button className="text-left" type="button" onClick={() => setChequesOpen(true)}>
            <Metric label="Cheques pendientes" value={`${chequesPendientes.length}`} tone="orange" />
          </button>
          <Metric label="Ultimo movimiento" value={lastMovement ? formatDateShort(lastMovement.fecha) : "Sin compras"} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InfoBox title="Ultimas compras / movimientos" items={compras.slice(0, 4).map((movement) => `${formatDateShort(movement.fecha)} · ${movement.concepto} · ${formatCurrencyPYG(movement.monto)}`)} empty="Sin compras registradas." />
        <InfoBox title="Obras relacionadas" items={relatedWorks.slice(0, 4) as string[]} empty="Sin obras relacionadas." />
      </div>
      {chequesOpen ? <SupplierChequesModal cheques={chequesPendientes} onClose={() => setChequesOpen(false)} proveedor={proveedor} /> : null}
    </article>
  );
}

function SupplierChequesModal({ cheques, onClose, proveedor }: { cheques: Cheque[]; onClose: () => void; proveedor: Proveedor }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-4xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Cheques pendientes</p>
            <h2 className="mt-1 text-2xl font-black text-next-text">{proveedor.nombre}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-2">
          {cheques.length ? cheques.map((cheque) => (
            <div key={cheque.id} className="grid gap-2 rounded-md border border-slate-100 p-3 text-sm font-semibold text-next-muted md:grid-cols-6 md:items-center">
              <span className="font-black text-next-text">Nro. {cheque.numeroCheque}</span>
              <span>{cheque.bancoCheque ?? "Sin banco"}</span>
              <span>{formatCurrencyPYG(cheque.monto)}</span>
              <span>Emision {formatDateShort(cheque.fechaEmisionCheque)}</span>
              <span>Cobro {formatDateShort(cheque.fechaCobroCheque || cheque.fechaVencimientoCheque || "")}</span>
              <span>{cheque.obraNombre} | {cheque.estado}</span>
            </div>
          )) : <EmptyState text="No hay cheques pendientes para este proveedor." />}
        </div>
        <a className="mt-4 inline-flex h-10 items-center rounded-md bg-next-blue px-4 text-xs font-black text-white" href="/NEXT-CONTROL/cheques">
          Ir a Cheques
        </a>
      </section>
    </div>
  );
}

function SupplierModal({
  form,
  onClose,
  onSubmit,
  setForm,
  title
}: {
  form: typeof emptySupplierForm;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setForm: (form: typeof emptySupplierForm) => void;
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
          <Field label="Nombre / razon social"><input className="field" required value={form.nombre} onBlur={() => setForm({ ...form, nombre: toTitleCase(form.nombre) })} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
          <Field label="RUC opcional"><input className="field" value={form.ruc} onChange={(event) => setForm({ ...form, ruc: event.target.value })} /></Field>
          <Field label="Categoria principal"><select className="field" value={form.categoriaPrincipal} onChange={(event) => setForm({ ...form, categoriaPrincipal: event.target.value as SupplierCategory })}>{supplierCategories.map((category) => <option key={category}>{category}</option>)}</select></Field>
          <Field label="Telefono"><input className="field" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></Field>
          <Field label="WhatsApp"><input className="field" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} /></Field>
          <Field label="Email"><input className="field" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Direccion"><input className="field" value={form.direccion} onChange={(event) => setForm({ ...form, direccion: event.target.value })} /></Field>
          <Field label="Contacto principal"><input className="field" value={form.contactoPrincipal} onBlur={() => setForm({ ...form, contactoPrincipal: toTitleCase(form.contactoPrincipal) })} onChange={(event) => setForm({ ...form, contactoPrincipal: event.target.value })} /></Field>
          <Field label="Observaciones"><input className="field" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></Field>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white sm:col-span-2" type="submit">
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar proveedor
          </button>
        </form>
      </section>
    </div>
  );
}

function ContactButton({ href, icon, label }: { href: string; icon: "whatsapp" | "email"; label: string }) {
  const Icon = icon === "whatsapp" ? MessageCircle : Mail;
  return (
    <a className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-black text-next-blue" href={href} target="_blank" rel="noreferrer">
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function InfoBox({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  return (
    <div className="rounded-md bg-next-bg p-3">
      <p className="text-xs font-black uppercase text-next-muted">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length ? items.map((item) => <p key={item} className="text-sm font-semibold text-next-text">{item}</p>) : <p className="text-sm font-semibold text-next-muted">{empty}</p>}
      </div>
    </div>
  );
}

function getSupplierMovements(proveedor: Proveedor, movements: FinancialMovement[]) {
  return movements
    .filter((movement) =>
      movement.proveedorId === proveedor.id
      || movement.proveedorNombre === proveedor.nombre
      || movement.tercero === proveedor.nombre
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function getSupplierCheques(proveedor: Proveedor, cheques: Cheque[]) {
  return cheques
    .filter((cheque) =>
      cheque.proveedorId === proveedor.id
      || cheque.beneficiarioId === proveedor.id
      || cheque.terceroId === proveedor.id
      || cheque.proveedorNombre === proveedor.nombre
      || cheque.beneficiarioNombre === proveedor.nombre
      || cheque.terceroNombre === proveedor.nombre
    )
    .sort((a, b) => (a.fechaCobroCheque || a.fechaVencimientoCheque || "").localeCompare(b.fechaCobroCheque || b.fechaVencimientoCheque || ""));
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, "");
}

function Metric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "orange" }) {
  return (
    <div className="rounded-md bg-next-bg px-3 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className={`mt-1 text-sm font-black ${tone === "orange" ? "text-next-orange" : "text-next-blue"}`}>{value}</p>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-xs font-black uppercase text-next-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function StateCard({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-next-muted shadow-soft">{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-next-bg px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}
