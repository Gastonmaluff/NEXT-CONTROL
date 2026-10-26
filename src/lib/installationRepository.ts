import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where, type Timestamp } from "firebase/firestore";
import { firebaseAuth, firestoreDb } from "./firebase";
import { isDemoSession } from "./storage";
import type { SystemUser } from "../types";
import { stageKeys, transitionUnit, importDifferences, mergeImportedUnit, type ImportReview, type InstallationUnit, type UnitAction, type AdminUnitEdit, type AttachmentAction } from "../utils/installationUnits";

const name = "unidadesInstalacion";
const demoKey = "next-control-installation-units-v1";
const demo = () => isDemoSession();
const isAdmin = (profile: SystemUser) => profile.active && profile.role === "admin";
function db() {
  if (!firestoreDb || !firebaseAuth?.currentUser) throw new Error("Inicia sesión con una cuenta autorizada; no se guardará en modo local automáticamente.");
  return firestoreDb;
}
function normalize(raw: Record<string, unknown>): InstallationUnit {
  const result = { ...raw };
  for (const key of ["completedAt", "validatedAt", "createdAt", "updatedAt"]) {
    const value = result[key];
    if (value && typeof value === "object" && "toDate" in value) result[key] = (value as Timestamp).toDate().toISOString();
  }
  return result as InstallationUnit;
}
function localUnits(): InstallationUnit[] { return JSON.parse(localStorage.getItem(demoKey) || "[]"); }
export async function loadInstallationUnits(profile: SystemUser): Promise<InstallationUnit[]> {
  if (!profile.active) throw new Error("Usuario inactivo.");
  if (demo()) return localUnits().filter(u => isAdmin(profile) || (profile.assignedWorkIds.includes(u.obraId) && (profile.assignedTeamIds?.includes(u.teamId) || profile.assignedTeamIds?.includes(u.creditedTeamId))));
  const source = collection(db(), name);
  if (isAdmin(profile)) return (await getDocs(source)).docs.map(d => normalize(d.data()));
  const works = profile.assignedWorkIds;
  const all: InstallationUnit[] = [];
  const teams = profile.assignedTeamIds ?? [];
  for (const workId of works) for (let i = 0; i < teams.length; i += 30) {
    for (const field of ["teamId", "creditedTeamId"]) {
      const snapshot = await getDocs(query(source, where("obraId", "==", workId), where(field, "in", teams.slice(i, i + 30))));
      all.push(...snapshot.docs.map(d => normalize(d.data())));
    }
  }
  return [...new Map(all.map(u => [u.id,u])).values()];
}

export async function createInstallationUnits(units: InstallationUnit[], profile: SystemUser, review?: ImportReview, onProgress?: (saved: number, total: number) => void): Promise<number> {
  if (!isAdmin(profile)) throw new Error("Solo admin puede agregar trabajos.");
  if (!units.length || units.length > 10000) throw new Error("Importa de 1 a 10000 unidades; se procesan por lotes reanudables.");
  if (new Set(units.map(u => u.id)).size !== units.length) throw new Error("IDs duplicados.");
  if (units.some(u => !stageKeys.some(k => u.required[k] && u.labels[k]))) throw new Error("Cada unidad necesita una etapa obligatoria.");
  const orders=[...new Set(units.filter(u=>u.origin === "produccion").map(u=>u.sourceOrderId))];
  if (orders.length > 1) throw new Error("Revisa una orden por importación.");
  const database = demo() ? null : db();
  const current = demo() ? localUnits() : orders.length ? (await getDocs(query(collection(database!,name),where("sourceOrderId","==",orders[0])))).docs.map(d=>normalize(d.data())) : [];
  const differences=importDifferences(units,current);
  if (differences.some(d=>d.kind === "changed" || d.kind === "missing") && !review) throw new Error("Revisa las diferencias antes de fusionar; se conservan todos los avances.");
  const fingerprintBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(units.map(u=>[u.id,u.sourceSignature,u.value,u.quantity,u.obraId,u.pdfUrl,u.drawingUrl]).sort())));
  const fingerprint=Array.from(new Uint8Array(fingerprintBytes),n=>n.toString(16).padStart(2,"0")).join("");
  const items=[...units.map(u=>({id:u.id,incoming:u})),...differences.filter(d=>d.kind === "missing").map(d=>({id:d.id,incoming:undefined}))].sort((a,b)=>a.id.localeCompare(b.id));
  const operation=(id:string)=>"import-"+fingerprint+"-"+(review?.decisions[id] ?? "retain")+"-"+id;
  // Preflight all decisions before any write. Recheck each source revision inside its transaction.
  for(const d of differences) if(d.existing) mergeImportedUnit(d.existing,d.incoming,review,profile.uid,operation(d.id));
  if(demo()) {
    const next=new Map(current.map(u=>[u.id,u]));let count=0;
    for(const item of items){const old=next.get(item.id);if(old) next.set(item.id,mergeImportedUnit(old,item.incoming,review,profile.uid,operation(item.id)));else if(item.incoming){next.set(item.id,item.incoming);count++;}}
    localStorage.setItem(demoKey,JSON.stringify([...next.values()]));onProgress?.(items.length,items.length);return count;
  }
  const manifest=doc(database!,"importacionesInstalacion",orders[0] || "manual-"+units[0].jobId);
  await runTransaction(database!,async tx=>{const snap=await tx.get(manifest);const previous=snap.exists()?snap.data():{};
    if(previous.pendingFingerprint && previous.pendingFingerprint !== fingerprint) throw new Error("Otra importación está pendiente. Reanuda con la misma vista previa antes de importar cambios distintos.");
    tx.set(manifest,{orderId:orders[0] || "",pendingFingerprint:fingerprint,total:items.length,updatedAt:serverTimestamp(),updatedBy:profile.uid},{merge:true});});
  let count=0;
  // Each transaction writes at most 201 documents. A failed later chunk leaves earlier
  // chunks safely visible and the manifest locked to this fingerprint for an exact retry.
  for(let offset=0;offset<items.length;offset+=200){const chunk=items.slice(offset,offset+200);
    count+=await runTransaction(database!,async tx=>{const gate=await tx.get(manifest);
      if(!gate.data()?.pendingFingerprint && gate.data()?.completedFingerprint === fingerprint) return 0;
      if(gate.data()?.pendingFingerprint !== fingerprint) throw new Error("La importación cambió. Reanuda la revisión actual.");
      const refs=chunk.map(item=>doc(database!,name,item.id));const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));let inserted=0;
      snapshots.forEach((snapshot,i)=>{const incoming=chunk[i].incoming;
        if(snapshot.exists()){const before=normalize(snapshot.data());
          if(incoming?.origin === "manual" && (before.value !== incoming.value || before.obraId !== incoming.obraId)) throw new Error("Identidad manual existente; usa edición con historial.");
          const after=incoming?.origin === "manual" ? before : mergeImportedUnit(before,incoming,review,profile.uid,operation(before.id));
          if(after!==before) tx.set(refs[i],{...after,createdAt:snapshot.data().createdAt,completedAt:snapshot.data().completedAt,validatedAt:snapshot.data().validatedAt,updatedAt:serverTimestamp()});
        }else if(incoming){tx.set(refs[i],{...incoming,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});inserted++;}
      });
      tx.set(manifest,{processed:Math.min(offset+chunk.length,items.length),updatedAt:serverTimestamp(),updatedBy:profile.uid},{merge:true});return inserted;});
    onProgress?.(Math.min(offset+chunk.length,items.length),items.length);
  }
  await runTransaction(database!,async tx=>{const snap=await tx.get(manifest);if(!snap.data()?.pendingFingerprint && snap.data()?.completedFingerprint === fingerprint) return;if(snap.data()?.pendingFingerprint !== fingerprint) throw new Error("La revisión cambió.");tx.set(manifest,{pendingFingerprint:"",completedFingerprint:fingerprint,updatedAt:serverTimestamp(),updatedBy:profile.uid},{merge:true});});
  return count;
}
export async function actOnInstallationUnit(id: string, action: UnitAction | AdminUnitEdit | AttachmentAction, profile: SystemUser, operationId: string): Promise<void> {
  const update = (unit: InstallationUnit) => {
    if (!profile.active || (!isAdmin(profile) && (!profile.assignedWorkIds.includes(unit.obraId) || !profile.assignedTeamIds?.includes(unit.teamId)))) throw new Error("La unidad no está asignada a tu obra y cuadrilla.");
    return transitionUnit(unit, action, profile.uid, isAdmin(profile), operationId);
  };
  if (demo()) {
    const units = localUnits(); const index = units.findIndex(u => u.id === id);
    if (index < 0) throw new Error("Unidad inexistente.");
    units[index] = update(units[index]); localStorage.setItem(demoKey, JSON.stringify(units)); return;
  }
  const database = db(); const reference = doc(database, name, id);
  for (let attempt = 0; attempt < 4; attempt++) {
    let readHistoryLength = -1;
    try { await runTransaction(database, async tx => {
    const snapshot = await tx.get(reference); if (!snapshot.exists()) throw new Error("Unidad inexistente.");
    const before = normalize(snapshot.data()); const after = update(before); if (after === before) return;
    readHistoryLength = before.history.length;
    if (action.type === "references" && before.sourceOrderId) { const source = doc(database,"ordenesProduccion",before.sourceOrderId); const original = await tx.get(source); if (!original.exists()) throw new Error("La orden original no existe."); tx.update(source,{fieldReferencesApproved:action.approved}); }
    tx.set(reference, { ...after, createdAt: snapshot.data().createdAt, updatedAt: serverTimestamp(),
      completedAt: action.type === "complete" ? serverTimestamp() : snapshot.data().completedAt,
      validatedAt: action.type === "validate" || (action.type === "complete" && !after.approvalRequired) ? serverTimestamp() : snapshot.data().validatedAt,
      ...(action.type === "reopen" ? { completedAt: "", validatedAt: "" } : {}) });
    }); return;
    } catch (error) {
      // Rules can reject a stale append before the emulator returns ABORTED. Retry only
      // after proving another authorized write advanced the readable history.
      if (attempt < 3 && readHistoryLength >= 0 && (error as { code?: string }).code === "permission-denied") {
        const latest = await getDoc(reference);
        if (latest.exists() && latest.data().history.length > readHistoryLength) continue;
      }
      throw error;
    }
  }
}
export type InstallationGoals = { weeklyByTeam: Record<string, number>; monthly: number; weekStartsOn?: number; workDays?: number[]; holidays?: string[]; approvalByWork?: Record<string, boolean> };
export async function loadInstallationGoals(): Promise<InstallationGoals> {
  const fallback = { weeklyByTeam: {}, monthly: 600 };
  if (demo()) return JSON.parse(localStorage.getItem(`${demoKey}-goals`) || JSON.stringify(fallback));
  const snapshot = await getDoc(doc(db(), "configuracionInstalaciones", "metas"));
  return snapshot.exists() ? snapshot.data() as InstallationGoals : fallback;
}
export async function saveInstallationGoals(goals: InstallationGoals, profile: SystemUser): Promise<void> {
  if (!isAdmin(profile)) throw new Error("Solo admin configura metas.");
  if (!Number.isFinite(goals.monthly) || goals.monthly < 0 || Object.values(goals.weeklyByTeam).some(v => !Number.isFinite(v) || v < 0)) throw new Error("Metas inválidas.");
  if (goals.weekStartsOn !== undefined && (!Number.isInteger(goals.weekStartsOn) || goals.weekStartsOn < 0 || goals.weekStartsOn > 6)) throw new Error("Inicio de semana inválido.");
  if (goals.holidays?.some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day))) throw new Error("Feriados: usa fechas YYYY-MM-DD.");
  if (demo()) { localStorage.setItem(`${demoKey}-goals`, JSON.stringify(goals)); return; }
  const database = db();
  await runTransaction(database, async tx => { tx.set(doc(database, "configuracionInstalaciones", "metas"), { ...goals, updatedBy: profile.uid, updatedAt: serverTimestamp() }); });
}
