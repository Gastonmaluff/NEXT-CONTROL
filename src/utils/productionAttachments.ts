import { isFirebaseConfigured } from "../lib/firebase";
import { isDemoSession } from "../lib/storage";
import { buildProductionAttachmentPath, uploadFile } from "../lib/storageUpload";
import type { ProductionOrderAttachment } from "../types";

export const MAX_PRODUCTION_ATTACHMENT_SIZE = 15 * 1024 * 1024;

export type ProductionAttachmentDraft = {
  id: string;
  tipo: "texto" | "archivo";
  titulo: string;
  descripcion: string;
  file?: File;
};

export function createProductionAttachmentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `adjunto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function materializeProductionAttachments(
  orderId: string,
  drafts: ProductionAttachmentDraft[],
  user: { uid: string; nombre: string }
): Promise<ProductionOrderAttachment[]> {
  const createdAt = new Date().toISOString();

  return Promise.all(drafts.map(async (draft) => {
    if (!draft.titulo.trim()) throw new Error("Cada material necesita un título.");
    if (draft.tipo === "texto") {
      if (!draft.descripcion.trim()) throw new Error("Las instrucciones de texto no pueden quedar vacías.");
      return {
        id: draft.id,
        tipo: "texto",
        titulo: draft.titulo.trim() || "Instrucción",
        descripcion: draft.descripcion.trim(),
        createdAt,
        createdBy: user.uid,
        createdByName: user.nombre
      } satisfies ProductionOrderAttachment;
    }

    if (!draft.file) throw new Error("No se encontró uno de los archivos seleccionados.");
    if (draft.file.size > MAX_PRODUCTION_ATTACHMENT_SIZE) throw new Error(`${draft.file.name} supera el límite de 15 MB.`);

    const storagePath = buildProductionAttachmentPath(orderId, draft.id, draft.file);
    const fileUrl = !isFirebaseConfigured() || isDemoSession()
      ? await fileToDataUrl(draft.file)
      : await uploadFile(storagePath, draft.file);

    return {
      id: draft.id,
      tipo: "archivo",
      titulo: draft.titulo.trim() || draft.file.name,
      descripcion: draft.descripcion.trim() || undefined,
      fileName: draft.file.name,
      fileUrl,
      storagePath,
      mimeType: draft.file.type || "application/octet-stream",
      size: draft.file.size,
      createdAt,
      createdBy: user.uid,
      createdByName: user.nombre
    } satisfies ProductionOrderAttachment;
  }));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`No se pudo preparar ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
