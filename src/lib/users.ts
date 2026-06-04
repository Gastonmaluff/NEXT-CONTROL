import { httpsCallable } from "firebase/functions";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import type { Obra, SystemUser, UserRole } from "../types";
import { firebaseFunctions, firestoreDb, isFirebaseConfigured } from "./firebase";
import { generateId, getStoredData, isDemoSession, saveStoredData } from "./storage";

export type CreateSystemUserInput = {
  nombre: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  assignedWorkIds: string[];
};

export type UpdateSystemUserInput = Partial<Pick<SystemUser, "nombre" | "role" | "phone" | "active" | "assignedWorkIds">>;

function shouldUseFirebaseUsers() {
  return isFirebaseConfigured() && Boolean(firebaseFunctions) && Boolean(firestoreDb) && !isDemoSession();
}

export async function getSystemUsers(): Promise<SystemUser[]> {
  if (!isFirebaseConfigured() || !firestoreDb || isDemoSession()) {
    return getStoredData().users;
  }

  const snapshot = await getDocs(collection(firestoreDb, "users"));
  return snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as SystemUser);
}

export async function createSystemUser(data: CreateSystemUserInput): Promise<SystemUser> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<CreateSystemUserInput, SystemUser>(firebaseFunctions, "createSystemUser");
    const result = await callable(data);
    return result.data;
  }

  const stored = getStoredData();
  const now = new Date().toISOString();
  const user: SystemUser = {
    uid: generateId("demo-user"),
    nombre: data.nombre,
    email: data.email,
    role: data.role,
    active: data.active,
    phone: data.phone,
    assignedWorkIds: data.assignedWorkIds,
    createdAt: now,
    createdBy: "demo-admin",
    updatedAt: now
  };
  stored.users.unshift(user);
  saveStoredData(stored);
  return user;
}

export async function updateSystemUser(uid: string, data: UpdateSystemUserInput): Promise<SystemUser> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<{ uid: string; data: UpdateSystemUserInput }, SystemUser>(firebaseFunctions, "updateSystemUser");
    const result = await callable({ uid, data });
    return result.data;
  }

  const stored = getStoredData();
  const index = stored.users.findIndex((user) => user.uid === uid);
  if (index === -1) throw new Error("No se encontro el usuario.");
  stored.users[index] = { ...stored.users[index], ...data, updatedAt: new Date().toISOString() };
  saveStoredData(stored);
  return stored.users[index];
}

export async function disableSystemUser(uid: string): Promise<SystemUser> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<{ uid: string }, SystemUser>(firebaseFunctions, "disableSystemUser");
    const result = await callable({ uid });
    return result.data;
  }
  return updateSystemUser(uid, { active: false });
}

export async function enableSystemUser(uid: string): Promise<SystemUser> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<{ uid: string }, SystemUser>(firebaseFunctions, "enableSystemUser");
    const result = await callable({ uid });
    return result.data;
  }
  return updateSystemUser(uid, { active: true });
}

export async function setSystemUserRole(uid: string, role: UserRole): Promise<SystemUser> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<{ uid: string; role: UserRole }, SystemUser>(firebaseFunctions, "setSystemUserRole");
    const result = await callable({ uid, role });
    return result.data;
  }
  return updateSystemUser(uid, { role });
}

export async function assignWorksToUser(uid: string, assignedWorkIds: string[]): Promise<SystemUser> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<{ uid: string; assignedWorkIds: string[] }, SystemUser>(firebaseFunctions, "assignWorksToUser");
    const result = await callable({ uid, assignedWorkIds });
    return result.data;
  }
  return updateSystemUser(uid, { assignedWorkIds });
}

export async function sendUserPasswordReset(email: string): Promise<void> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<{ email: string }, { ok: boolean }>(firebaseFunctions, "sendUserPasswordReset");
    await callable({ email });
    return;
  }
}

export async function linkExistingFirebaseUser(data: Omit<SystemUser, "createdAt" | "createdBy">): Promise<SystemUser> {
  if (shouldUseFirebaseUsers() && firebaseFunctions) {
    const callable = httpsCallable<Omit<SystemUser, "createdAt" | "createdBy">, SystemUser>(firebaseFunctions, "linkExistingFirebaseUser");
    const result = await callable(data);
    return result.data;
  }

  const stored = getStoredData();
  const user: SystemUser = {
    ...data,
    createdAt: new Date().toISOString(),
    createdBy: "demo-admin"
  };
  stored.users.unshift(user);
  saveStoredData(stored);
  return user;
}

export async function setUserLastLogin(uid: string): Promise<void> {
  if (!isFirebaseConfigured() || !firestoreDb || isDemoSession()) return;
  await updateDoc(doc(firestoreDb, "users", uid), {
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function countAssignedWorks(user: SystemUser, works: Obra[]) {
  if (!user.assignedWorkIds.length) return "Todas";
  return `${works.filter((obra) => user.assignedWorkIds.includes(obra.id)).length}`;
}
