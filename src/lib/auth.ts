import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "./firebase";

export async function loginWithEmail(email: string, password: string): Promise<User> {
  if (!isFirebaseConfigured() || !firebaseAuth) {
    throw new Error("Firebase Auth todavia no esta configurado.");
  }

  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return credential.user;
  } catch {
    throw new Error("No se pudo iniciar sesion. Revisa el email y la contraseña.");
  }
}

export async function logout(): Promise<void> {
  localStorage.removeItem("next-control-demo-session");

  if (firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured() || !firebaseAuth) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(firebaseAuth, callback);
}
