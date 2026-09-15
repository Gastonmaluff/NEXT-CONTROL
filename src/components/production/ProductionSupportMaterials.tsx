import { ExternalLink, File, FileText, Image, MessageSquareText, Paperclip } from "lucide-react";
import type { ProductionOrder, ProductionOrderAttachment } from "../../types";

export default function ProductionSupportMaterials({ order }: { order: ProductionOrder }) {
  const materials = order.materialesApoyo ?? [];
  if (!order.pdfUrl && !materials.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5" aria-labelledby={`materials-${order.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase text-next-blue">Material de apoyo</p><h3 id={`materials-${order.id}`} className="mt-1 text-lg font-black text-next-text">Archivos e instrucciones</h3></div>
        <span className="inline-flex items-center gap-1 rounded-full bg-next-light px-2.5 py-1 text-xs font-black text-next-blue"><Paperclip className="h-3.5 w-3.5" aria-hidden="true" />{materials.length + (order.pdfUrl ? 1 : 0)}</span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {order.pdfUrl ? <FileMaterial title="PDF original de la orden" description={order.pdfFileName} url={order.pdfUrl} mimeType="application/pdf" /> : null}
        {materials.map((material) => material.tipo === "texto"
          ? <TextMaterial key={material.id} material={material} />
          : <FileMaterial key={material.id} title={material.titulo} description={material.descripcion} url={material.fileUrl} mimeType={material.mimeType} fileName={material.fileName} author={material.createdByName} createdAt={material.createdAt} />)}
      </div>
    </section>
  );
}

function TextMaterial({ material }: { material: ProductionOrderAttachment }) {
  return <article className="rounded-xl border border-blue-100 bg-blue-50 p-3"><div className="flex items-center gap-2 text-next-blue"><MessageSquareText className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-black uppercase">{material.titulo}</p></div><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-5 text-next-text">{material.descripcion}</p><Metadata author={material.createdByName} createdAt={material.createdAt} /></article>;
}

function FileMaterial({ title, description, url, mimeType, fileName, author, createdAt }: { title: string; description?: string; url?: string; mimeType?: string; fileName?: string; author?: string; createdAt?: string }) {
  const Icon = mimeType?.startsWith("image/") ? Image : mimeType === "application/pdf" ? FileText : File;
  return <article className="overflow-hidden rounded-xl border border-slate-200 bg-next-bg">{url && mimeType?.startsWith("image/") ? <img className="h-28 w-full bg-white object-contain" src={url} alt={title} /> : null}<div className="p-3"><div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-next-blue" aria-hidden="true" /><div className="min-w-0"><p className="break-words text-sm font-black text-next-text">{title}</p>{fileName && fileName !== title ? <p className="mt-0.5 truncate text-[11px] font-semibold text-next-muted">{fileName}</p> : null}</div></div>{description ? <p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-next-muted">{description}</p> : null}{url ? <a className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-next-blue bg-white px-3 text-xs font-black text-next-blue" href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Abrir archivo</a> : <p className="mt-2 text-xs font-bold text-next-red">Archivo no disponible</p>}<Metadata author={author} createdAt={createdAt} /></div></article>;
}

function Metadata({ author, createdAt }: { author?: string; createdAt?: string }) {
  if (!author && !createdAt) return null;
  return <p className="mt-2 text-[10px] font-bold uppercase text-next-muted">{author ? `Agregado por ${author}` : ""}{author && createdAt ? " · " : ""}{createdAt ? formatDate(createdAt) : ""}</p>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha desconocida" : date.toLocaleDateString("es-PY");
}
