import { collection, doc, getDocs, runTransaction } from "firebase/firestore";
import { firestoreDb, isFirebaseConfigured } from "./firebase";
import { isDemoSession } from "./storage";
import type { SystemUser } from "../types";
import { validDay, type CashForecast } from "../utils/controlActual";

const key = "next-control-cash-forecast-v1";
const allowed = (profile: SystemUser) => profile.active && ["admin", "gerencia", "administracion"].includes(profile.role);
const local = (): CashForecast[] => JSON.parse(localStorage.getItem(key) || "[]");
function database() { if (!firestoreDb || !isFirebaseConfigured()) throw new Error("No se pudo conectar con Firebase."); return firestoreDb; }
export async function loadCashForecast(profile: SystemUser): Promise<CashForecast[]> {
  if (!allowed(profile)) throw new Error("No tenés permisos para consultar previsiones.");
  if (isDemoSession()) return local();
  const snapshot = await getDocs(collection(database(), "previsionesCaja"));
  return snapshot.docs.map(item => ({id:item.id, ...item.data()} as CashForecast));
}
export async function createCashForecast(profile: SystemUser, data: Pick<CashForecast, "direction" | "date" | "amount" | "description" | "obraId">, id: string): Promise<void> {
  if (!allowed(profile) || !id || !["ingreso", "egreso"].includes(data.direction) || !validDay(data.date) || !Number.isFinite(data.amount) || data.amount <= 0 || !data.description.trim() || data.description.trim().length > 200) throw new Error("Completá una fecha válida, importe positivo y descripción de hasta 200 caracteres.");
  const item: CashForecast = { id, direction: data.direction, date:data.date, amount:data.amount, description:data.description.trim(), obraId:data.obraId, state:"pendiente", createdAt:new Date().toISOString(), createdBy:profile.uid };
  if (isDemoSession()) { const items = local(); if (!items.some(existing => existing.id === id)) localStorage.setItem(key, JSON.stringify([item,...items])); return; }
  const db = database();
  await runTransaction(db, async tx => {
    const reference = doc(db, "previsionesCaja", id); const existing = await tx.get(reference);
    if (existing.exists()) {
      const previous = existing.data();
      if (previous.createdBy !== profile.uid || previous.direction !== item.direction || previous.date !== item.date || previous.amount !== item.amount || previous.description !== item.description || previous.obraId !== item.obraId) throw new Error("La previsión cambió; revisá los datos antes de continuar.");
      return;
    }
    tx.set(reference, item);
  });
}
export async function retireCashForecast(profile: SystemUser, id: string): Promise<void> {
  if (!allowed(profile)) throw new Error("No tenés permisos para retirar previsiones.");
  if (isDemoSession()) { localStorage.setItem(key, JSON.stringify(local().map(item => item.id === id ? {...item,state:"retirada"} : item))); return; }
  await runTransaction(database(), async tx => {
    const reference = doc(database(), "previsionesCaja", id);
    const existing = await tx.get(reference);
    if (!existing.exists()) throw new Error("No se encontró la previsión.");
    if (existing.data().state === "retirada") return;
    tx.update(reference, {state:"retirada"});
  });
}
