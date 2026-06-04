import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { SystemUser } from "../types";
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "./firebase";

export async function signInWithEmail(email: string, password: string): Promise<User> {
  if (!isFirebaseConfigured() || !firebaseAuth) {
    throw new Error("Firebase Auth todavia no esta configurado.");
  }

  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return credential.user;
  } catch {
    throw new Error("No se pudo iniciar sesion. Revisa el email y la contrasena.");
  }
}

export async function signOutUser(): Promise<void> {
  localStorage.removeItem("next-control-demo-session");

  if (firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured() || !firebaseAuth) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(firebaseAuth, callback);
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!isFirebaseConfigured() || !firebaseAuth) {
    throw new Error("Firebase Auth todavia no esta configurado.");
  }

  await sendPasswordResetEmail(firebaseAuth, email);
}

export async function getCurrentUserProfile(): Promise<SystemUser | null> {
  if (!isFirebaseConfigured() || !firebaseAuth || !firestoreDb || !firebaseAuth.currentUser) {
    return null;
  }

  const snapshot = await getDoc(doc(firestoreDb, "users", firebaseAuth.currentUser.uid));
  return snapshot.exists() ? ({ uid: snapshot.id, ...snapshot.data() } as SystemUser) : null;
}

export const loginWithEmail = signInWithEmail;
export const logout = signOutUser;
export const subscribeToAuthChanges = subscribeToAuthState;
