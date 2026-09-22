import { AlertCircle, CheckCircle2, Clock3, Eye, X } from "lucide-react";
import { useEffect } from "react";
import type { ProductionOrder, ProductionOrderPosition } from "../../types";
import { getProductionMissingItems, getProductionOrderProgress } from "../../utils/productionOrders";
import ProductionPositionImage from "./ProductionPositionImage";
import ProductionSupportMaterials from "./ProductionSupportMaterials";
import { formatAreaM2, getProductionOrderArea, getProductionUnitAreaM2 } from "../../utils/productionArea";

type ProductionOrderPreviewDialogProps = {
  order: ProductionOrder;
  onClose: () => void;
};

export default function ProductionOrderPreviewDialog({ order, onClose }: ProductionOrderPreviewDialogProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const progress = getProductionOrderProgress(order.posiciones);
  const area = getProductionOrderArea(order);
  const missingCount = order.posiciones.reduce((sum, position) => sum + getProductionMissingItems(position).length, 0);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="production-preview-title">
      <section className="mx-auto min-h-full max-w-7xl overflow-hidden rounded-2xl bg-next-bg shadow-2xl sm:min-h-0">
        <header className="flex items-start justify-between gap-4 bg-next-blue px-4 py-5 text-white sm:px-6">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-cyan-200"><Eye className="h-3.5 w-3.5" aria-hidden="true" /> Vista de producción</p>
            <h2 id="production-preview-title" className="mt-1 truncate text-2xl font-black sm:text-3xl">{order.obraNombre}</h2>
            <p className="mt-1 text-sm font-semibold text-blue-100">{order.numero ? `Orden ${order.numero} · ` : ""}{order.assignedToName ? `Responsable: ${order.assignedToName}` : "Sin responsable asignado"}</p>
          </div>
          <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25" type="button" onClick={onClose} aria-label="Cerrar vista de producción">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="p-4 sm:p-6">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-black uppercase text-next-muted">Avance general</p><p className="mt-1 text-sm font-bold text-next-text">{progress.finished} de {progress.total} unidades terminadas</p></div>
                <span className="text-3xl font-black text-next-blue">{progress.percentage}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-next-blue to-cyan-400" style={{ width: `${progress.percentage}%` }} /></div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-next-muted"><span>{progress.pending} pendientes</span><span>{progress.inProduction} en producción</span><span className="text-next-green">{progress.finished} terminadas</span><span className="text-next-blue">{formatAreaM2(area.finishedM2)} / {formatAreaM2(area.plannedM2)} m²</span></div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-next-light px-3 py-2 text-xs font-black text-next-blue"><Eye className="h-4 w-4" aria-hidden="true" /> Solo lectura</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-next-muted">
            {order.fechaComprometida ? <span className="rounded-full bg-white px-3 py-1.5 shadow-soft">Entrega: {formatDate(order.fechaComprometida)}</span> : null}
            {order.prioridad ? <span className="rounded-full bg-white px-3 py-1.5 shadow-soft">Prioridad: {formatPriority(order.prioridad)}</span> : null}
            <span className={`rounded-full px-3 py-1.5 shadow-soft ${missingCount ? "bg-orange-50 text-next-orange" : "bg-green-50 text-next-green"}`}>{missingCount ? `${missingCount} faltante${missingCount === 1 ? "" : "s"} pendiente${missingCount === 1 ? "" : "s"}` : "Sin faltantes pendientes"}</span>
          </div>

          {order.observaciones ? <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-next-muted">Observaciones de la orden</p><p className="mt-1 text-sm font-semibold leading-6 text-next-text">{order.observaciones}</p></div> : null}

          <div className="mt-4"><ProductionSupportMaterials order={order} /></div>

          <div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-next-blue">Detalle de fabricación</p><h3 className="mt-1 text-xl font-black text-next-text">{order.posiciones.length} {order.origen === "manual" ? (order.posiciones.length === 1 ? "ítem" : "ítems") : (order.posiciones.length === 1 ? "posición" : "posiciones")}</h3></div><p className="hidden text-xs font-semibold text-next-muted sm:block">Tocá una imagen para ver el detalle completo.</p></div>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {order.posiciones.map((position) => <PositionPreviewCard key={position.id} position={position} />)}
          </div>
        </div>
      </section>
    </div>
  );
}

function PositionPreviewCard({ position }: { position: ProductionOrderPosition }) {
  const progress = getProductionOrderProgress([position]);
  const unitArea = getProductionUnitAreaM2(position);
  const missingItems = getProductionMissingItems(position);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <ProductionPositionImage src={position.imagenUrl} alt={`Posición ${position.numero}: ${position.descripcion}`} thumbnailClassName="h-40 sm:h-44" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black uppercase text-next-blue">Posición {position.numero}{position.codigo ? ` · ${position.codigo}` : ""}</p><h4 className="mt-1 text-base font-black text-next-text">{position.descripcion}</h4></div><span className="shrink-0 rounded-full bg-next-light px-2.5 py-1 text-sm font-black text-next-blue">{progress.percentage}%</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-next-muted">{position.ancho || position.alto ? <Info label="Medida" value={`${position.ancho ?? "-"} × ${position.alto ?? "-"} mm`} /> : null}<Info label="Cantidad" value={`${progress.finished}/${progress.total} terminadas`} />{position.color ? <Info label="Color" value={position.color} /> : null}{position.linea ? <Info label="Línea / material" value={position.linea} /> : null}</div>
        <p className="mt-2 text-xs font-bold text-next-blue">{unitArea === null ? "Sin m² definidos" : `${formatAreaM2(unitArea * progress.finished)} / ${formatAreaM2(unitArea * progress.total)} m²`}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-next-blue" style={{ width: `${progress.percentage}%` }} /></div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-next-muted"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{progress.pending} pendientes</span><span className="inline-flex items-center gap-1 text-next-green"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{progress.finished} terminadas</span></div>
        {position.vidrio || position.detalles || position.observaciones ? <div className="mt-3 space-y-1 rounded-lg bg-next-bg p-2.5 text-xs font-semibold text-next-muted">{position.vidrio ? <p><strong className="text-next-text">Vidrio:</strong> {position.vidrio}</p> : null}{position.detalles ? <p><strong className="text-next-text">Detalles:</strong> {position.detalles}</p> : null}{position.observaciones ? <p><strong className="text-next-text">Observaciones:</strong> {position.observaciones}</p> : null}</div> : null}
        {missingItems.length ? <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5"><p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-next-orange"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Faltantes informados</p><div className="mt-2 space-y-2">{missingItems.map((item) => <div key={item.id} className="rounded-md bg-white p-2"><p className="text-xs font-black text-next-text">{item.descripcion}</p>{item.observacion ? <p className="mt-1 text-[11px] font-semibold text-next-muted">{item.observacion}</p> : null}<p className="mt-1 text-[10px] font-bold text-next-muted">Por {item.reportadoPor} · {formatDate(item.reportadoAt)}</p></div>)}</div></div> : null}
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value?: string | number }) { return <div><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="mt-0.5 truncate text-next-text">{value || "-"}</p></div>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "fecha desconocida" : date.toLocaleDateString("es-PY"); }
function formatPriority(value: ProductionOrder["prioridad"]) { return { urgente: "Urgente", alta: "Alta", normal: "Normal", baja: "Baja" }[value]; }
