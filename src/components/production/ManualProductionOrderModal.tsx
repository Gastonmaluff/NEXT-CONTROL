import { AlertCircle, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { createProductionOrder } from "../../lib/firestore";
import { isFirebaseConfigured } from "../../lib/firebase";
import { isDemoSession } from "../../lib/storage";
import { buildProductionPositionImagePath, uploadFile } from "../../lib/storageUpload";
import type { ProductionOrderPosition, ProductionOrderPriority, SystemUser } from "../../types";
import { materializeProductionAttachments, type ProductionAttachmentDraft } from "../../utils/productionAttachments";
import ProductionAttachmentsComposer from "./ProductionAttachmentsComposer";

type ManualItem = {
  id: string;
  descripcion: string;
  cantidad: string;
  codigo: string;
  ancho: string;
  alto: string;
  color: string;
  linea: string;
  vidrio: string;
  detalles: string;
  imagen: File | null;
};

type Props = {
  workers: SystemUser[];
  onClose: () => void;
  onCreated: () => Promise<void>;
};

function emptyItem(): ManualItem {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random()}`,
    descripcion: "", cantidad: "1", codigo: "", ancho: "", alto: "", color: "", linea: "", vidrio: "", detalles: "", imagen: null
  };
}

export default function ManualProductionOrderModal({ workers, onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    obraNombre: "", cliente: "", ubicacion: "", fechaComprometida: "",
    prioridad: "normal" as ProductionOrderPriority, observaciones: "", assignedToUid: ""
  });
  const [items, setItems] = useState<ManualItem[]>(() => [emptyItem()]);
  const [attachmentDrafts, setAttachmentDrafts] = useState<ProductionAttachmentDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  function updateItem(id: string, data: Partial<ManualItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...data } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !profile) return;

    const worker = workers.find((user) => user.uid === form.assignedToUid);
    if (!form.obraNombre.trim()) { setError("Indicá el nombre del trabajo u obra."); return; }
    if (!worker) { setError("Elegí el responsable de Producción / Taller."); return; }
    if (!items.length || items.some((item) => !item.descripcion.trim() || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) < 1)) {
      setError("Cada ítem necesita una descripción y una cantidad entera mayor a cero.");
      return;
    }
    if (items.some((item) => [item.ancho, item.alto].some((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) <= 0)))) {
      setError("Las medidas, cuando se indiquen, deben ser mayores a cero.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const timestamp = new Date().toISOString();
      const orderId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const positions: ProductionOrderPosition[] = await Promise.all(items.map(async (item, index) => {
        const quantity = Number(item.cantidad);
        const position: ProductionOrderPosition = {
          id: item.id,
          numero: String(index + 1).padStart(2, "0"),
          descripcion: item.descripcion.trim(),
          cantidadTotal: quantity,
          cantidadPendiente: quantity,
          cantidadEnProduccion: 0,
          cantidadTerminada: 0,
          estado: "pendiente",
          codigo: item.codigo.trim() || undefined,
          ancho: item.ancho ? Number(item.ancho) : undefined,
          alto: item.alto ? Number(item.alto) : undefined,
          color: item.color.trim() || undefined,
          linea: item.linea.trim() || undefined,
          vidrio: item.vidrio.trim() || undefined,
          detalles: item.detalles.trim() || undefined
        };
        if (!item.imagen) return position;
        const imagePath = buildProductionPositionImagePath(orderId, item.id, item.imagen);
        const imageUrl = !isFirebaseConfigured() || isDemoSession()
          ? await fileToDataUrl(item.imagen)
          : await uploadFile(imagePath, item.imagen);
        return { ...position, imagenUrl: imageUrl, imagenStoragePath: imagePath };
      }));
      const materialesApoyo = await materializeProductionAttachments(orderId, attachmentDrafts, { uid: profile.uid, nombre: profile.nombre });

      await createProductionOrder({
        origen: "manual",
        numero: `MAN-${Date.now().toString(36).toUpperCase()}`,
        obraNombre: form.obraNombre.trim(),
        cliente: form.cliente.trim() || undefined,
        ubicacion: form.ubicacion.trim() || undefined,
        fechaComprometida: form.fechaComprometida || undefined,
        observaciones: form.observaciones.trim() || undefined,
        prioridad: form.prioridad,
        estado: "recibida",
        assignedToUid: worker.uid,
        assignedToName: worker.nombre,
        assignedAt: timestamp,
        responsable: worker.nombre,
        materialesApoyo,
        posiciones: positions,
        createdAt: timestamp,
        createdBy: profile.uid
      });
      await onCreated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear la orden manual.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-3 py-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby="manual-order-title">
      <form className="mx-auto max-w-5xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6" onSubmit={(event) => void submit(event)}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase text-next-blue">Producción / taller</p><h2 id="manual-order-title" className="mt-1 text-2xl font-black text-next-text">Nueva orden manual</h2><p className="mt-1 text-sm font-semibold text-next-muted">Para trabajos sin PDF, como parasoles u otros pedidos especiales.</p></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Cerrar carga manual"><X className="h-5 w-5" /></button>
        </div>

        {error ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-next-red" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <TextField label="Trabajo u obra *" value={form.obraNombre} onChange={(value) => setForm({ ...form, obraNombre: value })} placeholder="Ej.: Parasol terraza" required />
          <TextField label="Cliente" value={form.cliente} onChange={(value) => setForm({ ...form, cliente: value })} />
          <TextField label="Ubicación" value={form.ubicacion} onChange={(value) => setForm({ ...form, ubicacion: value })} />
          <TextField label="Fecha comprometida" type="date" value={form.fechaComprometida} onChange={(value) => setForm({ ...form, fechaComprometida: value })} />
          <label className="text-xs font-black uppercase text-next-muted">Prioridad<select className="field mt-1" value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value as ProductionOrderPriority })}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="baja">Baja</option></select></label>
          <label className="text-xs font-black uppercase text-next-muted">Responsable de taller *<select className="field mt-1" value={form.assignedToUid} onChange={(event) => setForm({ ...form, assignedToUid: event.target.value })} required><option value="">Elegir usuario...</option>{workers.map((worker) => <option key={worker.uid} value={worker.uid}>{worker.nombre}</option>)}</select></label>
          <label className="text-xs font-black uppercase text-next-muted md:col-span-2">Instrucciones generales<textarea className="field mt-1 min-h-20" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} placeholder="Indicaciones para todo el trabajo" /></label>
        </div>

        <div className="mt-5"><ProductionAttachmentsComposer drafts={attachmentDrafts} onChange={setAttachmentDrafts} disabled={saving} /></div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-next-text">Ítems a fabricar ({items.length})</h3><p className="text-xs font-semibold text-next-muted">Cada ítem tendrá su propia cantidad y avance en taller.</p></div><button className="inline-flex h-9 items-center gap-1 rounded-lg border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => setItems((current) => [...current, emptyItem()])} disabled={saving}><Plus className="h-4 w-4" aria-hidden="true" /> Agregar ítem</button></div>
        <div className="mt-3 space-y-3">{items.map((item, index) => (
          <section key={item.id} className="rounded-xl border border-slate-200 bg-next-bg p-3 sm:p-4" aria-label={`Ítem ${index + 1}`}>
            <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-sm font-black text-next-text">Ítem {index + 1}</h4><button className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-black text-next-red disabled:opacity-40" type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} disabled={saving || items.length === 1} aria-label={`Quitar ítem ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /> Quitar</button></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-3"><TextField label="Qué hay que fabricar *" value={item.descripcion} onChange={(value) => updateItem(item.id, { descripcion: value })} placeholder="Ej.: Parasol de aluminio" required /></div>
              <TextField label="Cantidad *" type="number" min="1" step="1" value={item.cantidad} onChange={(value) => updateItem(item.id, { cantidad: value })} required />
              <TextField label="Código o referencia" value={item.codigo} onChange={(value) => updateItem(item.id, { codigo: value })} />
              <TextField label="Ancho (mm)" type="number" min="0.01" step="any" value={item.ancho} onChange={(value) => updateItem(item.id, { ancho: value })} />
              <TextField label="Alto (mm)" type="number" min="0.01" step="any" value={item.alto} onChange={(value) => updateItem(item.id, { alto: value })} />
              <TextField label="Color / acabado" value={item.color} onChange={(value) => updateItem(item.id, { color: value })} />
              <TextField label="Línea / material" value={item.linea} onChange={(value) => updateItem(item.id, { linea: value })} />
              <TextField label="Vidrio (si aplica)" value={item.vidrio} onChange={(value) => updateItem(item.id, { vidrio: value })} />
              <label className="text-xs font-black uppercase text-next-muted sm:col-span-2">Instrucciones del ítem<textarea className="field mt-1 min-h-20" value={item.detalles} onChange={(event) => updateItem(item.id, { detalles: event.target.value })} placeholder="Medidas especiales, materiales o indicaciones de fabricación" /></label>
              <label className="flex min-h-20 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-xs font-black text-next-blue sm:col-span-2 lg:col-span-4"><ImagePlus className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="truncate">{item.imagen ? item.imagen.name : "Agregar imagen de referencia (opcional)"}</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) { setError("La imagen debe ser PNG, JPG o WebP y pesar hasta 15 MB."); event.target.value = ""; return; } setError(""); updateItem(item.id, { imagen: file }); }} /></label>
            </div>
          </section>
        ))}</div>

        <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row"><button className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-next-muted" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="h-11 rounded-xl bg-next-blue px-5 text-sm font-black text-white disabled:opacity-50" type="submit" disabled={saving || !workers.length}>{saving ? "Creando orden..." : "Crear y asignar orden"}</button></div>
      </form>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder, required, min, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; min?: string; step?: string }) {
  return <label className="block text-xs font-black uppercase text-next-muted">{label}<input className="field mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} min={min} step={step} /></label>;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo preparar la imagen."));
    reader.readAsDataURL(file);
  });
}
