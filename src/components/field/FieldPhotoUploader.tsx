import { Camera, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";

type FieldPhotoUploaderProps = {
  files: File[];
  label?: string;
  helper?: string;
  multiple?: boolean;
  status?: string;
  warning?: string;
  onFilesChange: (files: File[]) => void;
};

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export default function FieldPhotoUploader({
  files,
  helper = "JPG, PNG o WebP. En celular permite galeria o camara segun navegador.",
  label = "Subir fotos",
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
    const allowed = selected.filter((file) => acceptedTypes.includes(file.type));
    setLocalWarning(allowed.length !== selected.length ? "Algunas imagenes fueron ignoradas. Usa JPG, PNG o WebP." : "");
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
          {files.length ? "Agregar foto" : label}
          <input className="sr-only" type="file" accept={acceptedTypes.join(",")} multiple={multiple} onChange={handleChange} />
        </label>
      </div>

      {files.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
              <img className="aspect-square w-full object-cover" src={previews[index]} alt={file.name} />
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
