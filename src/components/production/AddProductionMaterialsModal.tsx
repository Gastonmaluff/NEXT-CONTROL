import { AlertCircle, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateProductionOrder } from "../../lib/firestore";
import type { ProductionOrder } from "../../types";
import {
  materializeProductionAttachments,
  type ProductionAttachmentDraft,
} from "../../utils/productionAttachments";
import ProductionAttachmentsComposer from "./ProductionAttachmentsComposer";

export default function AddProductionMaterialsModal({
  order,
  onClose,
  onUpdated,
}: {
  order: ProductionOrder;
  onClose: () => void;
  onUpdated: (order: ProductionOrder) => void;
}) {
  const { profile } = useAuth();
  const [drafts, setDrafts] = useState<ProductionAttachmentDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving || !drafts.length) return;
    if (
      drafts.some(
        (draft) =>
          !draft.titulo.trim() ||
          (draft.tipo === "texto" && !draft.descripcion.trim()),
      )
    ) {
      setError("Completá el título y el contenido de cada material.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const materials = await materializeProductionAttachments(
        order.id,
        drafts,
        { uid: profile.uid, nombre: profile.nombre },
      );
      const updated = await updateProductionOrder(order.id, {
        materialesApoyo: [...(order.materialesApoyo ?? []), ...materials],
      });
      onUpdated(updated);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo agregar el material.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[75] overflow-y-auto bg-slate-950/65 px-3 py-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-material-title"
    >
      <form
        className="mx-auto max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">
              Orden {order.numero ?? "sin número"}
            </p>
            <h2
              id="add-material-title"
              className="mt-1 text-2xl font-black text-next-text"
            >
              Agregar material de apoyo
            </h2>
            <p className="mt-1 text-sm font-semibold text-next-muted">
              {order.obraNombre}
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {error ? (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-next-red"
            role="alert"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {error}
          </div>
        ) : null}
        <div className="mt-5">
          <ProductionAttachmentsComposer
            drafts={drafts}
            onChange={setDrafts}
            disabled={saving}
          />
        </div>
        <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <button
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-next-muted"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="h-11 rounded-xl bg-next-blue px-5 text-sm font-black text-white disabled:opacity-40"
            type="submit"
            disabled={saving || !drafts.length}
          >
            {saving
              ? "Guardando material..."
              : drafts.length
                ? `Agregar ${drafts.length} material${drafts.length === 1 ? "" : "es"}`
                : "Agregar materiales"}
          </button>
        </div>
      </form>
    </div>
  );
}
