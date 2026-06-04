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
  FinancialMovement,
  Obra,
  OportunidadCRM,
  ProgressActivityLog,
  ProgressMaterialReport,
  ProgressReport,
  TareaInstalacion,
  WorkProgressRubric
} from "../types";
import { calculateSaldoPendiente } from "../utils/finance";
import { getDefaultCostBudget } from "../utils/finances";
import {
  calculateRubricProgress
} from "../utils/progress";
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
  tareasInstalacion: "tareasInstalacion",
  movimientosFinancieros: "movimientosFinancieros",
  rubrosAvanceConfigurados: "rubrosAvanceConfigurados",
  reportesAvance: "reportesAvance",
  materialesPendientes: "materialesPendientes",
  actividadesAvance: "actividadesAvance"
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
    await updateDoc(doc(firestoreDb, collections[name], id), stripUndefined(data) as Record<string, unknown>);
    const updated = await getDoc(doc(firestoreDb, collections[name], id));
    return { id: updated.id, ...updated.data() } as T;
  } catch (error) {
    throw withError(error, `No se pudo actualizar ${collections[name]}.`);
  }
}

function stripUndefined<T extends Record<string, unknown> | object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
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
    stored.movimientosFinancieros = stored.movimientosFinancieros.filter(
      (movement) => movement.obraId !== id
    );
    stored.rubrosAvanceConfigurados = stored.rubrosAvanceConfigurados.filter((rubro) => rubro.obraId !== id);
    stored.reportesAvance = stored.reportesAvance.filter((report) => report.obraId !== id);
    stored.materialesPendientes = stored.materialesPendientes.filter((material) => material.obraId !== id);
    stored.actividadesAvance = stored.actividadesAvance.filter((activity) => activity.obraId !== id);
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
  return (await getCollection<FinancialMovement>("movimientosFinancieros"))
    .filter((movement) => movement.obraId === obraId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
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
  return movement;
}

export async function deleteMovement(obraId: string, movementId: string): Promise<void> {
  await deleteDocument<FinancialMovement>("movimientosFinancieros", movementId);
  await syncFinancialWorkSaldo(obraId);
}

export async function getProgressRubricsByWork(obraId: string): Promise<WorkProgressRubric[]> {
  try {
    const rubrics = (await getCollection<WorkProgressRubric>("rubrosAvanceConfigurados"))
      .filter((rubro) => rubro.obraId === obraId)
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
      pesoOperativo: Math.max(0, Math.min(100, data.pesoOperativo)),
      cantidadTotalPrevista: Math.max(0, data.cantidadTotalPrevista),
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
      pesoOperativo: data.pesoOperativo === undefined ? undefined : Math.max(0, Math.min(100, data.pesoOperativo)),
      cantidadTotalPrevista: data.cantidadTotalPrevista === undefined ? undefined : Math.max(0, data.cantidadTotalPrevista),
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
    return (await getCollection<ProgressReport>("reportesAvance"))
      .filter((report) => report.obraId === obraId)
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
    return (await getCollection<ProgressMaterialReport>("materialesPendientes"))
      .filter((material) => material.obraId === obraId)
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
    return (await getCollection<ProgressActivityLog>("actividadesAvance"))
      .filter((activity) => activity.obraId === obraId)
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
  if (normalized.includes("perfil")) return "metros";
  return "unidades";
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
