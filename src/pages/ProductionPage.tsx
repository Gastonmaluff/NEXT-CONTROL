import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Factory,
  PackageCheck,
  Paperclip,
  Plus,
  Trash2,
  UserRound,
  Upload,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createProductionOrder,
  getProductionOrders,
  subscribeToProductionOrders,
  updateProductionOrder
} from "../lib/firestore";
import { canManageProductionOrders, isAdmin } from "../lib/roles";
import {
  buildProductionPdfPath,
  buildProductionPositionImagePath,
  buildProductionPreviewPath,
  uploadFile
} from "../lib/storageUpload";
import { getSystemUsers } from "../lib/users";
import type {
  ProductionOrder,
  ProductionOrderPosition,
  ProductionOrderPriority,
  SystemUser
} from "../types";
import { parseProductionPdf, type ParsedProductionPdf } from "../utils/productionPdf";
import { materializeProductionAttachments, type ProductionAttachmentDraft } from "../utils/productionAttachments";
import { getProductionMissingItems, getProductionOrderProgress, getProductionOrderStatus, resolveProductionMissingItem } from "../utils/productionOrders";
import AddProductionMaterialsModal from "../components/production/AddProductionMaterialsModal";
import ProductionOrderPreviewDialog from "../components/production/ProductionOrderPreviewDialog";
import ProductionAttachmentsComposer from "../components/production/ProductionAttachmentsComposer";
import ManualProductionOrderModal from "../components/production/ManualProductionOrderModal";
import DeleteProductionOrderModal from "../components/production/DeleteProductionOrderModal";

const priorityLabels: Record<ProductionOrderPriority, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baja: "Baja"
};

const statusLabels: Record<ProductionOrder["estado"], string> = {
  recibida: "Recibida",
  en_produccion: "En producción",
  parcial: "Avance parcial",
  terminada: "Terminada",
  bloqueada: "Bloqueada"
};

export default function ProductionPage() {
  const { profile } = useAuth();
  const canCreate = canManageProductionOrders(profile);
  const canDeleteOrders = isAdmin(profile);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [workers, setWorkers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const [materialOrderId, setMaterialOrderId] = useState<string | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [assigningOrderId, setAssigningOrderId] = useState("");
  const [savingMissingId, setSavingMissingId] = useState("");
  const previewOrder = previewOrderId ? orders.find((order) => order.id === previewOrderId) ?? null : null;
  const materialOrder = materialOrderId ? orders.find((order) => order.id === materialOrderId) ?? null : null;
  const deleteOrder = deleteOrderId ? orders.find((order) => order.id === deleteOrderId) ?? null : null;

  useEffect(() => {
    const unsubscribe = subscribeToProductionOrders(
      (nextOrders) => {
        setOrders(nextOrders);
        setLoading(false);
      },
      (loadError) => {
        setError(loadError.message);
        setLoading(false);
      }
    );

    void getSystemUsers()
      .then((users) => {
        setWorkers(users.filter((user) => user.active && ["produccion", "taller"].includes(user.role)));
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los responsables de taller.");
      })
      .finally(() => setWorkersLoading(false));

    return unsubscribe;
  }, []);

  const summary = useMemo(() => orders.reduce(
    (result, order) => {
      const progress = getProductionOrderProgress(order.posiciones);
      result.total += progress.total;
      result.pending += progress.pending;
      result.inProduction += progress.inProduction;
      result.finished += progress.finished;
      result.missing += order.posiciones.reduce((sum, position) => sum + getProductionMissingItems(position).length, 0);
      if (order.estado !== "terminada") result.activeOrders += 1;
      return result;
    },
    { activeOrders: 0, total: 0, pending: 0, inProduction: 0, finished: 0, missing: 0 }
  ), [orders]);

  async function refreshOrders() {
    setOrders(await getProductionOrders());
  }

  async function assignOrder(order: ProductionOrder, uid: string) {
    const worker = workers.find((user) => user.uid === uid);
    if (!worker || assigningOrderId) return;
    setAssigningOrderId(order.id);
    setError("");
    setMessage("");
    try {
      const updated = await updateProductionOrder(order.id, {
        assignedToUid: worker.uid,
        assignedToName: worker.nombre,
        assignedAt: new Date().toISOString(),
        responsable: worker.nombre
      });
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Orden de ${order.obraNombre} asignada a ${worker.nombre}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo asignar la orden.");
    } finally {
      setAssigningOrderId("");
    }
  }

  async function resolveMissing(order: ProductionOrder, position: ProductionOrderPosition, missingItemId: string) {
    const nextPosition = resolveProductionMissingItem(position, missingItemId, profile?.nombre ?? "Administrador");
    setSavingMissingId(`${order.id}:${missingItemId}`);
    setError("");
    setMessage("");
    try {
      const positions = order.posiciones.map((item) => item.id === position.id ? nextPosition : item);
      const updated = await updateProductionOrder(order.id, {
        posiciones: positions,
        estado: getProductionOrderStatus(positions)
      });
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage("Faltante marcado como resuelto.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el faltante.");
    } finally {
      setSavingMissingId("");
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Panel de fábrica</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">PRODUCCIÓN / TALLER</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Creá órdenes desde un PDF o cargalas manualmente, asignalas al taller y seguí su avance en tiempo real.
          </p>
        </div>
        {canCreate ? <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-next-blue bg-white px-4 text-sm font-black text-next-blue shadow-sm" type="button" onClick={() => { setError(""); setMessage(""); setManualOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Carga manual
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-next-blue px-4 text-sm font-black text-white shadow-sm" type="button" onClick={() => { setError(""); setMessage(""); setOpen(true); }}>
            <Upload className="h-4 w-4" aria-hidden="true" /> Nueva orden desde PDF
          </button>
        </div> : null}
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      {!workers.length && !workersLoading ? (
        <Notice tone="warning" text="Todavía no hay usuarios activos con rol Taller o Producción. Creá uno en Usuarios para poder asignarle órdenes." />
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metric icon={Factory} label="Órdenes activas" value={summary.activeOrders} tone="blue" />
        <Metric icon={Clock3} label="Unidades pendientes" value={summary.pending} tone="orange" />
        <Metric icon={PackageCheck} label="En producción" value={summary.inProduction} tone="indigo" />
        <Metric icon={CheckCircle2} label="Terminadas" value={summary.finished} tone="green" />
        <Metric icon={AlertCircle} label="Faltantes" value={summary.missing} tone="orange" />
      </section>

      {loading ? <StateCard text="Cargando órdenes de producción..." /> : orders.length ? (
        <section className="grid gap-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              workers={workers}
              assigning={assigningOrderId === order.id}
              onAssign={(uid) => void assignOrder(order, uid)}
              onPreview={() => setPreviewOrderId(order.id)}
              onAddMaterial={() => setMaterialOrderId(order.id)}
              canDelete={canDeleteOrders}
              onDelete={() => setDeleteOrderId(order.id)}
              savingMissingId={savingMissingId}
              onResolveMissing={(position, missingItemId) => void resolveMissing(order, position, missingItemId)}
            />
          ))}
        </section>
      ) : <EmptyState text="Todavía no hay órdenes de producción cargadas." />}

      {previewOrder ? <ProductionOrderPreviewDialog order={previewOrder} onClose={() => setPreviewOrderId(null)} /> : null}

      {materialOrder ? <AddProductionMaterialsModal order={materialOrder} onClose={() => setMaterialOrderId(null)} onUpdated={(updated) => {
        setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
        setMessage("Documentos agregados a la orden.");
      }} /> : null}

      {deleteOrder && canDeleteOrders ? <DeleteProductionOrderModal order={deleteOrder} onClose={() => setDeleteOrderId(null)} onDeleted={(orderId) => {
        setOrders((current) => current.filter((order) => order.id !== orderId));
        setMessage("Orden de trabajo eliminada.");
      }} /> : null}

      {manualOpen ? <ManualProductionOrderModal
        workers={workers}
        onClose={() => setManualOpen(false)}
        onCreated={async () => {
          setManualOpen(false);
          setMessage("Orden manual creada y enviada al responsable de taller.");
          await refreshOrders();
        }}
      /> : null}

      {open ? (
        <ProductionOrderModal
          workers={workers}
          onClose={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            setMessage("Orden creada y enviada al responsable de taller.");
            await refreshOrders();
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function ProductionOrderModal({
  workers,
  onClose,
  onCreated,
  onError
}: {
  workers: SystemUser[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedProductionPdf | null>(null);
  const [attachmentDrafts, setAttachmentDrafts] = useState<ProductionAttachmentDraft[]>([]);
  const [form, setForm] = useState({
    obraNombre: "",
    cliente: "",
    ubicacion: "",
    fechaComprometida: "",
    prioridad: "normal" as ProductionOrderPriority,
    observaciones: "",
    assignedToUid: ""
  });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const previewUrl = useMemo(() => parsed ? URL.createObjectURL(parsed.previewImage) : "", [parsed]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function selectPdf(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      onError("Seleccioná un archivo PDF.");
      return;
    }
    setReading(true);
    onError("");
    try {
      const result = await parseProductionPdf(file);
      setSourceFile(file);
      setParsed(result);
      setForm((current) => ({ ...current, obraNombre: result.obraNombre }));
    } catch (parseError) {
      onError(parseError instanceof Error ? parseError.message : "No se pudo leer el PDF.");
    } finally {
      setReading(false);
    }
  }

  function updatePosition(id: string, data: Partial<ProductionOrderPosition>) {
    setParsed((current) => current ? {
      ...current,
      posiciones: current.posiciones.map((position) => position.id === id ? { ...position, ...data } : position)
    } : current);
  }

  function addPosition() {
    setParsed((current) => current ? {
      ...current,
      posiciones: [...current.posiciones, newPosition(String(current.posiciones.length + 1))]
    } : current);
  }

  function removePosition(id: string) {
    setParsed((current) => current ? {
      ...current,
      posiciones: current.posiciones.filter((position) => position.id !== id)
    } : current);
  }

  async function confirmOrder() {
    if (!sourceFile || !parsed || !profile) return;
    const assignedWorker = workers.find((user) => user.uid === form.assignedToUid);
    if (!form.obraNombre.trim() || !parsed.posiciones.length) {
      onError("Completá la obra y dejá al menos una posición.");
      return;
    }
    if (!assignedWorker) {
      onError("Elegí el responsable de Producción / Taller que recibirá esta orden.");
      return;
    }

    setBusy(true);
    onError("");
    try {
      const orderId = `orden-${Date.now()}`;
      const pdfPath = buildProductionPdfPath(orderId, sourceFile);
      const previewPath = buildProductionPreviewPath(orderId, parsed.previewImage);
      const [pdfUrl, previewImageUrl, materialesApoyo] = await Promise.all([
        saveFile(pdfPath, sourceFile),
        saveFile(previewPath, parsed.previewImage),
        materializeProductionAttachments(orderId, attachmentDrafts, { uid: profile.uid, nombre: profile.nombre })
      ]);
      const positions = await Promise.all(parsed.posiciones.map(async (position, index) => {
        const imageFile = parsed.positionImages[index];
        if (!imageFile) return position;
        const imagePath = buildProductionPositionImagePath(orderId, position.id, imageFile);
        return { ...position, imagenUrl: await saveFile(imagePath, imageFile), imagenStoragePath: imagePath };
      }));
      const timestamp = new Date().toISOString();

      await createProductionOrder({
        origen: "pdf",
        numero: parsed.numero,
        obraNombre: form.obraNombre.trim(),
        cliente: form.cliente.trim() || undefined,
        ubicacion: form.ubicacion.trim() || undefined,
        fechaCreacionDocumento: parsed.fechaCreacionDocumento,
        fechaComprometida: form.fechaComprometida || undefined,
        observaciones: form.observaciones.trim() || undefined,
        prioridad: form.prioridad,
        estado: "recibida",
        assignedToUid: assignedWorker.uid,
        assignedToName: assignedWorker.nombre,
        assignedAt: timestamp,
        responsable: assignedWorker.nombre,
        pdfUrl,
        pdfStoragePath: pdfPath,
        pdfFileName: sourceFile.name,
        pdfUploadedAt: timestamp,
        previewImageUrl,
        previewImageStoragePath: previewPath,
        materialesApoyo,
        posiciones: positions,
        createdAt: timestamp,
        createdBy: profile.uid
      });
      await onCreated();
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "No se pudo guardar la orden.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFile(path: string, file: File): Promise<string> {
    if (isDemoEnvironment()) return fileToDataUrl(file);
    return uploadFile(path, file);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-6xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase text-next-blue">Nueva orden</p><h2 className="mt-1 text-2xl font-black text-next-text">Cargar orden desde PDF</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        {!parsed ? (
          <button className="mt-6 flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-next-blue bg-next-light text-next-blue" type="button" onClick={() => inputRef.current?.click()} disabled={reading}>
            <Upload className="h-10 w-10" aria-hidden="true" /><span className="text-lg font-black">{reading ? "Leyendo PDF..." : "Seleccionar PDF de la obra"}</span><span className="text-sm font-semibold text-next-muted">Se leerán las posiciones y sus imágenes de referencia.</span>
            <input ref={inputRef} className="hidden" type="file" accept="application/pdf" onChange={(event) => void selectPdf(event.target.files?.[0])} />
          </button>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div><img className="w-full rounded-xl border border-slate-200 object-contain" src={previewUrl} alt="Vista previa del PDF" /><p className="mt-2 text-xs font-semibold text-next-muted">{sourceFile?.name}</p></div>
            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Obra" value={form.obraNombre} onChange={(value) => setForm({ ...form, obraNombre: value })} />
                <Field label="Cliente" value={form.cliente} onChange={(value) => setForm({ ...form, cliente: value })} />
                <Field label="Ubicación" value={form.ubicacion} onChange={(value) => setForm({ ...form, ubicacion: value })} />
                <Field label="Fecha comprometida" type="date" value={form.fechaComprometida} onChange={(value) => setForm({ ...form, fechaComprometida: value })} />
                <label className="text-xs font-black uppercase text-next-muted">Prioridad<select className="field mt-1" value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value as ProductionOrderPriority })}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-black uppercase text-next-muted">Responsable de taller *<select className="field mt-1" required value={form.assignedToUid} onChange={(event) => setForm({ ...form, assignedToUid: event.target.value })}><option value="">Elegir usuario...</option>{workers.map((worker) => <option key={worker.uid} value={worker.uid}>{worker.nombre} · {worker.role}</option>)}</select></label>
                <label className="text-xs font-black uppercase text-next-muted md:col-span-2">Observaciones<textarea className="field mt-1 min-h-20" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></label>
              </div>
              <ProductionAttachmentsComposer drafts={attachmentDrafts} onChange={setAttachmentDrafts} disabled={busy} />
              <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-next-text">Posiciones ({parsed.posiciones.length})</h3><button className="h-9 rounded-lg border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={addPosition}>+ Agregar posición</button></div>
              <div className="grid gap-3">{parsed.posiciones.map((position) => <PositionEditor key={position.id} position={position} onChange={(data) => updatePosition(position.id, data)} onRemove={() => removePosition(position.id)} />)}</div>
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><button className="h-11 rounded-xl border border-slate-200 px-4 text-xs font-black text-next-muted" type="button" onClick={onClose}>Cancelar</button><button className="h-11 rounded-xl bg-next-blue px-4 text-xs font-black text-white disabled:opacity-60" type="button" disabled={busy || !workers.length} onClick={() => void confirmOrder()}>{busy ? "Guardando PDF e imágenes..." : "Crear y asignar orden"}</button></div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PositionEditor({ position, onChange, onRemove }: { position: ProductionOrderPosition; onChange: (data: Partial<ProductionOrderPosition>) => void; onRemove: () => void }) {
  return <article className="grid gap-3 rounded-xl border border-slate-200 bg-next-bg p-3 md:grid-cols-[90px_150px_minmax(0,1fr)_130px_44px] md:items-end"><Field label="Posición" value={position.numero} onChange={(value) => onChange({ numero: value })} /><Field label="Código" value={position.codigo ?? ""} onChange={(value) => onChange({ codigo: value })} /><Field label="Descripción" value={position.descripcion} onChange={(value) => onChange({ descripcion: value })} /><Field label="Cantidad" type="number" value={String(position.cantidadTotal)} onChange={(value) => { const quantity = Math.max(0, Number(value) || 0); onChange({ cantidadTotal: quantity, cantidadPendiente: quantity, cantidadEnProduccion: 0, cantidadTerminada: 0, estado: "pendiente" }); }} /><button className="inline-flex h-10 items-center justify-center rounded-lg border border-red-100 text-next-red" type="button" onClick={onRemove} aria-label="Eliminar posición"><X className="h-4 w-4" /></button><div className="grid gap-2 text-xs font-semibold text-next-muted md:col-span-5 md:grid-cols-4"><span>Medida: {position.ancho ?? "-"} × {position.alto ?? "-"} mm</span><span>Color: {position.color ?? "-"}</span><span>Línea: {position.linea ?? "-"}</span><span>Imagen de referencia guardada</span></div></article>;
}

function OrderCard({ order, workers, assigning, onAssign, onPreview, onAddMaterial, canDelete, onDelete, savingMissingId, onResolveMissing }: { order: ProductionOrder; workers: SystemUser[]; assigning: boolean; onAssign: (uid: string) => void; onPreview: () => void; onAddMaterial: () => void; canDelete: boolean; onDelete: () => void; savingMissingId: string; onResolveMissing: (position: ProductionOrderPosition, missingItemId: string) => void }) {
  const progress = getProductionOrderProgress(order.posiciones);
  const missingCount = order.posiciones.reduce((sum, position) => sum + getProductionMissingItems(position).length, 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-next-light px-2.5 py-1 text-[11px] font-black uppercase text-next-blue">{priorityLabels[order.prioridad]}</span>
              <span className={`text-xs font-bold uppercase ${order.estado === "bloqueada" ? "text-next-orange" : "text-next-muted"}`}>{statusLabels[order.estado]}</span>
              {missingCount ? <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black uppercase text-next-orange">{missingCount} faltante{missingCount === 1 ? "" : "s"}</span> : null}
              {order.materialesApoyo?.length ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase text-next-blue">{order.materialesApoyo.length} adjunto{order.materialesApoyo.length === 1 ? "" : "s"}</span> : null}
            </div>
            <h2 className="mt-2 text-xl font-black text-next-text sm:text-2xl">{order.obraNombre}</h2>
            <p className="mt-1 text-sm font-semibold text-next-muted">{order.numero ? `Orden ${order.numero} · ` : ""}{order.origen === "manual" ? "Carga manual" : order.pdfFileName ?? "Orden desde PDF"}</p>
          </div>
          <div className="flex flex-wrap items-end justify-start gap-2 lg:justify-end">
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-next-blue px-3 text-xs font-black text-next-blue transition hover:bg-next-light" type="button" onClick={onPreview} aria-label={`Ver vista de producción de ${order.obraNombre}`}>
              <Eye className="h-4 w-4" aria-hidden="true" /> Ver producción
            </button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-next-text transition hover:bg-next-bg" type="button" onClick={onAddMaterial} aria-label={`Agregar documentos a ${order.obraNombre}`}>
              <Paperclip className="h-4 w-4" aria-hidden="true" /> Agregar documentos
            </button>
            {canDelete ? <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-100 px-3 text-xs font-black text-next-red transition hover:bg-red-50" type="button" onClick={onDelete} aria-label={`Eliminar orden de ${order.obraNombre}`}><Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar orden</button> : null}
            <label className="min-w-0 text-xs font-black uppercase text-next-muted lg:w-72">
              Responsable de taller
              <select className={`field mt-1 ${order.assignedToUid ? "" : "border-orange-300 bg-orange-50"}`} value={order.assignedToUid ?? ""} disabled={assigning || !workers.length} onChange={(event) => onAssign(event.target.value)}>
                <option value="" disabled>{workers.length ? "Asignar usuario..." : "No hay usuarios de taller"}</option>
                {workers.map((worker) => <option key={worker.uid} value={worker.uid}>{worker.nombre}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-next-bg p-4">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs font-black uppercase text-next-muted">Avance total</p><p className="mt-1 text-sm font-bold text-next-text">{progress.finished} de {progress.total} unidades terminadas</p></div>
            <span className="text-3xl font-black text-next-blue">{progress.percentage}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-next-blue to-cyan-400 transition-[width]" style={{ width: `${progress.percentage}%` }} /></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-next-muted"><span>{progress.pending} pendientes</span><span>{progress.inProduction} en producción</span><span className="text-next-green">{progress.finished} terminadas</span></div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {order.posiciones.map((position) => {
            const itemProgress = getProductionOrderProgress([position]);
            const missingItems = getProductionMissingItems(position);
            return (
              <div key={position.id} className="rounded-xl border border-slate-100 px-3 py-3">
                <div className="flex items-start justify-between gap-2"><p className="text-xs font-black text-next-text">POS. {position.numero} · {position.descripcion}</p><span className="shrink-0 text-sm font-black text-next-blue">{itemProgress.percentage}%</span></div>
                <p className="mt-1 text-xs font-semibold text-next-muted">{position.ancho || position.alto ? `${position.ancho ?? "-"} × ${position.alto ?? "-"} mm · ` : ""}{itemProgress.finished}/{itemProgress.total} terminadas</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-next-blue" style={{ width: `${itemProgress.percentage}%` }} /></div>
                {missingItems.length ? (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                    <p className="text-[10px] font-black uppercase text-next-orange">Faltante informado</p>
                    <div className="mt-2 space-y-2">
                      {missingItems.map((missingItem) => (
                        <div key={missingItem.id} className="rounded-md bg-white p-2">
                          <p className="text-xs font-black text-next-text">{missingItem.descripcion}</p>
                          {missingItem.observacion ? <p className="mt-1 text-[11px] font-semibold text-next-muted">{missingItem.observacion}</p> : null}
                          <p className="mt-1 text-[10px] font-bold text-next-muted">Por {missingItem.reportadoPor} · {formatMissingDate(missingItem.reportadoAt)}</p>
                          <button className="mt-2 h-8 rounded-md border border-orange-300 px-2 text-[10px] font-black text-next-orange disabled:opacity-40" type="button" disabled={savingMissingId === `${order.id}:${missingItem.id}`} onClick={() => onResolveMissing(position, missingItem.id)}>{savingMissingId === `${order.id}:${missingItem.id}` ? "Guardando..." : "Marcar resuelto"}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs font-bold text-next-muted"><span className={`inline-flex items-center gap-1.5 ${order.assignedToUid ? "text-next-blue" : "text-next-orange"}`}><UserRound className="h-4 w-4" />{order.assignedToName ?? "Sin responsable asignado"}</span>{order.pdfUrl ? <a className="inline-flex items-center gap-2 text-next-blue underline" href={order.pdfUrl} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> Ver PDF original</a> : null}</div>
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: "blue" | "orange" | "indigo" | "green" }) { const colors = { blue: "text-next-blue bg-blue-50", orange: "text-next-orange bg-orange-50", indigo: "text-indigo-600 bg-indigo-50", green: "text-next-green bg-green-50" }; return <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-soft sm:p-4"><div><p className="text-[10px] font-black uppercase text-next-muted sm:text-xs">{label}</p><p className="mt-1 text-2xl font-black text-next-text sm:text-3xl">{value}</p></div><span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></span></div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-xs font-black uppercase text-next-muted">{label}<input className="field mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function isDemoEnvironment() { return !import.meta.env.PROD || !import.meta.env.VITE_FIREBASE_PROJECT_ID; }
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("No se pudo preparar el archivo.")); reader.readAsDataURL(file); }); }
function formatMissingDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "fecha desconocida" : date.toLocaleDateString("es-PY"); }
function StateCard({ text }: { text: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-bold text-next-muted shadow-soft">{text}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>; }
function Notice({ tone, text }: { tone: "success" | "error" | "warning"; text: string }) { const classes = tone === "success" ? "border-green-100 bg-green-50 text-next-green" : tone === "warning" ? "border-orange-100 bg-orange-50 text-next-orange" : "border-red-100 bg-red-50 text-next-red"; return <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${classes}`}>{tone === "warning" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : null}{text}</div>; }
function newPosition(numero: string): ProductionOrderPosition { return { id: `manual-pos-${Date.now()}-${numero}`, numero, descripcion: "Nueva abertura", cantidadTotal: 1, cantidadPendiente: 1, cantidadEnProduccion: 0, cantidadTerminada: 0, estado: "pendiente" }; }
