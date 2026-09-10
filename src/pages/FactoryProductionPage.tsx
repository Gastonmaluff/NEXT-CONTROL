import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Factory,
  Package,
  Play,
  Plus,
  RotateCcw,
  StickyNote,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import ProductionPositionImage from "../components/production/ProductionPositionImage";
import { useAuth } from "../context/AuthContext";
import { subscribeToProductionOrders, updateProductionOrder } from "../lib/firestore";
import type { ProductionOrder, ProductionOrderPosition } from "../types";
import {
  applyProductionQuickAction,
  addProductionMissingItem,
  getProductionOrderProgress,
  getProductionOrderStatus,
  getProductionPositionCounts,
  getProductionMissingItems,
  resolveProductionMissingItem,
  type ProductionQuickAction
} from "../utils/productionOrders";

export default function FactoryProductionPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPositionId, setSavingPositionId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);
    return subscribeToProductionOrders(
      (nextOrders) => {
        setOrders(nextOrders);
        setSelectedId((current) => current && nextOrders.some((order) => order.id === current) ? current : (nextOrders[0]?.id ?? ""));
        setLoading(false);
      },
      (loadError) => {
        setError(loadError.message);
        setLoading(false);
      },
      profile.uid
    );
  }, [profile?.uid]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const stats = useMemo(() => orders.reduce(
    (summary, order) => {
      const progress = getProductionOrderProgress(order.posiciones);
      summary.pending += progress.pending;
      summary.inProduction += progress.inProduction;
      summary.finished += progress.finished;
      return summary;
    },
    { pending: 0, inProduction: 0, finished: 0 }
  ), [orders]);

  async function updatePosition(order: ProductionOrder, nextPosition: ProductionOrderPosition, confirmation: string) {
    if (savingPositionId) return;
    setSavingPositionId(nextPosition.id);
    setMessage("");
    setError("");
    try {
      const positions = order.posiciones.map((position) => position.id === nextPosition.id ? nextPosition : position);
      const updated = await updateProductionOrder(order.id, {
        posiciones: positions,
        estado: getProductionOrderStatus(positions)
      });
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(confirmation);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el avance.");
    } finally {
      setSavingPositionId("");
    }
  }

  function runQuickAction(order: ProductionOrder, position: ProductionOrderPosition, action: ProductionQuickAction) {
    const nextPosition = applyProductionQuickAction(position, action);
    const labels: Record<ProductionQuickAction, string> = {
      start: "Unidad marcada en producción.",
      finish: "Unidad terminada y guardada.",
      undo: "Corrección guardada. La unidad volvió a pendiente."
    };
    void updatePosition(order, nextPosition, labels[action]);
  }

  function reportMissing(order: ProductionOrder, position: ProductionOrderPosition, descripcion: string, observacion: string) {
    const nextPosition = addProductionMissingItem(position, descripcion, observacion, profile?.nombre ?? "Taller");
    if (nextPosition === position) return;
    void updatePosition(order, nextPosition, "Faltante registrado para esta posición.");
  }

  function resolveMissing(order: ProductionOrder, position: ProductionOrderPosition, missingItemId: string) {
    const nextPosition = resolveProductionMissingItem(position, missingItemId, profile?.nombre ?? "Taller");
    void updatePosition(order, nextPosition, "Faltante marcado como resuelto.");
  }

  if (loading) return <StateCard text="Cargando tus órdenes de taller..." />;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header>
        <p className="text-sm font-black uppercase text-next-blue">Mi trabajo de taller</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal text-next-text">Producción</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-next-muted">Cada toque se guarda automáticamente. No hace falta calcular ni restar cantidades.</p>
      </header>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Metric icon={Package} label="Pendientes" value={stats.pending} tone="orange" />
        <Metric icon={Factory} label="En proceso" value={stats.inProduction} tone="blue" />
        <Metric icon={CheckCircle2} label="Terminadas" value={stats.finished} tone="green" />
      </section>

      {selected ? (
        <OrderWorkView
          order={selected}
          showBack={orders.length > 1}
          savingPositionId={savingPositionId}
          onBack={() => setSelectedId("")}
          onAction={runQuickAction}
          onSaveNote={(position, note) => void updatePosition(selected, { ...position, observaciones: note }, "Nota guardada.")}
          onReportMissing={(position, descripcion, observacion) => reportMissing(selected, position, descripcion, observacion)}
          onResolveMissing={(position, missingItemId) => resolveMissing(selected, position, missingItemId)}
        />
      ) : (
        <section className="grid gap-3">
          {orders.map((order) => {
            const progress = getProductionOrderProgress(order.posiciones);
            return (
              <button key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-soft transition active:scale-[0.99]" type="button" onClick={() => setSelectedId(order.id)}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-next-blue">Orden {order.numero ?? "sin número"}</p><h2 className="mt-1 text-xl font-black text-next-text">{order.obraNombre}</h2><p className="mt-1 text-sm font-semibold text-next-muted">{progress.pending} pendientes · {progress.finished} terminadas</p></div><span className="text-2xl font-black text-next-blue">{progress.percentage}%</span></div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-next-blue" style={{ width: `${progress.percentage}%` }} /></div>
              </button>
            );
          })}
          {!orders.length ? <EmptyState text="No tenés órdenes asignadas todavía. Cuando el administrador te asigne una, aparecerá acá automáticamente." /> : null}
        </section>
      )}
    </div>
  );
}

function OrderWorkView({
  order,
  showBack,
  savingPositionId,
  onBack,
  onAction,
  onSaveNote,
  onReportMissing,
  onResolveMissing
}: {
  order: ProductionOrder;
  showBack: boolean;
  savingPositionId: string;
  onBack: () => void;
  onAction: (order: ProductionOrder, position: ProductionOrderPosition, action: ProductionQuickAction) => void;
  onSaveNote: (position: ProductionOrderPosition, note: string) => void;
  onReportMissing: (position: ProductionOrderPosition, descripcion: string, observacion: string) => void;
  onResolveMissing: (position: ProductionOrderPosition, missingItemId: string) => void;
}) {
  const progress = getProductionOrderProgress(order.posiciones);
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        {showBack ? <button className="inline-flex items-center gap-1 text-xs font-black uppercase text-next-blue" type="button" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Ver órdenes</button> : null}
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase text-next-muted">Orden {order.numero ?? "sin número"}</p><h2 className="mt-1 text-xl font-black text-next-text sm:text-2xl">{order.obraNombre}</h2><p className="mt-1 text-sm font-semibold text-next-muted">{order.cliente ? `${order.cliente} · ` : ""}{order.posiciones.length} posiciones</p></div>
          <span className="text-4xl font-black text-next-blue">{progress.percentage}%</span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-next-blue to-cyan-400 transition-[width] duration-500" style={{ width: `${progress.percentage}%` }} /></div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-next-muted"><span>{progress.finished}/{progress.total} terminadas</span><span>{progress.inProduction} en proceso</span><span>{progress.pending} pendientes</span></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {order.posiciones.map((position) => (
          <PositionWorkCard
            key={position.id}
            busy={Boolean(savingPositionId)}
            position={position}
            saving={savingPositionId === position.id}
            onAction={(action) => onAction(order, position, action)}
            onSaveNote={(note) => onSaveNote(position, note)}
            onReportMissing={(descripcion, observacion) => onReportMissing(position, descripcion, observacion)}
            onResolveMissing={(missingItemId) => onResolveMissing(position, missingItemId)}
          />
        ))}
      </div>
    </section>
  );
}

function PositionWorkCard({ position, busy, saving, onAction, onSaveNote, onReportMissing, onResolveMissing }: { position: ProductionOrderPosition; busy: boolean; saving: boolean; onAction: (action: ProductionQuickAction) => void; onSaveNote: (note: string) => void; onReportMissing: (descripcion: string, observacion: string) => void; onResolveMissing: (missingItemId: string) => void }) {
  const counts = getProductionPositionCounts(position);
  const progress = getProductionOrderProgress([position]);
  const missingItems = getProductionMissingItems(position);
  const [note, setNote] = useState(position.observaciones ?? "");
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingDescription, setMissingDescription] = useState("");
  const [missingNote, setMissingNote] = useState("");

  useEffect(() => setNote(position.observaciones ?? ""), [position.observaciones]);

  function submitMissing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!missingDescription.trim()) return;
    onReportMissing(missingDescription, missingNote);
    setMissingDescription("");
    setMissingNote("");
    setMissingOpen(false);
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <ProductionPositionImage src={position.imagenUrl} alt={`Posición ${position.numero}: ${position.descripcion}`} />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-next-light px-2.5 py-1 text-xs font-black text-next-blue">POS. {position.numero}</span><span className="text-xs font-bold uppercase text-next-muted">{position.codigo}</span></div>
        <h3 className="mt-3 text-base font-black uppercase text-next-text">{position.descripcion}</h3>
        <p className="mt-1 text-sm font-semibold text-next-muted">{position.ancho ?? "-"} × {position.alto ?? "-"} mm · {position.color ?? "Sin color"}</p>

        <div className="mt-4 rounded-2xl bg-next-bg p-4 text-center">
          <p className="text-xs font-black uppercase text-next-muted">Terminadas</p>
          <p className="mt-1 text-4xl font-black text-next-text"><span className="text-next-blue">{counts.finished}</span><span className="text-xl text-next-muted"> / {counts.total}</span></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-next-blue" style={{ width: `${progress.percentage}%` }} /></div>
          <p className="mt-2 text-xs font-bold text-next-muted">{counts.pending} pendientes · {counts.inProduction} en proceso</p>
        </div>

        {missingItems.length ? (
          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-next-orange">Faltantes reportados</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-next-orange">{missingItems.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {missingItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-orange-100 bg-white p-3">
                  <p className="text-sm font-black text-next-text">{item.descripcion}</p>
                  {item.observacion ? <p className="mt-1 text-xs font-semibold text-next-muted">{item.observacion}</p> : null}
                  <p className="mt-2 text-[10px] font-bold uppercase text-next-muted">Reportado por {item.reportadoPor} · {formatMissingDate(item.reportadoAt)}</p>
                  <button className="mt-2 h-9 rounded-lg border border-orange-300 px-3 text-xs font-black text-next-orange disabled:opacity-40" type="button" disabled={busy} onClick={() => onResolveMissing(item.id)}>Marcar como resuelto</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {missingOpen ? (
          <form className="mt-4 rounded-2xl border border-next-blue/20 bg-blue-50 p-4" onSubmit={submitMissing}>
            <p className="text-xs font-black uppercase text-next-blue">¿Qué falta para esta ventana?</p>
            <input className="field mt-3" required autoFocus value={missingDescription} onChange={(event) => setMissingDescription(event.target.value)} placeholder="Ej.: batería, vidrio, herraje..." />
            <textarea className="field mt-2 min-h-20" value={missingNote} onChange={(event) => setMissingNote(event.target.value)} placeholder="Detalle opcional: medida, cantidad o motivo" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-black text-next-muted" type="button" onClick={() => setMissingOpen(false)}>Cancelar</button>
              <button className="h-10 rounded-xl bg-next-blue text-xs font-black text-white disabled:opacity-40" type="submit" disabled={busy}>Agregar faltante</button>
            </div>
          </form>
        ) : (
          <button className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 text-xs font-black text-next-orange disabled:opacity-40" type="button" disabled={busy} onClick={() => setMissingOpen(true)}><Plus className="h-4 w-4" /> Informar faltante</button>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-next-blue bg-white px-3 text-sm font-black text-next-blue disabled:opacity-40" type="button" disabled={busy || counts.pending === 0} onClick={() => onAction("start")}><Play className="h-4 w-4 fill-current" /> Empezar 1</button>
          <button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-next-blue px-3 text-sm font-black text-white shadow-[0_10px_20px_rgba(20,104,216,0.2)] disabled:opacity-40" type="button" disabled={busy || counts.finished >= counts.total} onClick={() => onAction("finish")}><Plus className="h-5 w-5" /> 1 terminada</button>
        </div>
        <button className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black text-next-muted disabled:opacity-30" type="button" disabled={busy || counts.finished === 0} onClick={() => onAction("undo")}><RotateCcw className="h-4 w-4" /> Corregir última terminada</button>
        {saving ? <p className="mt-2 text-center text-xs font-black text-next-blue">Guardando avance...</p> : <p className="mt-2 text-center text-xs font-semibold text-next-green"><Check className="mr-1 inline h-3.5 w-3.5" />Los cambios se guardan al tocar</p>}

        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-black uppercase text-next-muted"><StickyNote className="h-4 w-4" /> Nota u observación</summary>
          <textarea className="field mt-3 min-h-20" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej.: falta un accesorio" />
          <button className="mt-2 h-10 w-full rounded-xl border border-next-blue text-xs font-black text-next-blue disabled:opacity-50" type="button" disabled={busy || note === (position.observaciones ?? "")} onClick={() => onSaveNote(note)}>Guardar nota</button>
        </details>
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: "orange" | "blue" | "green" }) { const color = tone === "green" ? "text-next-green bg-green-50" : tone === "blue" ? "text-next-blue bg-blue-50" : "text-next-orange bg-orange-50"; return <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-soft sm:flex sm:items-center sm:justify-between sm:text-left"><div><p className="text-[9px] font-black uppercase text-next-muted sm:text-xs">{label}</p><p className="mt-1 text-2xl font-black text-next-text sm:text-3xl">{value}</p></div><span className={`mx-auto mt-2 hidden h-10 w-10 items-center justify-center rounded-xl sm:mx-0 sm:mt-0 sm:inline-flex ${color}`}><Icon className="h-5 w-5" /></span></div>; }
function StateCard({ text }: { text: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-bold text-next-muted shadow-soft">{text}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm font-semibold leading-6 text-next-muted">{text}</div>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red"}`}>{tone === "error" ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : null}{text}</div>; }
function formatMissingDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "fecha desconocida" : date.toLocaleDateString("es-PY"); }
