import { Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function ProductionPositionImage({
  src,
  alt,
  thumbnailClassName = "h-40 sm:h-48"
}: {
  src?: string;
  alt: string;
  thumbnailClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!src) {
    return <div className={`flex ${thumbnailClassName} items-center justify-center bg-next-bg text-sm font-bold text-slate-400`}>Sin imagen de referencia</div>;
  }

  return (
    <>
      <button className={`group relative flex w-full items-center justify-center overflow-hidden bg-next-bg ${thumbnailClassName}`} type="button" onClick={() => setOpen(true)} aria-label={`Ampliar ${alt}`}>
        <img className="h-full w-full object-contain" src={src} alt={alt} />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-sm backdrop-blur-sm"><Maximize2 className="h-3 w-3" /> Ver detalle</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={alt}>
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 pb-3 text-white">
            <div><p className="text-xs font-black uppercase text-cyan-300">Detalle completo del producto</p><p className="mt-1 text-sm font-bold">{alt}</p></div>
            <button className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15" type="button" onClick={() => setOpen(false)} aria-label="Cerrar imagen"><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 items-center overflow-auto rounded-2xl bg-white p-2 sm:p-4">
            <img className="mx-auto h-auto w-full min-w-[760px] object-contain sm:min-w-0 sm:max-h-full" src={src} alt={alt} />
          </div>
          <p className="pt-2 text-center text-xs font-semibold text-white/70 sm:hidden">Deslizá horizontalmente para leer todos los detalles.</p>
        </div>
      ) : null}
    </>
  );
}
