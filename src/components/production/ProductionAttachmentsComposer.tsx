import { FilePlus2, MessageSquareText, Paperclip, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  MAX_PRODUCTION_ATTACHMENT_SIZE,
  createProductionAttachmentId,
  type ProductionAttachmentDraft
} from "../../utils/productionAttachments";

export default function ProductionAttachmentsComposer({
  drafts,
  onChange,
  disabled = false
}: {
  drafts: ProductionAttachmentDraft[];
  onChange: (drafts: ProductionAttachmentDraft[]) => void;
  disabled?: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");

  function addInstruction() {
    const text = instruction.trim();
    if (!text) return;
    onChange([...drafts, {
      id: createProductionAttachmentId(),
      tipo: "texto",
      titulo: "Instrucción de producción",
      descripcion: text
    }]);
    setInstruction("");
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const oversized = selected.find((file) => file.size > MAX_PRODUCTION_ATTACHMENT_SIZE);
    if (oversized) {
      setError(`${oversized.name} supera el límite de 15 MB.`);
      return;
    }
    setError("");
    onChange([...drafts, ...selected.map((file) => ({
      id: createProductionAttachmentId(),
      tipo: "archivo" as const,
      titulo: file.name,
      descripcion: "",
      file
    }))]);
  }

  function updateDraft(id: string, data: Partial<ProductionAttachmentDraft>) {
    onChange(drafts.map((draft) => draft.id === id ? { ...draft, ...data } : draft));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-next-bg p-3 sm:p-4" aria-labelledby="support-material-title">
      <div>
        <p className="text-xs font-black uppercase text-next-blue">Material de apoyo</p>
        <h3 id="support-material-title" className="mt-1 text-base font-black text-next-text">Archivos e instrucciones adicionales</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-next-muted">El encargado podrá abrir estos materiales desde su orden de trabajo.</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <textarea className="field min-h-20" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Escribir una instrucción o descripción adicional" maxLength={5000} disabled={disabled} />
        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-next-blue bg-white px-3 text-xs font-black text-next-blue disabled:opacity-40" type="button" onClick={addInstruction} disabled={disabled || !instruction.trim()}><MessageSquareText className="h-4 w-4" aria-hidden="true" /> Agregar texto</button>
      </div>

      <label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-next-blue bg-blue-50 px-3 text-xs font-black text-next-blue">
        <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Adjuntar uno o varios archivos
        <input className="sr-only" type="file" multiple disabled={disabled} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
      </label>
      <p className="mt-1 text-[11px] font-semibold text-next-muted">Cualquier formato, hasta 15 MB por archivo.</p>
      {error ? <p className="mt-2 text-xs font-bold text-next-red" role="alert">{error}</p> : null}

      {drafts.length ? <div className="mt-3 space-y-2">{drafts.map((draft, index) => (
        <article key={draft.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-next-light text-next-blue">{draft.tipo === "texto" ? <MessageSquareText className="h-4 w-4" aria-hidden="true" /> : <Paperclip className="h-4 w-4" aria-hidden="true" />}</span>
            <div className="min-w-0 flex-1">
              <input className="field h-9 text-sm" aria-label={`Título del material ${index + 1}`} value={draft.titulo} onChange={(event) => updateDraft(draft.id, { titulo: event.target.value })} maxLength={120} disabled={disabled} />
              {draft.tipo === "texto" ? <textarea className="field mt-2 min-h-16 text-sm" aria-label={`Texto del material ${index + 1}`} value={draft.descripcion} onChange={(event) => updateDraft(draft.id, { descripcion: event.target.value })} maxLength={5000} disabled={disabled} /> : <><p className="mt-1 truncate text-[11px] font-semibold text-next-muted">{draft.file?.name} · {formatFileSize(draft.file?.size ?? 0)}</p><input className="field mt-2 h-9 text-sm" aria-label={`Descripción del archivo ${index + 1}`} value={draft.descripcion} onChange={(event) => updateDraft(draft.id, { descripcion: event.target.value })} placeholder="Descripción opcional para el encargado" maxLength={500} disabled={disabled} /></>}
            </div>
            <button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-next-red disabled:opacity-40" type="button" onClick={() => onChange(drafts.filter((item) => item.id !== draft.id))} disabled={disabled} aria-label={`Quitar material ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </article>
      ))}</div> : null}
    </section>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
