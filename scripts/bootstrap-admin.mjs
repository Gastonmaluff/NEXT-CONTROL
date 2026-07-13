import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const {
  GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_PROJECT_ID,
  ADMIN_UID,
  ADMIN_EMAIL,
  ADMIN_NAME = "Administrador NEXT CONTROL"
} = process.env;

if (!GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("Define GOOGLE_APPLICATION_CREDENTIALS apuntando al service account local.");
}

if (!FIREBASE_PROJECT_ID) {
  throw new Error("Define FIREBASE_PROJECT_ID.");
}

if (!ADMIN_UID && !ADMIN_EMAIL) {
  throw new Error("Define ADMIN_UID o ADMIN_EMAIL.");
}

initializeApp({
  credential: applicationDefault(),
  projectId: FIREBASE_PROJECT_ID
});

const auth = getAuth();
const db = getFirestore();

const user = ADMIN_UID
  ? await auth.getUser(ADMIN_UID)
  : await auth.getUserByEmail(ADMIN_EMAIL);

await auth.setCustomUserClaims(user.uid, { role: "admin" });

const now = new Date().toISOString();
await db.doc(`users/${user.uid}`).set({
  uid: user.uid,
  nombre: ADMIN_NAME,
  email: user.email,
  role: "admin",
  active: true,
  assignedWorkIds: [],
  createdAt: now,
  createdBy: "bootstrap-admin-script",
  updatedAt: now
}, { merge: true });

console.log(`Admin configurado: ${user.uid} (${user.email})`);
