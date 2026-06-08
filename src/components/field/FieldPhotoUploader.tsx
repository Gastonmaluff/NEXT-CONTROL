import { Camera, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";

type FieldPhotoUploaderProps = {
  capture?: "environment" | "user";
  files: File[];
  label?: string;
  helper?: string;
  maxSizeMb?: number;
  multiple?: boolean;
  status?: string;
  warning?: string;
  onFilesChange: (files: File[]) => void;
};

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export default function FieldPhotoUploader({
  capture,
  files,
  helper = "JPG, PNG o WebP. En celular permite galeria o camara segun navegador.",
  label = "Subir fotos",
  maxSizeMb = 8,
  multiple = true,
  onFilesChange,
  status,
  warning
}: FieldPhotoUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [localWarning, setLocalWarning] = useState("");

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const maxBytes = maxSizeMb * 1024 * 1024;
    const allowed = selected.filter((file) => acceptedTypes.includes(file.type) && file.size <= maxBytes);
    const hasInvalidType = selected.some((file) => !acceptedTypes.includes(file.type));
    const hasLargeFile = selected.some((file) => file.size > maxBytes);
    setLocalWarning(
      hasLargeFile
        ? `La imagen es demasiado pesada. Subi una imagen menor a ${maxSizeMb} MB.`
        : hasInvalidType
          ? "Algunas imagenes fueron ignoradas. Usa JPG, PNG o WebP."
          : ""
    );
    onFilesChange(multiple ? [...files, ...allowed] : allowed.slice(0, 1));
    event.target.value = "";
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-next-bg p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-black text-next-text">
          <Camera className="h-4 w-4 text-next-blue" aria-hidden="true" />
          {label}
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-next-blue px-3 text-xs font-black text-white transition hover:bg-next-navy">
          <Upload className="h-4 w-4" aria-hidden="true" />
          {files.length ? multiple ? "Agregar foto" : "Cambiar foto" : label}
          <input className="sr-only" type="file" accept="image/*" capture={capture} multiple={multiple} onChange={handleChange} />
        </label>
      </div>

      {files.length ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
              <img className="aspect-video w-full object-cover" src={previews[index]} alt={file.name} />
              <div className="px-2 py-2 pr-10">
                <p className="truncate text-xs font-black text-next-text">{file.name}</p>
                <p className="text-[11px] font-semibold text-next-muted">{formatFileSize(file.size)}</p>
              </div>
              <button
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-next-red shadow"
                type="button"
                onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}
                title="Eliminar foto"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-next-muted">{helper}</p>
      )}

      {status ? <p className="mt-2 text-xs font-black text-next-blue">{status}</p> : null}
      {warning || localWarning ? <p className="mt-2 text-xs font-semibold text-next-orange">{warning || localWarning}</p> : null}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
