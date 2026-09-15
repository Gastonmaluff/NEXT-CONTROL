import { Download, ExternalLink, X } from "lucide-react";
import { useEffect } from "react";

export default function ProductionPdfViewerDialog({
  title,
  fileName,
  url,
  orderName,
  onClose
}: {
  title: string;
  fileName?: string;
  url: string;
  orderName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950/80 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-next-blue">Orden · {orderName}</p>
            <h2 id="pdf-viewer-title" className="truncate text-lg font-black text-next-text sm:text-xl">{title}</h2>
            {fileName ? <p className="truncate text-xs font-semibold text-next-muted">{fileName}</p> : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <a className="inline-flex h-10 items-center gap-2 rounded-xl border border-next-blue px-3 text-xs font-black text-next-blue" href={url} download={fileName} target="_blank" rel="noreferrer"><Download className="h-4 w-4" aria-hidden="true" /> Descargar</a>
            <a className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-next-muted sm:inline-flex" href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Nueva pestaña</a>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar visor de PDF"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <iframe className="min-h-0 flex-1 bg-slate-100" src={url} title={`Documento PDF ${title}`} />
      </div>
    </div>
  );
}
