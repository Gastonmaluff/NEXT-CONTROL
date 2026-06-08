import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { initialProductionStages, initialRubros, seedData } from "../data/seedData";
import type {
  Actividad,
  Cobro,
  Cheque,
  ChequeStatus,
  Cliente,
  Cuadrilla,
  FieldTask,
  FieldWorkday,
  FinancialMovement,
  Obra,
  OportunidadCRM,
  Proveedor,
  ProgressActivityLog,
  ProgressMaterialReport,
  ProgressReport,
  TaskPhoto,
  TareaInstalacion,
  WorkProgressRubric
} from "../types";
import { calculateSaldoPendiente } from "../utils/finance";
import { getDefaultCostBudget } from "../utils/finances";
import { sanitizeForFirestore } from "../utils/firestore";
import {
  calculateRubricProgress
} from "../utils/progress";
import { normalizeUnit } from "../utils/units";
import { firestoreDb, isFirebaseConfigured } from "./firebase";
import { getCurrentUserProfile } from "./auth";
import { canManageFinances, canViewAllTasks, canViewAllWorks } from "./roles";
import { generateId, getStoredData, isDemoSession, saveStoredData } from "./storage";

type ObraInput = Omit<Obra, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<Obra, "createdAt" | "updatedAt">>;

const collections = {
  obras: "obras",
  oportunidades: "oportunidades",
  cobros: "cobros",
  actividades: "actividades",
  cuadrillas: "cuadrillas",
  tareasInstalacion: "tareasInstalacion",
  movimientosFinancieros: "movimientosFinancieros",
  rubrosAvanceConfigurados: "rubrosAvance",
  reportesAvance: "reportesAvance",
  materialesPendientes: "materialesPendientes",
  actividadesAvance: "actividadesAvance",
  users: "users",
  clientes: "clientes",
  proveedores: "proveedores",
  cheques: "cheques",
  tareas: "tareas",
  jornadasCampo: "jornadasCampo"
} as const;

function shouldUseFirebase() {
  return isFirebaseConfigured() && Boolean(firestoreDb) && !isDemoSession();
}

function now() {
  return new Date().toISOString();
}

function withError(error: unknown, fallback: string): Error {
  console.error(fallback, error);

  if (isPermissionDenied(error)) {
    return new Error("No tenes permisos para consultar esta informacion. Verifica que tu usuario tenga un rol activo.");
  }

  return new Error(error instanceof Error ? error.message : fallback);
}

function isPermissionDenied(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "permission-denied"
    || candidate.message?.toLowerCase().includes("missing or insufficient permissions") === true;
}

async function getActiveProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new Error("Tu cuenta existe, pero todavia no tiene un perfil y rol asignados. Contacta al administrador.");
  }
  if (!profile.active) {
    throw new Error("Tu usuario esta inactivo. Contacta al administrador.");
  }
  return profile;
}

async function getCollection<T extends { id: string }>(name: keyof typeof collections): Promise<T[]> {
  if (!shouldUseFirebase() || !firestoreDb) {
    return getStoredData()[name] as unknown as T[];
  }

  try {
    const db = firestoreDb;
    if (name === "obras") {
      const profile = await getActiveProfile();
      if (!canViewAllWorks(profile.role)) {
        const ids = profile.assignedWorkIds ?? [];
        if (!ids.length) return [];

        const docs = await Promise.all(
          ids.map((id) => getDoc(doc(db, collections.obras, id)))
        );
        return docs
          .filter((item) => item.exists())
          .map((item) => ({ id: item.id, ...item.data() }) as T);
      }
    }

    const snapshot = await getDocs(collection(db, collections[name]));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
  } catch (error) {
    throw withError(error, `No se pudo leer ${collections[name]}.`);
  }
}

async function getCollectionByWork<T extends { id: string }>(
  name: keyof typeof collections,
  obraId: string
): Promise<T[]> {
  if (!shouldUseFirebase() || !firestoreDb) {
    return (getStoredData()[name] as unknown as T[]).filter((item) => {
      const record = item as unknown as { obraId?: string };
      return record.obraId === obraId;
    });
  }

  try {
    const snapshot = await getDocs(
      query(collection(firestoreDb, collections[name]), where("obraId", "==", obraId))
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
  } catch (error) {
    throw withError(error, `No se pudo leer ${collections[name]} para la obra ${obraId}.`);
  }
}

async function createDocument<T extends { id: string }>(
  name: keyof typeof collections,
  data: Omit<T, "id">
): Promise<T> {
  if (!shouldUseFirebase() || !firestoreDb) {
    const stored = getStoredData();
    const id = generateId(name);
    const record = sanitizeForFirestore({ id, ...data }) as T;
    (stored[name] as unknown as T[]).unshift(record);
    saveStoredData(stored);
    return record;
  }

  try {
    const sanitized = sanitizeForFirestore(data) as Omit<T, "id">;
    const ref = await addDoc(collection(firestoreDb, collections[name]), sanitized);
    return { id: ref.id, ...sanitized } as T;
  } catch (error) {
    throw withError(error, `No se pudo crear ${collections[name]}.`);
  }
}

async function createDocumentWithId<T extends { id: string }>(
  name: keyof typeof collections,
  id: string,
  data: Omit<T, "id">
): Promise<T> {
  if (!shouldUseFirebase() || !firestoreDb) {
    const stored = getStoredData();
    const record = sanitizeForFirestore({ id, ...data }) as T;
    (stored[name] as unknown as T[]).unshift(record);
    saveStoredData(stored);
    return record;
  }

  try {
    const sanitized = sanitizeForFirestore(data) as Omit<T, "id">;
    await setDoc(doc(firestoreDb, collections[name], id), sanitized);
    return { id, ...sanitized } as T;
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

    records[index] = sanitizeForFirestore({ ...records[index], ...data }) as T;
    saveStoredData(stored);
    return records[index];
  }

  try {
    await updateDoc(doc(firestoreDb, collections[name], id), sanitizeForFirestore(data) as Record<string, unknown>);
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
    totalContratado: data.totalContratado ?? valorFinalContratado,
    direccion: data.direccion ?? data.ubicacion,
    fechaComprometida: data.fechaComprometida ?? data.fechaEntrega,
    costosEstimados: data.costosEstimados?.length
      ? data.costosEstimados
      : getDefaultCostBudget(valorFinalContratado),
    movimientosFinancieros: data.movimientosFinancieros ?? [],
    rubrosAvance: data.progressConfigured === undefined
      ? data.rubrosAvance?.length
        ? data.rubrosAvance
        : initialRubros
      : data.rubrosAvance ?? [],
    etapasProduccion: data.etapasProduccion?.length ? data.etapasProduccion : initialProductionStages,
    materialesFaltantes: data.materialesFaltantes ?? [],
    createdAt,
    updatedAt: data.updatedAt ?? createdAt
  });
}

export async function updateObra(id: string, data: Partial<Obra>): Promise<Obra> {
  return updateDocument<Obra>("obras", id, { ...data, updatedAt: now() });
}

export async function getClientes(): Promise<Cliente[]> {
  return (await getCollection<Cliente>("clientes")).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function createCliente(
  data: Omit<Cliente, "id" | "createdAt" | "updatedAt">
): Promise<Cliente> {
  const createdAt = now();
  return createDocument<Cliente>("clientes", {
    ...data,
    createdAt,
    updatedAt: createdAt
  });
}

export async function updateCliente(id: string, data: Partial<Cliente>): Promise<Cliente> {
  return updateDocument<Cliente>("clientes", id, { ...data, updatedAt: now() });
}

export async function getProveedores(): Promise<Proveedor[]> {
  return (await getCollection<Proveedor>("proveedores")).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function createProveedor(
  data: Omit<Proveedor, "id" | "createdAt" | "updatedAt">
): Promise<Proveedor> {
  const createdAt = now();
  return createDocument<Proveedor>("proveedores", {
    ...data,
    createdAt,
    updatedAt: createdAt
  });
}

export async function updateProveedor(id: string, data: Partial<Proveedor>): Promise<Proveedor> {
  return updateDocument<Proveedor>("proveedores", id, { ...data, updatedAt: now() });
}

export async function deleteObra(id: string): Promise<void> {
  if (!shouldUseFirebase() || !firestoreDb) {
    const stored = getStoredData();
    stored.obras = stored.obras.filter((obra) => obra.id !== id);
    stored.cobros = stored.cobros.filter((cobro) => cobro.obraId !== id);
    stored.actividades = stored.actividades.filter((actividad) => actividad.obraId !== id);
    stored.tareasInstalacion = stored.tareasInstalacion.filter((tarea) => tarea.obraId !== id);
    stored.movimientosFinancieros = stored.movimientosFinancieros.filter(
      (movement) => movement.obraId !== id
    );
    stored.rubrosAvanceConfigurados = stored.rubrosAvanceConfigurados.filter((rubro) => rubro.obraId !== id);
    stored.reportesAvance = stored.reportesAvance.filter((report) => report.obraId !== id);
    stored.materialesPendientes = stored.materialesPendientes.filter((material) => material.obraId !== id);
    stored.actividadesAvance = stored.actividadesAvance.filter((activity) => activity.obraId !== id);
    stored.tareas = stored.tareas.filter((tarea) => tarea.obraId !== id);
    stored.jornadasCampo = stored.jornadasCampo.filter((jornada) => jornada.obraId !== id);
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
  if (shouldUseFirebase()) {
    const profile = await getActiveProfile();
    if (!canManageFinances(profile.role)) {
      return [];
    }
  }

  return getCollectionByWork<Cobro>("cobros", obraId);
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
  return (await getCollectionByWork<Actividad>("actividades", obraId))
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
  return getCollectionByWork<TareaInstalacion>("tareasInstalacion", obraId);
}

export async function updateTareaInstalacion(
  id: string,
  data: Partial<TareaInstalacion>
): Promise<TareaInstalacion> {
  return updateDocument<TareaInstalacion>("tareasInstalacion", id, data);
}

export async function getFieldTasks(): Promise<FieldTask[]> {
  if (!shouldUseFirebase() || !firestoreDb) {
    return (getStoredData().tareas ?? [])
      .sort((a, b) => (b.fechaAsignada ?? b.createdAt).localeCompare(a.fechaAsignada ?? a.createdAt));
  }

  try {
    const profile = await getActiveProfile();
    if (canViewAllTasks(profile)) {
      return (await getCollection<FieldTask>("tareas"))
        .sort((a, b) => (b.fechaAsignada ?? b.createdAt).localeCompare(a.fechaAsignada ?? a.createdAt));
    }

    const db = firestoreDb;
    const tasksById = new Map<string, FieldTask>();
    const assignedSnapshot = await getDocs(query(collection(db, collections.tareas), where("asignadoAId", "==", profile.uid)));
    assignedSnapshot.docs.forEach((item) => tasksById.set(item.id, { id: item.id, ...item.data() } as FieldTask));

    for (const obraId of profile.assignedWorkIds ?? []) {
      const workSnapshot = await getDocs(query(collection(db, collections.tareas), where("obraId", "==", obraId)));
      workSnapshot.docs.forEach((item) => tasksById.set(item.id, { id: item.id, ...item.data() } as FieldTask));
    }

    return Array.from(tasksById.values())
      .sort((a, b) => (b.fechaAsignada ?? b.createdAt).localeCompare(a.fechaAsignada ?? a.createdAt));
  } catch (error) {
    throw withError(error, "No se pudieron cargar las tareas de campo.");
  }
}

export async function getFieldTasksByWork(obraId: string): Promise<FieldTask[]> {
  return (await getCollectionByWork<FieldTask>("tareas", obraId))
    .sort((a, b) => (b.fechaAsignada ?? b.createdAt).localeCompare(a.fechaAsignada ?? a.createdAt));
}

export async function createFieldTask(
  data: Omit<FieldTask, "id" | "createdAt" | "updatedAt">
): Promise<FieldTask> {
  const profile = await getCurrentUserProfile();
  const createdAt = now();
  const task = await createDocument<FieldTask>("tareas", {
    ...data,
    createdAt,
    createdBy: data.createdBy ?? profile?.uid ?? "system",
    estado: data.asignadoAId || data.asignadoANombre ? data.estado || "asignada" : data.estado || "pendiente"
  });

  await createActividad({
    obraId: task.obraId,
    tipo: "tarea",
    descripcion: `Tarea creada: ${task.titulo}.`,
    usuario: profile?.nombre ?? "Sistema",
    fecha: now()
  });

  await createProgressActivity({
    obraId: task.obraId,
    tipo: "tarea",
    descripcion: `Tarea creada: ${task.titulo}.`,
    userId: profile?.uid ?? "system",
    userName: profile?.nombre ?? "Sistema",
    fechaHora: now(),
    newValue: task
  });

  return task;
}

export async function updateFieldTask(id: string, data: Partial<FieldTask>): Promise<FieldTask> {
  const profile = await getCurrentUserProfile();
  const updated = await updateDocument<FieldTask>("tareas", id, {
    ...data,
    updatedAt: now(),
    updatedBy: profile?.uid ?? "system"
  });

  await createProgressActivity({
    obraId: updated.obraId,
    tipo: "tarea",
    descripcion: `Tarea actualizada: ${updated.titulo} (${updated.estado}).`,
    userId: profile?.uid ?? "system",
    userName: profile?.nombre ?? "Sistema",
    fechaHora: now(),
    newValue: updated
  });

  return updated;
}

export async function getFieldWorkdays(): Promise<FieldWorkday[]> {
  if (!shouldUseFirebase() || !firestoreDb) {
    return (getStoredData().jornadasCampo ?? [])
      .sort((a, b) => `${b.fecha}T${b.horaInicio}`.localeCompare(`${a.fecha}T${a.horaInicio}`));
  }

  try {
    const profile = await getActiveProfile();
    if (canViewAllTasks(profile)) {
      return (await getCollection<FieldWorkday>("jornadasCampo"))
        .sort((a, b) => `${b.fecha}T${b.horaInicio}`.localeCompare(`${a.fecha}T${a.horaInicio}`));
    }

    const db = firestoreDb;
    const workdaysById = new Map<string, FieldWorkday>();
    const ownSnapshot = await getDocs(query(collection(db, collections.jornadasCampo), where("userId", "==", profile.uid)));
    ownSnapshot.docs.forEach((item) => workdaysById.set(item.id, { id: item.id, ...item.data() } as FieldWorkday));

    for (const obraId of profile.assignedWorkIds ?? []) {
      const workSnapshot = await getDocs(query(collection(db, collections.jornadasCampo), where("obraId", "==", obraId)));
      workSnapshot.docs.forEach((item) => workdaysById.set(item.id, { id: item.id, ...item.data() } as FieldWorkday));
    }

    return Array.from(workdaysById.values())
      .sort((a, b) => `${b.fecha}T${b.horaInicio}`.localeCompare(`${a.fecha}T${a.horaInicio}`));
  } catch (error) {
    throw withError(error, "No se pudieron cargar las jornadas de campo.");
  }
}

export async function getFieldWorkdaysByWork(obraId: string): Promise<FieldWorkday[]> {
  return (await getCollectionByWork<FieldWorkday>("jornadasCampo", obraId))
    .sort((a, b) => `${b.fecha}T${b.horaInicio}`.localeCompare(`${a.fecha}T${a.horaInicio}`));
}

export async function createFieldWorkday(
  data: Omit<FieldWorkday, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<FieldWorkday> {
  const createdAt = now();
  const { id, ...workdayData } = data;
  const jornada = id
    ? await createDocumentWithId<FieldWorkday>("jornadasCampo", id, {
        ...workdayData,
        createdAt
      })
    : await createDocument<FieldWorkday>("jornadasCampo", {
        ...workdayData,
        createdAt
      });

  await createProgressActivity({
    obraId: jornada.obraId,
    tipo: "jornada",
    descripcion: jornada.fotoLlegada
      ? `Jornada iniciada con foto de llegada por ${jornada.equipoNombre || jornada.userName}.`
      : `Jornada iniciada por ${jornada.equipoNombre || jornada.userName}.`,
    userId: jornada.userId,
    userName: jornada.userName,
    fechaHora: createdAt,
    newValue: jornada
  });

  return jornada;
}

export async function updateFieldWorkday(
  id: string,
  data: Partial<FieldWorkday>
): Promise<FieldWorkday> {
  const updated = await updateDocument<FieldWorkday>("jornadasCampo", id, {
    ...data,
    updatedAt: now()
  });

  if (data.estado === "finalizada") {
    await createProgressActivity({
      obraId: updated.obraId,
      tipo: "jornada",
      descripcion: data.fotoCierre
        ? `Jornada finalizada con foto de cierre por ${updated.equipoNombre || updated.userName}.`
        : `Jornada finalizada por ${updated.equipoNombre || updated.userName}.`,
      userId: updated.userId,
      userName: updated.userName,
      fechaHora: now(),
      newValue: updated
    });
  }

  return updated;
}

export function appendTaskPhotos(task: FieldTask, photos: TaskPhoto[]): TaskPhoto[] {
  return [...(task.fotos ?? []), ...photos];
}

export async function getFinancialWorks(): Promise<Obra[]> {
  return getObras();
}

export async function createFinancialWork(data: {
  nombre: string;
  cliente: string;
  arquitecto?: string;
  direccion?: string;
  fechaInicio?: string;
  fechaComprometida?: string;
  presupuestoAprobado: number;
  adicionalesAprobados: number;
  descuentos: number;
  observacionInicial?: string;
  estado?: WorkStatusLike;
}): Promise<Obra> {
  const totalContratado =
    data.presupuestoAprobado + data.adicionalesAprobados - data.descuentos;

  return createObra({
    nombre: data.nombre,
    cliente: data.cliente,
    arquitecto: data.arquitecto ?? "",
    ubicacion: data.direccion ?? "",
    direccion: data.direccion ?? "",
    montoAprobado: totalContratado,
    fechaInicio: data.fechaInicio ?? new Date().toISOString().slice(0, 10),
    fechaEntrega: data.fechaComprometida ?? new Date().toISOString().slice(0, 10),
    fechaComprometida: data.fechaComprometida,
    responsable: "Administracion",
    estado: data.estado ?? "Aprobado",
    saldoPendienteCobro: totalContratado,
    presupuestoAprobado: data.presupuestoAprobado,
    adicionalesAprobados: data.adicionalesAprobados,
    descuentos: data.descuentos,
    totalContratado,
    valorFinalContratado: totalContratado,
    observacionInicial: data.observacionInicial,
    rubrosAvance: [],
    etapasProduccion: [],
    materialesFaltantes: []
  });
}

export async function updateFinancialWork(
  id: string,
  data: Partial<Obra>
): Promise<Obra> {
  return updateObra(id, data);
}

export async function deleteFinancialWork(id: string): Promise<void> {
  return deleteObra(id);
}

export async function getMovementsByWork(obraId: string): Promise<FinancialMovement[]> {
  return (await getCollectionByWork<FinancialMovement>("movimientosFinancieros", obraId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function getCheques(): Promise<Cheque[]> {
  return (await getCollection<Cheque>("cheques"))
    .sort((a, b) => getChequeDueDate(b).localeCompare(getChequeDueDate(a)));
}

export async function updateCheque(id: string, data: Partial<Cheque>): Promise<Cheque> {
  const profile = await getCurrentUserProfile();
  const previous = (await getCheques()).find((cheque) => cheque.id === id);
  const nextStatus = data.estado;
  const history = nextStatus && previous?.estado !== nextStatus
    ? [
        ...(previous?.historial ?? []),
        {
          estado: nextStatus,
          fecha: now(),
          usuario: profile?.nombre ?? profile?.email ?? "Sistema",
          observacion: data.observacion
        }
      ]
    : previous?.historial;

  const updated = await updateDocument<Cheque>("cheques", id, {
    ...data,
    historial: history,
    updatedAt: now(),
    updatedBy: profile?.uid ?? "unknown"
  });

  if (previous && data.estado && previous.estado !== data.estado) {
    await createActividad({
      obraId: updated.obraId,
      tipo: "cheque",
      descripcion: `Cheque ${updated.numeroCheque} cambio a ${data.estado}.`,
      usuario: profile?.nombre ?? "Administracion",
      fecha: now()
    });
  }

  return updated;
}

export async function syncChequesFromMovements(): Promise<Cheque[]> {
  const [obras, movements, existing] = await Promise.all([
    getObras(),
    getCollection<FinancialMovement>("movimientosFinancieros"),
    getCheques()
  ]);
  const existingByMovement = new Map(existing.map((cheque) => [cheque.movimientoId, cheque]));

  for (const movement of movements) {
    const obra = obras.find((item) => item.id === movement.obraId);
    if (!obra) continue;

    if (movement.metodoPago === "Cheque") {
      await syncChequeForMovement(obra, movement, existingByMovement.get(movement.id));
    } else if (existingByMovement.has(movement.id)) {
      await updateCheque(existingByMovement.get(movement.id)!.id, { estado: "anulado" });
    }
  }

  return getCheques();
}

export async function createMovement(
  obraId: string,
  data: Omit<FinancialMovement, "id" | "obraId" | "createdAt" | "updatedAt">
): Promise<FinancialMovement> {
  const movement = await createDocument<FinancialMovement>("movimientosFinancieros", {
    ...data,
    obraId,
    createdAt: now()
  });
  await syncFinancialWorkSaldo(obraId);
  await syncChequeForMovementId(obraId, movement);
  return movement;
}

export async function updateMovement(
  obraId: string,
  movementId: string,
  data: Partial<FinancialMovement>
): Promise<FinancialMovement> {
  const movement = await updateDocument<FinancialMovement>("movimientosFinancieros", movementId, {
    ...data,
    updatedAt: now()
  });
  await syncFinancialWorkSaldo(obraId);
  await syncChequeForMovementId(obraId, movement);
  return movement;
}

export async function deleteMovement(obraId: string, movementId: string): Promise<void> {
  await annulChequeForMovement(movementId);
  await deleteDocument<FinancialMovement>("movimientosFinancieros", movementId);
  await syncFinancialWorkSaldo(obraId);
}

export async function getProgressRubricsByWork(obraId: string): Promise<WorkProgressRubric[]> {
  try {
    const rubrics = (await getCollectionByWork<WorkProgressRubric>("rubrosAvanceConfigurados", obraId))
      .map((rubro) => ({
        ...rubro,
        unidad: normalizeUnit(rubro.unidad) || rubro.unidad
      }))
      .sort((a, b) => a.orden - b.orden);

    if (rubrics.length) {
      return rubrics;
    }

    const obra = await getObraById(obraId);
    if (!obra) {
      return [];
    }

    const created: WorkProgressRubric[] = [];
    for (const [index, rubro] of obra.rubrosAvance.entries()) {
      created.push(await createProgressRubric({
        obraId,
        nombre: rubro.nombre,
        unidad: inferProgressUnit(rubro.nombre),
        cantidadTotalPrevista: 100,
        pesoOperativo: rubro.peso,
        modoCalculo: "manual",
        avanceManualPermitido: true,
        orden: index + 1
      }));
    }
    return created;
  } catch (error) {
    throw withError(error, "No se pudieron cargar los rubros de avance.");
  }
}

export async function createProgressRubric(
  data: Omit<WorkProgressRubric, "id" | "createdAt" | "updatedAt">
): Promise<WorkProgressRubric> {
  try {
    const created = await createDocument<WorkProgressRubric>("rubrosAvanceConfigurados", {
      ...data,
      unidad: normalizeUnit(data.unidad) || data.unidad,
      pesoOperativo: Math.max(0, Math.min(100, data.pesoOperativo)),
      cantidadTotalPrevista: Math.max(0, data.cantidadTotalPrevista),
      equivalenciaM2PorUnidad: data.equivalenciaM2PorUnidad === undefined ? undefined : Math.max(0, data.equivalenciaM2PorUnidad),
      totalEquivalenteM2: data.totalEquivalenteM2 === undefined ? undefined : Math.max(0, data.totalEquivalenteM2),
      createdAt: now()
    });
    await createProgressActivity({
      obraId: data.obraId,
      tipo: "configuracion",
      descripcion: `Se configuro el rubro ${data.nombre}.`,
      userId: "demo-admin",
      userName: "Richard",
      fechaHora: now(),
      newValue: created
    });
    return created;
  } catch (error) {
    throw withError(error, "No se pudo crear el rubro de avance.");
  }
}

export async function updateProgressRubric(
  id: string,
  data: Partial<WorkProgressRubric>
): Promise<WorkProgressRubric> {
  try {
    const updated = await updateDocument<WorkProgressRubric>("rubrosAvanceConfigurados", id, {
      ...data,
      unidad: data.unidad === undefined ? undefined : normalizeUnit(data.unidad) || data.unidad,
      pesoOperativo: data.pesoOperativo === undefined ? undefined : Math.max(0, Math.min(100, data.pesoOperativo)),
      cantidadTotalPrevista: data.cantidadTotalPrevista === undefined ? undefined : Math.max(0, data.cantidadTotalPrevista),
      equivalenciaM2PorUnidad: data.equivalenciaM2PorUnidad === undefined ? undefined : Math.max(0, data.equivalenciaM2PorUnidad),
      totalEquivalenteM2: data.totalEquivalenteM2 === undefined ? undefined : Math.max(0, data.totalEquivalenteM2),
      updatedAt: now()
    });
    await syncWorkProgressCache(updated.obraId);
    return updated;
  } catch (error) {
    throw withError(error, "No se pudo actualizar el rubro de avance.");
  }
}

export async function deleteProgressRubric(id: string): Promise<void> {
  try {
    const existing = (await getCollection<WorkProgressRubric>("rubrosAvanceConfigurados")).find((item) => item.id === id);
    await deleteDocument<WorkProgressRubric>("rubrosAvanceConfigurados", id);
    if (existing) {
      await syncWorkProgressCache(existing.obraId);
    }
  } catch (error) {
    throw withError(error, "No se pudo eliminar el rubro de avance.");
  }
}

export async function getProgressReportsByWork(obraId: string): Promise<ProgressReport[]> {
  try {
    return (await getCollectionByWork<ProgressReport>("reportesAvance", obraId))
      .sort((a, b) => `${b.fecha}T${b.hora}`.localeCompare(`${a.fecha}T${a.hora}`));
  } catch (error) {
    throw withError(error, "No se pudieron cargar los reportes de avance.");
  }
}

export async function createProgressReport(
  data: Omit<ProgressReport, "id" | "createdAt" | "updatedAt">
): Promise<ProgressReport> {
  try {
    const report = await createDocument<ProgressReport>("reportesAvance", {
      ...data,
      createdAt: now()
    });

    for (const material of data.materialsReported ?? []) {
      const { id: _discardedId, ...materialData } = material;
      await createPendingMaterial({
        ...materialData,
        obraId: data.obraId,
        reportadoPor: data.userName,
        fechaReporte: data.fecha
      });
    }

    await createProgressActivity({
      obraId: data.obraId,
      tipo: "avance",
      descripcion: `Se registro un parte de avance con ${data.entries.length} rubro(s).`,
      userId: data.userId,
      userName: data.userName,
      fechaHora: `${data.fecha}T${data.hora}`,
      newValue: data.entries,
      reportId: report.id
    });

    await createActividad({
      obraId: data.obraId,
      tipo: "avance",
      descripcion: `Se registro un parte de avance por ${data.userName}.`,
      usuario: data.userName,
      fecha: now()
    });

    await syncWorkProgressCache(data.obraId);
    return report;
  } catch (error) {
    throw withError(error, "No se pudo crear el parte de avance.");
  }
}

export async function updateProgressReport(
  id: string,
  data: Partial<ProgressReport>
): Promise<ProgressReport> {
  try {
    const updated = await updateDocument<ProgressReport>("reportesAvance", id, {
      ...data,
      updatedAt: now()
    });
    await syncWorkProgressCache(updated.obraId);
    return updated;
  } catch (error) {
    throw withError(error, "No se pudo actualizar el parte de avance.");
  }
}

export async function deleteProgressReport(id: string): Promise<void> {
  try {
    const existing = (await getCollection<ProgressReport>("reportesAvance")).find((item) => item.id === id);
    await deleteDocument<ProgressReport>("reportesAvance", id);
    if (existing) {
      await syncWorkProgressCache(existing.obraId);
    }
  } catch (error) {
    throw withError(error, "No se pudo eliminar el parte de avance.");
  }
}

export async function getPendingMaterialsByWork(obraId: string): Promise<ProgressMaterialReport[]> {
  try {
    return (await getCollectionByWork<ProgressMaterialReport>("materialesPendientes", obraId))
      .sort((a, b) => b.fechaReporte.localeCompare(a.fechaReporte));
  } catch (error) {
    throw withError(error, "No se pudieron cargar los materiales pendientes.");
  }
}

export async function createPendingMaterial(
  data: Omit<ProgressMaterialReport, "id">
): Promise<ProgressMaterialReport> {
  try {
    const material = await createDocument<ProgressMaterialReport>("materialesPendientes", data);
    const obra = await getObraById(data.obraId);
    if (obra) {
      await updateObra(data.obraId, {
        materialesFaltantes: [
          {
            id: material.id,
            material: material.material,
            cantidad: material.cantidad,
            unidad: material.unidad,
            observacion: material.observacion ?? "",
            estado: material.estado === "Resuelto" ? "Resuelto" : "Pendiente",
            createdAt: material.fechaReporte
          },
          ...obra.materialesFaltantes.filter((item) => item.id !== material.id)
        ]
      });
    }
    await createProgressActivity({
      obraId: data.obraId,
      tipo: "materiales",
      descripcion: `Material pendiente reportado: ${data.material}.`,
      userId: "demo-user",
      userName: data.reportadoPor,
      fechaHora: now(),
      newValue: material
    });
    return material;
  } catch (error) {
    throw withError(error, "No se pudo crear el material pendiente.");
  }
}

export async function updatePendingMaterial(
  id: string,
  data: Partial<ProgressMaterialReport>
): Promise<ProgressMaterialReport> {
  try {
    const updated = await updateDocument<ProgressMaterialReport>("materialesPendientes", id, data);
    const obra = await getObraById(updated.obraId);
    if (obra) {
      await updateObra(updated.obraId, {
        materialesFaltantes: obra.materialesFaltantes.map((item) =>
          item.id === id
            ? { ...item, estado: updated.estado === "Resuelto" ? "Resuelto" : "Pendiente" }
            : item
        )
      });
    }
    await createProgressActivity({
      obraId: updated.obraId,
      tipo: "materiales",
      descripcion: `Material ${updated.material} cambio a ${updated.estado}.`,
      userId: "demo-user",
      userName: updated.reportadoPor,
      fechaHora: now(),
      newValue: updated
    });
    return updated;
  } catch (error) {
    throw withError(error, "No se pudo actualizar el material pendiente.");
  }
}

export async function getProgressActivityByWork(obraId: string): Promise<ProgressActivityLog[]> {
  try {
    return (await getCollectionByWork<ProgressActivityLog>("actividadesAvance", obraId))
      .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
  } catch (error) {
    throw withError(error, "No se pudo cargar la actividad de avance.");
  }
}

export async function createProgressActivity(
  data: Omit<ProgressActivityLog, "id">
): Promise<ProgressActivityLog> {
  return createDocument<ProgressActivityLog>("actividadesAvance", data);
}

async function syncFinancialWorkSaldo(obraId: string): Promise<void> {
  const obra = await getObraById(obraId);
  if (!obra) {
    return;
  }

  const movements = await getMovementsByWork(obraId);
  await updateObra(obraId, {
    saldoPendienteCobro: calculateSaldoPendiente(obra, movements)
  });
}

async function syncChequeForMovementId(obraId: string, movement: FinancialMovement): Promise<void> {
  const obra = await getObraById(obraId);
  if (!obra) return;
  const existing = (await getCheques()).find((cheque) => cheque.movimientoId === movement.id);

  if (movement.metodoPago !== "Cheque") {
    if (existing && existing.estado !== "anulado") {
      await updateCheque(existing.id, { estado: "anulado" });
    }
    return;
  }

  await syncChequeForMovement(obra, movement, existing);
}

async function syncChequeForMovement(obra: Obra, movement: FinancialMovement, existing?: Cheque): Promise<Cheque | null> {
  if (movement.metodoPago !== "Cheque" || !movement.numeroCheque || !movement.fechaEmisionCheque || !movement.fechaCobroCheque) {
    if (existing && existing.estado !== "anulado") {
      return updateCheque(existing.id, { estado: "anulado" });
    }
    return null;
  }

  const isIngreso = movement.tipo === "ingreso";
  const thirdParty = getMovementThirdPartyForCheque(obra, movement);
  const payload: Omit<Cheque, "id" | "createdAt"> = {
    tipo: isIngreso ? "recibido" : "emitido",
    estado: existing?.estado && existing.estado !== "anulado"
      ? existing.estado
      : isIngreso ? "recibido" : "emitido",
    obraId: obra.id,
    obraNombre: obra.nombre,
    movimientoId: movement.id,
    origen: movement.tipo,
    terceroId: thirdParty.id,
    terceroNombre: thirdParty.nombre,
    terceroTipo: thirdParty.tipo,
    clienteId: isIngreso ? thirdParty.id : obra.clienteId,
    clienteNombre: isIngreso ? thirdParty.nombre : obra.clienteNombre ?? obra.cliente,
    pagadorId: isIngreso ? thirdParty.id : undefined,
    pagadorNombre: isIngreso ? thirdParty.nombre : undefined,
    proveedorId: !isIngreso && thirdParty.tipo === "proveedor" ? thirdParty.id : undefined,
    proveedorNombre: !isIngreso && thirdParty.tipo === "proveedor" ? thirdParty.nombre : undefined,
    beneficiarioId: !isIngreso ? thirdParty.id : undefined,
    beneficiarioNombre: !isIngreso ? thirdParty.nombre : undefined,
    monto: movement.monto,
    numeroCheque: movement.numeroCheque,
    bancoCheque: movement.bancoCheque,
    fechaEmisionCheque: movement.fechaEmisionCheque,
    fechaCobroCheque: movement.fechaCobroCheque,
    fechaVencimientoCheque: movement.fechaCobroCheque,
    observacion: movement.observacion,
    historial: existing?.historial ?? [
      {
        estado: isIngreso ? "recibido" : "emitido",
        fecha: now(),
        usuario: "Sistema",
        observacion: "Cheque sincronizado desde movimiento financiero."
      }
    ],
    createdBy: existing?.createdBy,
    updatedAt: now(),
    updatedBy: "system"
  };

  if (existing) {
    return updateDocument<Cheque>("cheques", existing.id, payload);
  }

  return createDocument<Cheque>("cheques", {
    ...payload,
    createdAt: now()
  });
}

async function annulChequeForMovement(movementId: string): Promise<void> {
  const existing = (await getCheques()).find((cheque) => cheque.movimientoId === movementId);
  if (existing && existing.estado !== "anulado") {
    await updateCheque(existing.id, { estado: "anulado" });
  }
}

function getMovementThirdPartyForCheque(obra: Obra, movement: FinancialMovement): { id?: string; nombre: string; tipo: "cliente" | "proveedor" | "persona" } {
  if (movement.tipo === "ingreso") {
    return {
      id: movement.pagadorId ?? movement.clienteId ?? obra.clienteId,
      nombre: movement.pagadorNombre ?? movement.clienteNombre ?? obra.clienteNombre ?? obra.cliente ?? movement.tercero ?? "Cliente",
      tipo: "cliente"
    };
  }

  if (movement.proveedorId || movement.proveedorNombre) {
    return {
      id: movement.proveedorId,
      nombre: movement.proveedorNombre ?? movement.tercero ?? "Proveedor",
      tipo: "proveedor"
    };
  }

  return {
    nombre: movement.tercero ?? "Persona",
    tipo: "persona"
  };
}

function getChequeDueDate(cheque: Cheque): string {
  return cheque.fechaCobroCheque || cheque.fechaVencimientoCheque || cheque.fechaEmisionCheque || "";
}

async function syncWorkProgressCache(obraId: string): Promise<void> {
  const [rubrics, reports] = await Promise.all([
    getProgressRubricsByWork(obraId),
    getProgressReportsByWork(obraId)
  ]);

  if (!rubrics.length) {
    return;
  }

  await updateObra(obraId, {
    progressConfigured: true,
    rubrosAvance: rubrics.map((rubro) => ({
      id: rubro.id,
      nombre: rubro.nombre,
      peso: rubro.pesoOperativo,
      avance: calculateRubricProgress(rubro, reports)
    }))
  });
}

function inferProgressUnit(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("vidrio") || normalized.includes("sellado")) return "m2";
  return "unidad";
}

type WorkStatusLike = Obra["estado"];

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
        const targetCollection = collections[collectionName as keyof typeof collections] ?? collectionName;
        const ref = doc(db, targetCollection, getSeedRecordId(record));
        batch.set(ref, sanitizeForFirestore(record));
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
      const targetCollection = collections[collectionName as keyof typeof collections] ?? collectionName;
      await setDoc(doc(db, targetCollection, getSeedRecordId(record)), sanitizeForFirestore(record));
    }
  }
}

function getSeedRecordId(record: unknown): string {
  const item = record as { id?: string; uid?: string };
  if (item.id) return item.id;
  if (item.uid) return item.uid;
  return generateId("seed");
}
