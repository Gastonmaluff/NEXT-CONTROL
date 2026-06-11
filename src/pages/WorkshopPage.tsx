import { Bell, CheckCircle2, Factory, LogOut, PackageCheck, Search, XCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BrandLogo from "../components/brand/BrandLogo";
import FieldPhotoUploader from "../components/field/FieldPhotoUploader";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  getObras,
  getProgressRubricsByWork,
  registerProductionForItem
} from "../lib/firestore";
import { firebaseStorage, isFirebaseConfigured } from "../lib/firebase";
import { buildProductionPhotoPath, uploadFile } from "../lib/storageUpload";
import type { Obra, ProductionItemStatus, SystemUser, TaskPhoto, WorkProgressRubric } from "../types";
import { formatDateShort } from "../utils/formatters";
import { formatUnitLabel } from "../utils/units";
import { getProductionRows, productionProgress, roundMeasure, type ProductionWorkRow } from "../utils/workBreakdown";

const allowedRoles = ["admin", "gerencia", "produccion", "taller"] as const;

const statusLabels: Record<ProductionItemStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  parcial: "Parcial",
  completado: "Completado"
};

export default function WorkshopPage() {
  const { authUser, login, logout, profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [rubrics, setRubrics] = useState<WorkProgressRubric[]>([]);
  const [selectedRow, setSelectedRow] = useState<ProductionWorkRow | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ cantidad: "", estado: "en_proceso" as ProductionItemStatus, observacion: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAccess = canAccessWorkshop(profile);

  useEffect(() => {
    if (profile && canAccess) {
      void load();
    }
  }, [profile?.uid, canAccess]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loadedWorks = await getObras();
      const visibleWorks = filterWorkshopWorks(loadedWorks, profile);
      const loadedRubrics = (await Promise.all(visibleWorks.map((obra) => getProgressRubricsByWork(obra.id)))).flat();
      setObras(visibleWorks);
      setRubrics(loadedRubrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar taller.");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => getProductionRows(obras, rubrics), [obras, rubrics]);
  const filteredRows = rows.filter((row) => {
    const text = `${row.obra.nombre} ${row.obra.clienteNombre ?? row.obra.cliente} ${row.rubro.nombre} ${row.descripcion}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const stats = {
    pendientes: rows.filter((row) => row.estado === "pendiente").length,
    proceso: rows.filter((row) => row.estado === "en_proceso" || row.estado === "parcial").length,
    completados: rows.filter((row) => row.estado === "completado").length,
    piezasPendientes: rows.reduce((sum, row) => sum + row.cantidadPendiente, 0)
  };

  function openUpdate(row: ProductionWorkRow) {
    setSelectedRow(row);
    setForm({
      cantidad: String(row.cantidadProducida || ""),
      estado: row.estado === "pendiente" ? "en_proceso" : row.estado,
      observacion: row.observacion ?? ""
    });
    setFiles([]);
  }

  async function uploadProductionPhotos(row: ProductionWorkRow): Promise<TaskPhoto[]> {
    if (!files.length) return [];
    if (!isFirebaseConfigured() || !firebaseStorage) {
      setError("Firebase Storage no esta disponible. Guarda sin foto o intenta nuevamente mas tarde.");
      return [];
    }

    setUploadStatus("Subiendo foto de produccion...");
    try {
      return await Promise.all(files.map(async (file) => {
        const storagePath = buildProductionPhotoPath(row.obra.id, row.rubro.id, row.item?.id ?? "simple", file);
        const url = await uploadFile(storagePath, file);
        return {
          id: `prod-photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url,
          storagePath,
          fileName: file.name,
          uploadedBy: profile?.uid ?? "taller",
          uploadedAt: new Date().toISOString(),
          obraId: row.obra.id
        };
      }));
    } finally {
      setUploadStatus("");
    }
  }

  async function saveProduction() {
    if (!selectedRow || saving) return;
    const quantity = Number(form.cantidad || 0);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("Carga una cantidad producida acumulada valida.");
      return;
    }
    if (quantity > selectedRow.cantidadTotal && profile?.role !== "admin") {
      setError("No se puede registrar una cantidad mayor al total requerido.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const photos = await uploadProductionPhotos(selectedRow);
      await registerProductionForItem({
        rubroId: selectedRow.rubro.id,
        itemId: selectedRow.item?.id,
        cantidadNueva: quantity,
        observacion: form.observacion.trim(),
        fotos: photos,
        allowOverTotal: profile?.role === "admin"
      });
      setMessage("Produccion registrada correctamente.");
      setSelectedRow(null);
      setFiles([]);
      await load();
    } catch (saveError) {
      console.error("No se pudo registrar produccion desde taller.", saveError);
      setError(saveError instanceof Error ? saveError.message : "No se pudo registrar la produccion.");
    } finally {
      setSaving(false);
    }
  }

  if (!authUser && !profile) {
    return <WorkshopLogin onLogin={login} />;
  }

  if (authUser && !profile) {
    return <AccessState title="Cuenta sin perfil" text="Tu cuenta existe, pero todavia no tiene perfil y rol asignados." onLogout={logout} />;
  }

  if (!canAccess) {
    return <AccessState title="Sin permisos" text="No tenes permisos para acceder a Taller." onLogout={logout} />;
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 text-sm font-bold text-next-muted">Cargando taller...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-4 text-next-text">
      <div className="mx-auto max-w-xl space-y-4 pb-8 lg:max-w-4xl">
        <header className="flex items-center justify-between rounded-[1.35rem] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo variant="compact" className="shrink-0 rounded-2xl bg-next-navy p-1 shadow-sm" />
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight text-next-text">NEXT CONTROL</p>
              <p className="text-xs font-semibold text-next-muted">Taller / Produccion</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-next-blue ring-1 ring-slate-200" type="button" title="Notificaciones">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-next-blue ring-1 ring-slate-200" type="button" onClick={() => void logout()} title="Cerrar sesion">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {message ? <Notice tone="success" text={message} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}

        <section className="rounded-[1.5rem] bg-next-navy p-4 text-white shadow-soft">
          <p className="text-xs font-black uppercase text-white/60">Taller</p>
          <h1 className="mt-1 text-2xl font-black">{profile?.nombre ?? "Produccion"}</h1>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric label="Pendientes" value={`${stats.pendientes}`} dark />
            <MiniMetric label="En proceso" value={`${stats.proceso}`} dark />
            <MiniMetric label="Completados" value={`${stats.completados}`} dark />
            <MiniMetric label="Piezas pend." value={`${stats.piezasPendientes}`} dark />
          </div>
        </section>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-next-muted" aria-hidden="true" />
          <input className="field rounded-2xl bg-white pl-10" placeholder="Buscar obra, rubro o item" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>

        <section className="space-y-3">
          {filteredRows.length ? filteredRows.map((row) => (
            <article key={row.id} className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={statusLabels[row.estado]} status={badgeForProduction(row.estado)} />
                    <span className="text-[11px] font-black uppercase text-next-muted">{row.rubro.nombre}</span>
                  </div>
                  <h2 className="mt-2 text-xl font-black leading-tight text-next-text">{row.descripcion}</h2>
                  <p className="mt-1 text-sm font-semibold text-next-muted">{row.obra.nombre} - {row.obra.clienteNombre ?? row.obra.cliente}</p>
                  <p className="mt-1 text-xs font-semibold text-next-muted">Entrega: {formatDateShort(row.obra.fechaComprometida ?? row.obra.fechaEntrega)}</p>
                </div>
                <Factory className="h-9 w-9 rounded-full bg-next-light p-2 text-next-blue" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <MiniMetric label="Medida" value={row.medida ?? "Carga simple"} />
                <MiniMetric label="Cantidad" value={`${row.cantidadTotal} ${formatUnitLabel(row.unidad, row.cantidadTotal)}`} />
                <MiniMetric label="Producido" value={`${row.cantidadProducida} / ${row.cantidadTotal}`} />
                <MiniMetric label="Pendiente" value={`${row.cantidadPendiente} ${formatUnitLabel(row.unidad, row.cantidadPendiente)}`} />
                <MiniMetric label="Disponible inst." value={`${row.disponibleParaInstalar} ${formatUnitLabel(row.unidad, row.disponibleParaInstalar)}`} />
                <MiniMetric label="Equivale" value={row.metrosCuadradosTotales ? `${formatM2(row.metrosCuadradosProducidos)} / ${formatM2(row.metrosCuadradosTotales)}` : "-"} />
              </div>
              <div className="mt-4">
                <ProgressBar value={productionProgress(row.cantidadProducida, row.cantidadTotal)} />
                <p className="mt-1 text-right text-xs font-black text-next-blue">{productionProgress(row.cantidadProducida, row.cantidadTotal)}%</p>
              </div>
              <button className="mt-4 h-11 w-full rounded-xl bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => openUpdate(row)}>
                Registrar produccion
              </button>
            </article>
          )) : (
            <EmptyState text="No hay trabajos de taller pendientes para este usuario." />
          )}
        </section>
      </div>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
          <section className="mx-auto max-w-lg rounded-[1.35rem] bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-next-blue">Registrar produccion</p>
                <h2 className="mt-1 text-xl font-black text-next-text">{selectedRow.descripcion}</h2>
                <p className="mt-1 text-sm font-semibold text-next-muted">Actual: {selectedRow.cantidadProducida} / {selectedRow.cantidadTotal}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedRow(null)}>x</button>
            </div>
            <div className="mt-4 space-y-3">
              <label>
                <span className="text-xs font-black uppercase text-next-muted">Cantidad producida acumulada</span>
                <input className="field mt-1" min={0} max={selectedRow.cantidadTotal} step="0.01" type="number" value={form.cantidad} onChange={(event) => setForm({ ...form, cantidad: event.target.value })} />
              </label>
              <div className="rounded-xl bg-next-bg px-3 py-2 text-xs font-semibold text-next-muted">
                <p className="font-black uppercase text-next-text">Calculo automatico</p>
                <p className="mt-1">Pendiente: {Math.max(selectedRow.cantidadTotal - Number(form.cantidad || 0), 0)} {formatUnitLabel(selectedRow.unidad, selectedRow.cantidadTotal)}</p>
                {selectedRow.metrosCuadradosTotales ? (
                  <p>Equivale a {formatM2(roundMeasure(Number(form.cantidad || 0) * (selectedRow.metrosCuadradosPorUnidad ?? 0)))} / {formatM2(selectedRow.metrosCuadradosTotales)}</p>
                ) : null}
              </div>
              <label>
                <span className="text-xs font-black uppercase text-next-muted">Observacion</span>
                <textarea className="field mt-1 min-h-24" value={form.observacion} onChange={(event) => setForm({ ...form, observacion: event.target.value })} />
              </label>
              <FieldPhotoUploader files={files} label="Foto opcional" multiple onFilesChange={setFiles} status={uploadStatus} />
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-next-muted" type="button" onClick={() => setSelectedRow(null)}>
                  Cancelar
                </button>
                <button className="h-11 rounded-xl bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={() => void saveProduction()}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function WorkshopLogin({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      console.error("No se pudo iniciar sesion de taller.", loginError);
      setError("No se pudo iniciar sesion. Verifica el correo y la contrasena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-next-navy px-4 py-8">
      <section className="w-full max-w-md rounded-[1.5rem] bg-white p-6 text-next-text shadow-2xl">
        <div className="mb-6 flex justify-center rounded-[1.25rem] bg-next-navy px-4 py-5">
          <BrandLogo variant="login" />
        </div>
        <p className="text-xs font-black uppercase text-next-blue">NEXT CONTROL</p>
        <h1 className="mt-1 text-2xl font-black">Acceso taller</h1>
        <p className="mt-2 text-sm font-semibold text-next-muted">Ingresa con el usuario creado por administracion.</p>
        {error ? <Notice tone="error" text={error} /> : null}
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Correo</span>
            <input className="field mt-1" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Contrasena</span>
            <input className="field mt-1" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="h-11 w-full rounded-xl bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AccessState({ onLogout, text, title }: { onLogout: () => Promise<void>; text: string; title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-next-bg px-4">
      <section className="w-full max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-next-red">
          <XCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-next-text">{title}</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-next-muted">{text}</p>
        <button className="mt-5 h-11 rounded-xl bg-next-blue px-5 text-sm font-black text-white" type="button" onClick={() => void onLogout()}>
          Cerrar sesion
        </button>
      </section>
    </main>
  );
}

function MiniMetric({ dark = false, label, value }: { dark?: boolean; label: string; value: string }) {
  return (
    <div className={`min-w-0 rounded-2xl px-3 py-2 ${dark ? "bg-white/10" : "bg-next-bg"}`}>
      <p className={`truncate text-[10px] font-black uppercase ${dark ? "text-white/60" : "text-next-muted"}`}>{label}</p>
      <p className={`mt-1 truncate text-xs font-black ${dark ? "text-white" : "text-next-text"}`} title={value}>{value}</p>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}

function canAccessWorkshop(profile: SystemUser | null) {
  return Boolean(profile?.active && allowedRoles.includes(profile.role as (typeof allowedRoles)[number]));
}

function filterWorkshopWorks(obras: Obra[], profile: SystemUser | null) {
  if (!profile) return [];
  if (profile.role === "admin" || profile.role === "gerencia") return obras;
  const assigned = profile.assignedWorkIds ?? [];
  return assigned.length ? obras.filter((obra) => assigned.includes(obra.id)) : obras;
}

function badgeForProduction(status: ProductionItemStatus) {
  if (status === "completado") return "success";
  if (status === "parcial") return "warning";
  if (status === "en_proceso") return "info";
  return "neutral";
}

function formatM2(value?: number) {
  return `${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 2 }).format(Number(value ?? 0))} m2`;
}
