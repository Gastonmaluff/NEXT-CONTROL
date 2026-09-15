import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteProductionOrder } from "../../lib/firestore";
import type { ProductionOrder } from "../../types";

export default function DeleteProductionOrderModal({
  order,
  onClose,
  onDeleted
}: {
  order: ProductionOrder;
  onClose: () => void;
  onDeleted: (orderId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function removeOrder() {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteProductionOrder(order);
      onDeleted(order.id);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la orden.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-order-title">
      <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-next-red"><AlertTriangle className="h-6 w-6" aria-hidden="true" /></span>
          <button className="icon-button" type="button" onClick={onClose} disabled={deleting} aria-label="Cerrar confirmación"><X className="h-5 w-5" /></button>
        </div>
        <h2 id="delete-order-title" className="mt-4 text-2xl font-black text-next-text">Eliminar orden</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-next-muted">¿Está seguro de que desea eliminar esta orden de trabajo? Esta acción eliminará la orden del sistema.</p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-next-bg p-3"><p className="text-sm font-black text-next-text">{order.obraNombre}</p><p className="mt-1 text-xs font-semibold text-next-muted">Orden {order.numero ?? "sin número"}</p></div>
        {error ? <p className="mt-3 text-sm font-bold text-next-red" role="alert">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="h-11 rounded-xl border border-slate-200 text-sm font-black text-next-muted" type="button" onClick={onClose} disabled={deleting}>Cancelar</button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-next-red px-3 text-sm font-black text-white disabled:opacity-50" type="button" onClick={() => void removeOrder()} disabled={deleting}><Trash2 className="h-4 w-4" aria-hidden="true" />{deleting ? "Eliminando..." : "Eliminar orden"}</button>
        </div>
      </section>
    </div>
  );
}
