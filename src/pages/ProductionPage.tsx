import { FileText, Factory, Plus, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { canManageUsers } from "../lib/roles";
import { createProductionOrder, getProductionOrders } from "../lib/firestore";
import {
  buildProductionPdfPath,
  buildProductionPositionImagePath,
  buildProductionPreviewPath,
  uploadFile
} from "../lib/storageUpload";
import type { ProductionOrder, ProductionOrderPosition, ProductionOrderPriority } from "../types";
import { parseProductionPdf, type ParsedProductionPdf } from "../utils/productionPdf";

const priorityLabels: Record<ProductionOrderPriority, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baja: "Baja"
};

export default function ProductionPage() {
  const { profile } = useAuth();
  const canCreate = canManageUsers(profile);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  async function loadOrders() {
    setLoading(true);
    try {
      setOrders(await getProductionOrders());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las ordenes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOrders(); }, []);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Fabrica</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">PRODUCCION</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Ordenes de produccion cargadas desde los documentos de cada obra.
          </p>
        </div>
        {canCreate ? (
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => { setError(""); setMessage(""); setOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear orden de produccion
          </button>
        ) : null}
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      {loading ? <StateCard text="Cargando ordenes de produccion..." /> : orders.length ? (
        <section className="grid gap-3">
          {orders.map((order) => <OrderCard key={order.id} order={order} />)}
        </section>
      ) : <EmptyState text="Todavia no hay ordenes de produccion cargadas." />}

      {open ? <ProductionOrderModal onClose={() => setOpen(false)} onCreated={async () => { setOpen(false); setMessage("Orden de produccion creada correctamente."); await loadOrders(); }} onError={setError} /> : null}
    </div>
  );
}

function ProductionOrderModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: () => Promise<void>; onError: (message: string) => void }) {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedProductionPdf | null>(null);
  const [form, setForm] = useState({ obraNombre: "", cliente: "", ubicacion: "", fechaComprometida: "", prioridad: "normal" as ProductionOrderPriority, observaciones: "" });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  async function selectPdf(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") { onError("Seleccioná un archivo PDF."); return; }
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
    setParsed((current) => current ? { ...current, posiciones: current.posiciones.map((position) => position.id === id ? { ...position, ...data } : position) } : current);
  }

  function addPosition() {
    setParsed((current) => current ? { ...current, posiciones: [...current.posiciones, newPosition(String(current.posiciones.length + 1))] } : current);
  }

  function removePosition(id: string) {
    setParsed((current) => current ? { ...current, posiciones: current.posiciones.filter((position) => position.id !== id) } : current);
  }

  async function confirmOrder() {
    if (!sourceFile || !parsed || !profile) return;
    if (!form.obraNombre.trim() || !parsed.posiciones.length) { onError("Completá la obra y dejá al menos una posición."); return; }
    setBusy(true);
    onError("");
    try {
      const orderId = `orden-${Date.now()}`;
      const pdfPath = buildProductionPdfPath(orderId, sourceFile);
      const previewPath = buildProductionPreviewPath(orderId, parsed.previewImage);
      const [pdfUrl, previewUrl] = await Promise.all([saveFile(pdfPath, sourceFile), saveFile(previewPath, parsed.previewImage)]);
      const positions = await Promise.all(parsed.posiciones.map(async (position, index) => {
        const imageFile = parsed.positionImages[index];
        if (!imageFile) return position;
        const imagePath = buildProductionPositionImagePath(orderId, position.id, imageFile);
        return { ...position, imagenUrl: await saveFile(imagePath, imageFile), imagenStoragePath: imagePath };
      }));

      await createProductionOrder({
        numero: parsed.numero,
        obraNombre: form.obraNombre.trim(),
        cliente: form.cliente.trim() || undefined,
        ubicacion: form.ubicacion.trim() || undefined,
        fechaCreacionDocumento: parsed.fechaCreacionDocumento,
        fechaComprometida: form.fechaComprometida || undefined,
        observaciones: form.observaciones.trim() || undefined,
        prioridad: form.prioridad,
        estado: "recibida",
        pdfUrl,
        pdfStoragePath: pdfPath,
        pdfFileName: sourceFile.name,
        pdfUploadedAt: new Date().toISOString(),
        previewImageUrl: previewUrl,
        previewImageStoragePath: previewPath,
        posiciones: positions,
        createdAt: new Date().toISOString(),
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
      <section className="mx-auto max-w-6xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase text-next-blue">Nueva orden</p><h2 className="mt-1 text-2xl font-black text-next-text">Cargar orden desde PDF</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        {!parsed ? (
          <button className="mt-6 flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-next-blue bg-next-light text-next-blue" type="button" onClick={() => inputRef.current?.click()} disabled={reading}>
            <Upload className="h-10 w-10" aria-hidden="true" /><span className="text-lg font-black">{reading ? "Leyendo PDF..." : "Seleccionar PDF de la obra"}</span><span className="text-sm font-semibold text-next-muted">Se leerán las posiciones y sus imágenes de referencia.</span>
            <input ref={inputRef} className="hidden" type="file" accept="application/pdf" onChange={(event) => void selectPdf(event.target.files?.[0])} />
          </button>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div><img className="w-full rounded-md border border-slate-200 object-contain" src={URL.createObjectURL(parsed.previewImage)} alt="Vista previa del PDF" /><p className="mt-2 text-xs font-semibold text-next-muted">{sourceFile?.name}</p></div>
            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Obra" value={form.obraNombre} onChange={(value) => setForm({ ...form, obraNombre: value })} />
                <Field label="Cliente" value={form.cliente} onChange={(value) => setForm({ ...form, cliente: value })} />
                <Field label="Ubicación" value={form.ubicacion} onChange={(value) => setForm({ ...form, ubicacion: value })} />
                <Field label="Fecha comprometida" type="date" value={form.fechaComprometida} onChange={(value) => setForm({ ...form, fechaComprometida: value })} />
                <label className="text-xs font-black uppercase text-next-muted">Prioridad<select className="field mt-1" value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value as ProductionOrderPriority })}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-black uppercase text-next-muted">Observaciones<textarea className="field mt-1 min-h-10" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></label>
              </div>
              <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-next-text">Posiciones ({parsed.posiciones.length})</h3><button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={addPosition}>+ Agregar posición</button></div>
              <div className="grid gap-3">{parsed.posiciones.map((position) => <PositionEditor key={position.id} position={position} onChange={(data) => updatePosition(position.id, data)} onRemove={() => removePosition(position.id)} />)}</div>
              <div className="flex justify-end gap-2"><button className="h-10 rounded-md border border-slate-200 px-4 text-xs font-black text-next-muted" type="button" onClick={onClose}>Cancelar</button><button className="h-10 rounded-md bg-next-blue px-4 text-xs font-black text-white disabled:opacity-60" type="button" disabled={busy} onClick={() => void confirmOrder()}>{busy ? "Guardando PDF e imágenes..." : "Aceptar y enviar a producción"}</button></div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PositionEditor({ position, onChange, onRemove }: { position: ProductionOrderPosition; onChange: (data: Partial<ProductionOrderPosition>) => void; onRemove: () => void }) {
  return <article className="grid gap-3 rounded-lg border border-slate-200 bg-next-bg p-3 md:grid-cols-[90px_150px_minmax(0,1fr)_130px_44px] md:items-end">
    <Field label="Posición" value={position.numero} onChange={(value) => onChange({ numero: value })} />
    <Field label="Código" value={position.codigo ?? ""} onChange={(value) => onChange({ codigo: value })} />
    <Field label="Descripción" value={position.descripcion} onChange={(value) => onChange({ descripcion: value })} />
    <Field label="Cantidad" type="number" value={String(position.cantidadTotal)} onChange={(value) => { const quantity = Math.max(0, Number(value) || 0); onChange({ cantidadTotal: quantity, cantidadPendiente: quantity }); }} />
    <button className="inline-flex h-10 items-center justify-center rounded-md border border-red-100 text-next-red" type="button" onClick={onRemove} aria-label="Eliminar posición"><X className="h-4 w-4" /></button>
    <div className="md:col-span-5 grid gap-2 text-xs font-semibold text-next-muted md:grid-cols-4"><span>Medida: {position.ancho ?? "-"} × {position.alto ?? "-"} mm</span><span>Color: {position.color ?? "-"}</span><span>Línea: {position.linea ?? "-"}</span><span>Imagen de referencia guardada</span></div>
  </article>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-xs font-black uppercase text-next-muted">{label}<input className="field mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function OrderCard({ order }: { order: ProductionOrder }) { return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-next-light px-2 py-1 text-[11px] font-black uppercase text-next-blue">{priorityLabels[order.prioridad]}</span><span className="text-xs font-bold uppercase text-next-muted">{order.estado.replace(/_/g, " ")}</span></div><h2 className="mt-2 text-xl font-black text-next-text">{order.obraNombre}</h2><p className="mt-1 text-sm font-semibold text-next-muted">{order.numero ? `Orden ${order.numero} · ` : ""}{order.pdfFileName}</p></div><div className="flex items-center gap-2 text-sm font-black text-next-blue"><Factory className="h-5 w-5" />{order.posiciones.length} posiciones</div></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{order.posiciones.map((position) => <div key={position.id} className="rounded-md bg-next-bg px-3 py-2"><p className="text-xs font-black text-next-text">POS. {position.numero} · {position.descripcion}</p><p className="mt-1 text-xs font-semibold text-next-muted">{position.ancho} × {position.alto} mm · {position.cantidadTotal} unidades</p></div>)}</div>{order.pdfUrl ? <a className="mt-4 inline-flex items-center gap-2 text-xs font-black text-next-blue underline" href={order.pdfUrl} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> Ver PDF original</a> : null}</article>; }
function isDemoEnvironment() { return !import.meta.env.PROD || !import.meta.env.VITE_FIREBASE_PROJECT_ID; }
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("No se pudo preparar el archivo.")); reader.readAsDataURL(file); }); }
function StateCard({ text }: { text: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-bold text-next-muted shadow-soft">{text}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red"}`}>{text}</div>; }
function newPosition(numero: string): ProductionOrderPosition { return { id: `manual-pos-${Date.now()}-${numero}`, numero, descripcion: "Nueva abertura", cantidadTotal: 1, cantidadPendiente: 1, cantidadEnProduccion: 0, cantidadTerminada: 0, estado: "pendiente" }; }
