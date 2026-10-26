import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { firestoreDb, firebaseAuth } from "./firebase";
import { isDemoSession } from "./storage";
import type { SystemUser } from "../types";
import type { InstallationUnit, UnitAudit } from "../utils/installationUnits";
export const problemReasons = ["Falta vidrio", "Falta carpintería", "Falta material", "Falta accesorios", "Problema fabricación", "Medidas incorrectas", "Obra no preparada", "Problema cliente", "Otro"];
export type InstallationProblem = { id: string; unitId: string; obraId: string; obraNombre: string; teamId: string; code: string; reason: string; comment: string; photoUrl: string;
  material: boolean; status: "pendiente" | "en_gestion" | "resuelto"; delivery: "pendiente" | "preparado" | "entregado" | "no_disponible"; neededOn: string;
  createdBy: string; createdAt: string; updatedBy: string; updatedAt: string; history: UnitAudit[] };
const name = "problemasInstalacion"; const key = "next-control-installation-problems-v1";
const local = (): InstallationProblem[] => JSON.parse(localStorage.getItem(key) || "[]");
function database() { if (!firestoreDb || !firebaseAuth?.currentUser) throw new Error("Inicia sesión para registrar problemas."); return firestoreDb; }
function normalize(raw: Record<string, any>): InstallationProblem {
  return { ...raw, createdAt: raw.createdAt?.toDate?.().toISOString() ?? raw.createdAt, updatedAt: raw.updatedAt?.toDate?.().toISOString() ?? raw.updatedAt } as InstallationProblem;
}
export async function loadInstallationProblems(profile: SystemUser): Promise<InstallationProblem[]> {
  if (!profile.active) throw new Error("Usuario inactivo.");
  if (isDemoSession()) return local().filter(p => profile.role === "admin" || (profile.assignedWorkIds.includes(p.obraId) && (profile.role === "encargado" ? p.material : profile.assignedTeamIds?.includes(p.teamId))));
  const source = collection(database(), name); if (profile.role === "admin") return (await getDocs(source)).docs.map(d => normalize(d.data()));
  const result: InstallationProblem[] = [];
  if (profile.role === "encargado") for (let i = 0; i < profile.assignedWorkIds.length; i += 30) result.push(...(await getDocs(query(source, where("obraId", "in", profile.assignedWorkIds.slice(i, i + 30)), where("material", "==", true)))).docs.map(d => normalize(d.data())));
  else for (const workId of profile.assignedWorkIds) for (let i = 0; i < (profile.assignedTeamIds?.length ?? 0); i += 30) result.push(...(await getDocs(query(source, where("obraId", "==", workId), where("teamId", "in", profile.assignedTeamIds!.slice(i,i+30))))).docs.map(d => normalize(d.data())));
  return result;
}
export async function reportInstallationProblem(unit: InstallationUnit, reason: string, comment: string, photoUrl: string, profile: SystemUser, id: string): Promise<void> {
  if (!problemReasons.includes(reason)) throw new Error("Selecciona un problema.");
  if (!profile.active || (profile.role !== "admin" && (!profile.assignedWorkIds.includes(unit.obraId) || !profile.assignedTeamIds?.includes(unit.teamId)))) throw new Error("Trabajo no asignado.");
  const now = new Date().toISOString();
  const problem: InstallationProblem = { id, unitId: unit.id, obraId: unit.obraId, obraNombre: unit.obraNombre, teamId: unit.teamId, code: unit.code, reason, comment: comment.trim(), photoUrl,
    material: /^Falta /i.test(reason), status: "pendiente", delivery: "pendiente", neededOn: "", createdBy: profile.uid, createdAt: now, updatedBy: profile.uid, updatedAt: now,
    history: [{ id, action: "reportar", by: profile.uid, at: now, reason }] };
  if (isDemoSession()) { const all = local(); if (!all.some(p => p.id === id)) localStorage.setItem(key, JSON.stringify([...all, problem])); return; }
  const db = database(); const ref = doc(db, name, id);
  await runTransaction(db, async tx => { const existing = await tx.get(ref); if (!existing.exists()) tx.set(ref, { ...problem, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); });
}
export async function updateInstallationProblem(id: string, change: Pick<InstallationProblem, "status" | "delivery" | "neededOn">, profile: SystemUser, operationId: string): Promise<void> {
  const update = (before: InstallationProblem) => {
    if (!profile.active || (profile.role !== "admin" && !(profile.role === "encargado" && profile.assignedWorkIds.includes(before.obraId)))) throw new Error("Solo admin o logística de la obra puede gestionar el problema.");
    if (before.history.some(h => h.id === operationId)) return before;
    if (profile.role !== "admin" && !before.material) throw new Error("Logística gestiona faltantes de materiales.");
    if (!["pendiente", "en_gestion", "resuelto"].includes(change.status) || !["pendiente", "preparado", "entregado", "no_disponible"].includes(change.delivery)) throw new Error("Estado inválido.");
    const now = new Date().toISOString(); return { ...before, ...change, updatedBy: profile.uid, updatedAt: now, history: [...before.history, { id: operationId, action: "gestionar", by: profile.uid, at: now, reason: `${change.status} · ${change.delivery} · ${change.neededOn}` }] };
  };
  if (isDemoSession()) { const all = local(); const index = all.findIndex(p => p.id === id); if (index < 0) throw new Error("Problema inexistente."); all[index] = update(all[index]); localStorage.setItem(key, JSON.stringify(all)); return; }
  const db = database(); const ref = doc(db, name, id);
  await runTransaction(db, async tx => { const snapshot = await tx.get(ref); if (!snapshot.exists()) throw new Error("Problema inexistente."); const before = normalize(snapshot.data()); const after = update(before); if (after !== before) tx.set(ref, { ...after, createdAt: snapshot.data().createdAt, updatedAt: serverTimestamp() }); });
}
