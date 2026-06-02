import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseStorage, isFirebaseConfigured } from "./firebase";

export async function uploadFile(path: string, file: File): Promise<string> {
  if (!isFirebaseConfigured() || !firebaseStorage) {
    throw new Error("Firebase Storage todavia no esta configurado.");
  }

  const storageRef = ref(firebaseStorage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function getFileUrl(path: string): Promise<string> {
  if (!isFirebaseConfigured() || !firebaseStorage) {
    throw new Error("Firebase Storage todavia no esta configurado.");
  }

  return getDownloadURL(ref(firebaseStorage, path));
}
