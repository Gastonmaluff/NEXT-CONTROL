import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { initialProductionStages, initialRubros, seedData } from "../data/seedData";
import type {
  Actividad,
  Cobro,
  Cuadrilla,
  Obra,
  OportunidadCRM,
  TareaInstalacion
} from "../types";
import { getDefaultCostBudget } from "../utils/finances";
import { firestoreDb, isFirebaseConfigured } from "./firebase";
import { generateId, getStoredData, isDemoSession, saveStoredData } from "./storage";

type ObraInput = Omit<Obra, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<Obra, "createdAt" | "updatedAt">>;

const collections = {
  obras: "obras",
  oportunidades: "oportunidades",
  cobros: "cobros",
  actividades: "actividades",
  cuadrillas: "cuadrillas",
  tareasInstalacion: "tareasInstalacion"
} as const;

function shouldUseFirebase() {
  return isFirebaseConfigured() && Boolean(firestoreDb) && !isDemoSession();
}

function now() {
  return new Date().toISOString();
}

function withError(error: unknown, fallback: string): Error {
  return new Error(error instanceof Error ? error.message : fallback);
}

async function getCollection<T extends { id: string }>(name: keyof typeof collections): Promise<T[]> {
  if (!shouldUseFirebase() || !firestoreDb) {
    return getStoredData()[name] as unknown as T[];
  }

  try {
    const snapshot = await getDocs(collection(firestoreDb, collections[name]));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
  } catch (error) {
    throw withError(error, `No se pudo leer ${collections[name]}.`);
  }
}

async function createDocument<T extends { id: string }>(
  name: keyof typeof collections,
  data: Omit<T, "id">
): Promise<T> {
  if (!shouldUseFirebase() || !firestoreDb) {
    const stored = getStoredData();
    const id = generateId(name);
    const record = { id, ...data } as T;
    (stored[name] as unknown as T[]).unshift(record);
    saveStoredData(stored);
    return record;
  }

  try {
    const ref = await addDoc(collection(firestoreDb, collections[name]), data);
    return { id: ref.id, ...data } as T;
  } catch (error) {
    throw withError(error, `No se pudo crear ${collections[name]}.`);
  }
}

async function updateDocument<T extends { id: string }>(
  name: keyof typeof collections,
  id: string,
  data: Partial<T>
): Promise<T> {
  if (!shouldUseFirebase() || !firestoreDb) {
    const stored = getStoredData();
    const records = stored[name] as unknown as T[];
    const index = records.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("No se encontro el registro.");
    }

    records[index] = { ...records[index], ...data };
    saveStoredData(stored);
    return records[index];
  }

  try {
    await updateDoc(doc(firestoreDb, collections[name], id), data as Record<string, unknown>);
    const updated = await getDoc(doc(firestoreDb, collections[name], id));
    return { id: updated.id, ...updated.data() } as T;
  } catch (error) {
    throw withError(error, `No se pudo actualizar ${collections[name]}.`);
  }
}

async function deleteDocument<T extends { id: string }>(
  name: keyof typeof collections,
  id: string
): Promise<void> {
  if (!shouldUseFirebase() || !firestoreDb) {
    const stored = getStoredData();
    const next = (stored[name] as unknown as T[]).filter((item) => item.id !== id);
    (stored as unknown as Record<string, unknown>)[name] = next;
    saveStoredData(stored);
    return;
  }

  try {
    await deleteDoc(doc(firestoreDb, collections[name], id));
  } catch (error) {
    throw withError(error, `No se pudo eliminar ${collections[name]}.`);
  }
}

export async function getObras(): Promise<Obra[]> {
  return getCollection<Obra>("obras");
}

export async function getObraById(id: string): Promise<Obra | null> {
  if (!shouldUseFirebase() || !firestoreDb) {
    return getStoredData().obras.find((obra) => obra.id === id) ?? null;
  }

  try {
    const snapshot = await getDoc(doc(firestoreDb, collections.obras, id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Obra) : null;
  } catch (error) {
    throw withError(error, "No se pudo leer la obra.");
  }
}

export async function createObra(data: ObraInput): Promise<Obra> {
  const createdAt = data.createdAt ?? now();
  const presupuestoAprobado = data.presupuestoAprobado ?? data.montoAprobado;
  const adicionalesAprobados = data.adicionalesAprobados ?? 0;
  const descuentos = data.descuentos ?? 0;
  const valorFinalContratado =
    data.valorFinalContratado ?? presupuestoAprobado + adicionalesAprobados - descuentos;

  return createDocument<Obra>("obras", {
    ...data,
    presupuestoAprobado,
    adicionalesAprobados,
    descuentos,
    valorFinalContratado,
    costosEstimados: data.costosEstimados?.length
      ? data.costosEstimados
      : getDefaultCostBudget(valorFinalContratado),
    movimientosFinancieros: data.movimientosFinancieros ?? [],
    rubrosAvance: data.rubrosAvance?.length ? data.rubrosAvance : initialRubros,
    etapasProduccion: data.etapasProduccion?.length ? data.etapasProduccion : initialProductionStages,
    materialesFaltantes: data.materialesFaltantes ?? [],
    createdAt,
    updatedAt: data.updatedAt ?? createdAt
  });
}

export async function updateObra(id: string, data: Partial<Obra>): Promise<Obra> {
  return updateDocument<Obra>("obras", id, { ...data, updatedAt: now() });
}

export async function deleteObra(id: string): Promise<void> {
  if (!shouldUseFirebase() || !firestoreDb) {
    const stored = getStoredData();
    stored.obras = stored.obras.filter((obra) => obra.id !== id);
    stored.cobros = stored.cobros.filter((cobro) => cobro.obraId !== id);
    stored.actividades = stored.actividades.filter((actividad) => actividad.obraId !== id);
    stored.tareasInstalacion = stored.tareasInstalacion.filter((tarea) => tarea.obraId !== id);
    saveStoredData(stored);
    return;
  }

  return deleteDocument<Obra>("obras", id);
}

export async function getOportunidades(): Promise<OportunidadCRM[]> {
  return getCollection<OportunidadCRM>("oportunidades");
}

export async function createOportunidad(
  data: Omit<OportunidadCRM, "id" | "createdAt" | "updatedAt">
): Promise<OportunidadCRM> {
  const createdAt = now();
  return createDocument<OportunidadCRM>("oportunidades", {
    ...data,
    createdAt,
    updatedAt: createdAt
  });
}

export async function updateOportunidad(
  id: string,
  data: Partial<OportunidadCRM>
): Promise<OportunidadCRM> {
  return updateDocument<OportunidadCRM>("oportunidades", id, { ...data, updatedAt: now() });
}

export async function deleteOportunidad(id: string): Promise<void> {
  return deleteDocument<OportunidadCRM>("oportunidades", id);
}

export async function convertirOportunidadEnObra(id: string): Promise<Obra> {
  const oportunidad = (await getOportunidades()).find((item) => item.id === id);

  if (!oportunidad) {
    throw new Error("No se encontro la oportunidad.");
  }

  const obra = await createObra({
    nombre: oportunidad.proyecto,
    cliente: oportunidad.cliente,
    arquitecto: oportunidad.arquitecto,
    ubicacion: "",
    montoAprobado: oportunidad.montoEstimado,
    fechaInicio: new Date().toISOString().slice(0, 10),
    fechaEntrega: oportunidad.proximoSeguimiento,
    responsable: "Por asignar",
    estado: "Aprobado",
    saldoPendienteCobro: oportunidad.montoEstimado,
    rubrosAvance: initialRubros.map((rubro) => ({ ...rubro, avance: 0 })),
    etapasProduccion: initialProductionStages,
    materialesFaltantes: []
  });

  await updateOportunidad(id, { estado: "Aprobado" });
  await createActividad({
    obraId: obra.id,
    tipo: "crm",
    descripcion: "Oportunidad convertida en obra.",
    usuario: "Admin",
    fecha: now()
  });

  return obra;
}

export async function getCobrosByObra(obraId: string): Promise<Cobro[]> {
  return (await getCollection<Cobro>("cobros")).filter((cobro) => cobro.obraId === obraId);
}

export async function createCobro(data: Omit<Cobro, "id" | "createdAt">): Promise<Cobro> {
  const cobro = await createDocument<Cobro>("cobros", { ...data, createdAt: now() });
  const obra = await getObraById(data.obraId);

  if (obra) {
    const cobros = await getCobrosByObra(data.obraId);
    const totalCobrado = cobros.reduce((sum, item) => sum + item.monto, 0);
    await updateObra(data.obraId, {
      saldoPendienteCobro: Math.max(0, obra.montoAprobado - totalCobrado)
    });
  }

  await createActividad({
    obraId: data.obraId,
    tipo: "cobro",
    descripcion: `Se registro un cobro de ${data.monto.toLocaleString("es-PY")} Gs.`,
    usuario: "Administracion",
    fecha: now()
  });

  return cobro;
}

export async function deleteCobro(id: string): Promise<void> {
  return deleteDocument<Cobro>("cobros", id);
}

export async function getActividadesByObra(obraId: string): Promise<Actividad[]> {
  return (await getCollection<Actividad>("actividades"))
    .filter((actividad) => actividad.obraId === obraId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function createActividad(data: Omit<Actividad, "id">): Promise<Actividad> {
  return createDocument<Actividad>("actividades", data);
}

export async function getCuadrillas(): Promise<Cuadrilla[]> {
  return getCollection<Cuadrilla>("cuadrillas");
}

export async function updateCuadrilla(
  id: string,
  data: Partial<Cuadrilla>
): Promise<Cuadrilla> {
  return updateDocument<Cuadrilla>("cuadrillas", id, data);
}

export async function getTareasByObra(obraId: string): Promise<TareaInstalacion[]> {
  return (await getCollection<TareaInstalacion>("tareasInstalacion")).filter(
    (tarea) => tarea.obraId === obraId
  );
}

export async function updateTareaInstalacion(
  id: string,
  data: Partial<TareaInstalacion>
): Promise<TareaInstalacion> {
  return updateDocument<TareaInstalacion>("tareasInstalacion", id, data);
}

export async function loadSeedDataToFirebase(replace = false): Promise<string> {
  if (!shouldUseFirebase() || !firestoreDb) {
    throw new Error("Firebase todavia no esta configurado.");
  }

  try {
    const db = firestoreDb;
    const existing = await getDocs(collection(db, collections.obras));
    if (!replace && !existing.empty) {
      return "Ya existen datos en Firebase. Elegi reemplazar para recargar el seed.";
    }

    const batch = writeBatch(db);

    if (replace) {
      for (const collectionName of Object.values(collections)) {
        const snapshot = await getDocs(collection(db, collectionName));
        snapshot.docs.forEach((document) => batch.delete(document.ref));
      }
    }

    Object.entries(seedData).forEach(([collectionName, records]) => {
      records.forEach((record) => {
        const ref = doc(db, collectionName, record.id);
        batch.set(ref, record);
      });
    });

    await batch.commit();
    return "Datos demo cargados en Firebase.";
  } catch (error) {
    throw withError(error, "No se pudieron cargar los datos demo en Firebase.");
  }
}

export async function setFirebaseSeedData(): Promise<void> {
  if (!shouldUseFirebase() || !firestoreDb) {
    return;
  }

  const db = firestoreDb;
  for (const [collectionName, records] of Object.entries(seedData)) {
    for (const record of records) {
      await setDoc(doc(db, collectionName, record.id), record);
    }
  }
}
