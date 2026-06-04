import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const roles = new Set([
  "admin",
  "gerencia",
  "administracion",
  "supervisor",
  "fiscalizador",
  "encargado",
  "produccion",
  "instalador"
]);

async function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const profile = await db.doc(`users/${request.auth.uid}`).get();
  if (!profile.exists || profile.data()?.active !== true || profile.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo admin puede administrar usuarios.");
  }

  return profile.data();
}

function validateRole(role) {
  if (!roles.has(role)) {
    throw new HttpsError("invalid-argument", "Rol invalido.");
  }
}

function cleanUserPayload(data) {
  validateRole(data.role);
  if (!data.nombre || !data.email) {
    throw new HttpsError("invalid-argument", "Nombre y correo son obligatorios.");
  }

  return {
    nombre: String(data.nombre),
    email: String(data.email).toLowerCase(),
    role: data.role,
    active: data.active !== false,
    phone: data.phone ? String(data.phone) : "",
    assignedWorkIds: Array.isArray(data.assignedWorkIds) ? data.assignedWorkIds : []
  };
}

async function writeUserProfile(uid, payload, createdBy, extra = {}) {
  const now = new Date().toISOString();
  const profile = {
    uid,
    ...payload,
    createdAt: extra.createdAt ?? now,
    createdBy,
    updatedAt: now
  };

  await db.doc(`users/${uid}`).set(profile, { merge: true });
  await auth.setCustomUserClaims(uid, { role: payload.role });
  return profile;
}

export const createSystemUser = onCall(async (request) => {
  const adminProfile = await requireAdmin(request);
  const payload = cleanUserPayload(request.data);
  const password = request.data?.password;
  if (!password || String(password).length < 6) {
    throw new HttpsError("invalid-argument", "La contrasena temporal debe tener al menos 6 caracteres.");
  }

  const user = await auth.createUser({
    email: payload.email,
    password: String(password),
    displayName: payload.nombre,
    disabled: !payload.active
  });

  return writeUserProfile(user.uid, payload, adminProfile.uid ?? request.auth.uid);
});

export const updateSystemUser = onCall(async (request) => {
  const adminProfile = await requireAdmin(request);
  const uid = request.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "UID requerido.");

  const current = await db.doc(`users/${uid}`).get();
  if (!current.exists) throw new HttpsError("not-found", "Usuario no encontrado.");

  const next = {
    ...current.data(),
    ...request.data.data
  };
  const payload = cleanUserPayload(next);

  await auth.updateUser(uid, {
    displayName: payload.nombre,
    disabled: !payload.active
  });

  return writeUserProfile(uid, payload, adminProfile.uid ?? request.auth.uid, {
    createdAt: current.data()?.createdAt
  });
});

export const disableSystemUser = onCall(async (request) => {
  await requireAdmin(request);
  const uid = request.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "UID requerido.");
  await auth.updateUser(uid, { disabled: true });
  await db.doc(`users/${uid}`).update({ active: false, updatedAt: new Date().toISOString() });
  return (await db.doc(`users/${uid}`).get()).data();
});

export const enableSystemUser = onCall(async (request) => {
  await requireAdmin(request);
  const uid = request.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "UID requerido.");
  await auth.updateUser(uid, { disabled: false });
  await db.doc(`users/${uid}`).update({ active: true, updatedAt: new Date().toISOString() });
  return (await db.doc(`users/${uid}`).get()).data();
});

export const setSystemUserRole = onCall(async (request) => {
  await requireAdmin(request);
  const { uid, role } = request.data ?? {};
  if (!uid) throw new HttpsError("invalid-argument", "UID requerido.");
  validateRole(role);
  await auth.setCustomUserClaims(uid, { role });
  await db.doc(`users/${uid}`).update({ role, updatedAt: new Date().toISOString() });
  return (await db.doc(`users/${uid}`).get()).data();
});

export const assignWorksToUser = onCall(async (request) => {
  await requireAdmin(request);
  const { uid, assignedWorkIds } = request.data ?? {};
  if (!uid || !Array.isArray(assignedWorkIds)) {
    throw new HttpsError("invalid-argument", "UID y obras asignadas son requeridos.");
  }
  await db.doc(`users/${uid}`).update({ assignedWorkIds, updatedAt: new Date().toISOString() });
  return (await db.doc(`users/${uid}`).get()).data();
});

export const sendUserPasswordReset = onCall(async (request) => {
  await requireAdmin(request);
  const email = request.data?.email;
  if (!email) throw new HttpsError("invalid-argument", "Correo requerido.");
  const link = await auth.generatePasswordResetLink(String(email).toLowerCase());
  return { ok: true, resetLink: link };
});

export const linkExistingFirebaseUser = onCall(async (request) => {
  const adminProfile = await requireAdmin(request);
  const uid = request.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "UID requerido.");
  await auth.getUser(uid);
  const payload = cleanUserPayload(request.data);
  return writeUserProfile(uid, payload, adminProfile.uid ?? request.auth.uid);
});
