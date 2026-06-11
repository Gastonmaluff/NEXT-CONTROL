import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseStorage, isFirebaseConfigured } from "./firebase";

export function buildWorkRenderPath(obraId: string, file: File): string {
  return `obras/${obraId}/render/${Date.now()}-${sanitizeStorageFileName(file.name || "render.jpg")}`;
}

export function buildProgressPhotoPath(obraId: string, file: File): string {
  return `obras/${obraId}/progress/${Date.now()}-${sanitizeStorageFileName(file.name || "avance.jpg")}`;
}

export function buildProductionPhotoPath(obraId: string, rubroId: string, itemId: string, file: File): string {
  return `obras/${obraId}/produccion/${rubroId}/${itemId}/${Date.now()}-${sanitizeStorageFileName(file.name || "produccion.jpg")}`;
}

export function buildTaskPhotoPath(obraId: string, taskId: string, file: File): string {
  return `obras/${obraId}/tareas/${taskId}/${Date.now()}-${sanitizeStorageFileName(file.name || "tarea.jpg")}`;
}

export function buildWorkdayPhotoPath(
  obraId: string,
  jornadaId: string,
  phase: "inicio" | "avance" | "fin",
  file: File
): string {
  return `obras/${obraId}/jornadas/${jornadaId}/${phase}/${Date.now()}-${sanitizeStorageFileName(file.name || "jornada.jpg")}`;
}

export async function uploadFile(path: string, file: File): Promise<string> {
  if (!isFirebaseConfigured() || !firebaseStorage) {
    throw new Error("Firebase Storage todavia no esta configurado.");
  }

  if (import.meta.env.DEV) {
    console.info("[Storage] Starting render upload", {
      path,
      bucket: firebaseStorage.app.options.storageBucket,
      contentType: file.type,
      size: file.size
    });
  }

  const storageRef = ref(firebaseStorage, path);
  try {
    await uploadBytes(storageRef, file, {
      contentType: file.type || undefined
    });
    const url = await getDownloadURL(storageRef);
    if (import.meta.env.DEV) {
      console.info("[Storage] Upload success", { path, url });
    }
    return url;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[Storage] Upload failed", {
        path,
        code: getStorageErrorCode(error),
        message: error instanceof Error ? error.message : String(error)
      });
    }
    throw error;
  }
}

export async function getFileUrl(path: string): Promise<string> {
  if (!isFirebaseConfigured() || !firebaseStorage) {
    throw new Error("Firebase Storage todavia no esta configurado.");
  }

  return getDownloadURL(ref(firebaseStorage, path));
}

function getStorageErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export function sanitizeStorageFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
