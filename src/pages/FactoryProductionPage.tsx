import { AlertTriangle, CheckCircle2, ClipboardList, Factory, Image as ImageIcon, Package, Save, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getProductionOrders, updateProductionOrder } from "../lib/firestore";
import type { ProductionItemStatus, ProductionOrder, ProductionOrderPosition } from "../types";

const statusLabels: Record<ProductionItemStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "En producción",
  parcial: "Parcial",
  completado: "Terminado"
};

export default function FactoryProductionPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [draft, setDraft] = useState<ProductionOrderPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const nextOrders = await getProductionOrders();
      setOrders(nextOrders);
      if (!selected && nextOrders[0]) openOrder(nextOrders[0]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los trabajos de producción.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openOrder(order: ProductionOrder) {
    setSelected(order);
    setDraft(order.posiciones.map((position) => ({ ...position })));
    setMessage("");
    setError("");
  }

  function updatePosition(id: string, data: Partial<ProductionOrderPosition>) {
    setDraft((current) => current.map((position) => position.id === id ? { ...position, ...data } : position));
  }

  async function save() {
    if (!selected || !profile || saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateProductionOrder(selected.id, { posiciones: draft, estado: getOrderState(draft) });
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      setSelected(updated);
      setDraft(updated.posiciones.map((position) => ({ ...position })));
      setMessage("Avance guardado correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el avance.");
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => ({
    pendientes: countUnits(orders, "pendiente"),
    enProduccion: countUnits(orders, "en_proceso") + countUnits(orders, "parcial"),
    terminadas: countUnits(orders, "completado")
  }), [orders]);

  if (loading) return <StateCard text="Cargando trabajos de producción..." />;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Fábrica</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-next-text">Producción</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-next-muted">Registrá avances y completá las posiciones de tus órdenes.</p>
        </div>
        {orders.length > 1 ? <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-next-blue" type="button" onClick={() => setSelected(null)}>Ver órdenes</button> : null}
      </header>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Package} label="Pendientes" value={stats.pendientes} />
        <Metric icon={Factory} label="En producción" value={stats.enProduccion} tone="blue" />
        <Metric icon={CheckCircle2} label="Terminadas" value={stats.terminadas} tone="green" />
        <Metric icon={ClipboardList} label="Órdenes activas" value={orders.length} tone="indigo" />
      </section>

      {selected ? <OrderWorkView order={selected} draft={draft} onBack={() => setSelected(null)} onUpdate={updatePosition} onSave={() => void save()} saving={saving} /> : (
        <section className="grid gap-3">{orders.map((order) => <button key={order.id} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-soft transition hover:border-next-blue hover:shadow-md" type="button" onClick={() => openOrder(order)}><p className="text-xs font-black uppercase text-next-blue">Orden {order.numero ?? "sin número"}</p><h2 className="mt-1 text-xl font-black text-next-text">{order.obraNombre}</h2><p className="mt-1 text-sm font-semibold text-next-muted">{order.posiciones.length} posiciones · {order.pdfFileName}</p></button>)}{!orders.length ? <EmptyState text="No hay órdenes asignadas todavía." /> : null}</section>
      )}
    </div>
  );
}

function OrderWorkView({ order, draft, onBack, onUpdate, onSave, saving }: { order: ProductionOrder; draft: ProductionOrderPosition[]; onBack: () => void; onUpdate: (id: string, data: Partial<ProductionOrderPosition>) => void; onSave: () => void; saving: boolean }) {
  const progress = orderProgress(draft);
  return <section className="space-y-4 sm:space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><button className="text-xs font-black uppercase text-next-blue" type="button" onClick={onBack}>← Ver órdenes</button><p className="mt-3 text-xs font-black uppercase text-next-muted">Orden {order.numero ?? "sin número"}</p><h2 className="mt-1 text-xl font-black text-next-text sm:text-2xl">{order.obraNombre}</h2><p className="mt-1 text-sm font-semibold text-next-muted">{draft.length} posiciones · Prioridad {order.prioridad}</p></div><button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-next-blue px-5 text-sm font-black text-white shadow-sm disabled:opacity-60 sm:w-auto" type="button" onClick={onSave} disabled={saving}><Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar avance"}</button></div>
      <div className="mt-5"><div className="flex items-center justify-between text-xs font-black uppercase text-next-muted"><span>Progreso de la orden</span><span className="text-lg text-next-blue">{progress}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-next-blue transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-right text-xs font-semibold text-next-muted">{draft.filter((position) => position.estado === "completado").length} de {draft.length} posiciones terminadas</p></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{draft.map((position) => <PositionWorkCard key={position.id} position={position} onUpdate={onUpdate} />)}</div>
  </section>;
}

function PositionWorkCard({ position, onUpdate }: { position: ProductionOrderPosition; onUpdate: (id: string, data: Partial<ProductionOrderPosition>) => void }) {
  const [editing, setEditing] = useState(false);
  return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft"><div className="flex h-44 items-center justify-center bg-next-bg sm:h-48">{position.imagenUrl ? <img className="h-full w-full object-contain" src={position.imagenUrl} alt={`Referencia posición ${position.numero}`} /> : <ImageIcon className="h-10 w-10 text-slate-300" />}</div><div className="p-4"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-next-light px-2.5 py-1 text-xs font-black text-next-blue">POS. {position.numero}</span><span className="text-xs font-bold uppercase text-next-muted">{position.codigo}</span></div><h3 className="mt-3 text-base font-black uppercase text-next-text">{position.descripcion}</h3><p className="mt-1 text-sm font-semibold text-next-muted">{position.ancho ?? "-"} × {position.alto ?? "-"} mm · {position.color ?? "Sin color"}</p><div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 text-center"><QuantityCell label="Pendiente" value={position.cantidadPendiente} color="text-next-blue" /><QuantityCell label="En proceso" value={position.cantidadEnProduccion} color="text-next-orange" /><QuantityCell label="Terminado" value={position.cantidadTerminada} color="text-next-green" /></div><button className="mt-4 h-12 w-full rounded-lg bg-next-blue text-sm font-black text-white shadow-sm" type="button" onClick={() => setEditing((current) => !current)}>{editing ? "Cerrar avance" : position.estado === "completado" ? "Reabrir posición" : "Registrar avance"}</button>{editing ? <><div className="mt-3 grid grid-cols-3 gap-2"><QuantityInput label="Pendientes" value={position.cantidadPendiente} onChange={(value) => updateQuantities(position, value, position.cantidadEnProduccion, position.cantidadTerminada, onUpdate)} /><QuantityInput label="En producción" value={position.cantidadEnProduccion} onChange={(value) => updateQuantities(position, position.cantidadPendiente, value, position.cantidadTerminada, onUpdate)} /><QuantityInput label="Terminadas" value={position.cantidadTerminada} onChange={(value) => updateQuantities(position, position.cantidadPendiente, position.cantidadEnProduccion, value, onUpdate)} /></div><div className="mt-3 grid gap-2"><label className="text-xs font-black uppercase text-next-muted">Estado<select className="field mt-1" value={position.estado} onChange={(event) => onUpdate(position.id, { estado: event.target.value as ProductionItemStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-black uppercase text-next-muted">Observación<input className="field mt-1" value={position.observaciones ?? ""} onChange={(event) => onUpdate(position.id, { observaciones: event.target.value })} placeholder="Problema u observación" /></label></div></> : null}</div></article>;
}

function QuantityCell({ label, value, color }: { label: string; value: number; color: string }) { return <div className="border-r border-slate-200 px-1 py-2 last:border-r-0"><p className={`text-[10px] font-black uppercase ${color}`}>{label}</p><p className="mt-1 text-lg font-black text-next-text">{value}</p></div>; }
function QuantityInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-[10px] font-black uppercase text-next-muted">{label}<input className="field mt-1 px-2 text-center" type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /></label>; }
function updateQuantities(position: ProductionOrderPosition, pending: number, inProduction: number, finished: number, onUpdate: (id: string, data: Partial<ProductionOrderPosition>) => void) { const total = position.cantidadTotal; const safePending = Math.max(0, Math.min(total, pending)); const safeProduction = Math.max(0, Math.min(total - safePending, inProduction)); const safeFinished = Math.max(0, Math.min(total - safePending - safeProduction, finished)); onUpdate(position.id, { cantidadPendiente: safePending, cantidadEnProduccion: safeProduction, cantidadTerminada: safeFinished, estado: safeFinished === total ? "completado" : safeProduction > 0 || safeFinished > 0 ? "parcial" : "pendiente" }); }
function getOrderState(positions: ProductionOrderPosition[]) { if (positions.every((position) => position.estado === "completado")) return "terminada" as const; if (positions.some((position) => position.estado === "en_proceso" || position.estado === "parcial")) return "en_produccion" as const; return "recibida" as const; }
function countUnits(orders: ProductionOrder[], status: ProductionItemStatus) { return orders.flatMap((order) => order.posiciones).filter((position) => position.estado === status).reduce((total, position) => total + (status === "completado" ? position.cantidadTerminada : status === "pendiente" ? position.cantidadPendiente : position.cantidadEnProduccion), 0); }
function orderProgress(positions: ProductionOrderPosition[]) { const total = positions.reduce((sum, position) => sum + position.cantidadTotal, 0); const finished = positions.reduce((sum, position) => sum + position.cantidadTerminada, 0); return total ? Math.round((finished / total) * 100) : 0; }
function Metric({ icon: Icon, label, value, tone = "orange" }: { icon: LucideIcon; label: string; value: number; tone?: "orange" | "blue" | "green" | "indigo" }) { const color = tone === "green" ? "text-next-green" : tone === "blue" ? "text-next-blue" : tone === "indigo" ? "text-indigo-500" : "text-next-orange"; return <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-soft sm:p-4"><div><p className="text-[10px] font-black uppercase text-next-muted sm:text-xs">{label}</p><p className="mt-1 text-2xl font-black text-next-text sm:text-3xl">{value}</p><p className="text-[10px] font-semibold text-next-muted">{label === "Órdenes activas" ? "órdenes" : "unidades"}</p></div><Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${color}`} /></div>; }
function StateCard({ text }: { text: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-bold text-next-muted shadow-soft">{text}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red"}`}>{tone === "error" ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : null}{text}</div>; }
