import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim()
};

const requiredFirebaseEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
] as const;

const requiredFirebaseConfigValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId
];

export function isFirebaseConfigured(): boolean {
  return requiredFirebaseConfigValues.every((value) => typeof value === "string" && value.length > 0);
}

export function getMissingFirebaseEnvVars(): string[] {
  return requiredFirebaseEnvVars.filter((envVar, index) => !requiredFirebaseConfigValues[index]);
}

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured()
  ? initializeApp(firebaseConfig)
  : null;

export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseFunctions = firebaseApp ? getFunctions(firebaseApp) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

export const firebaseProjectId = firebaseConfig.projectId || "";
