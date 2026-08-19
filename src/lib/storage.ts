import { seedData } from "../data/seedData";
import type { DataSourceLabel, StoredData } from "../types";
import { isFirebaseConfigured as hasFirebaseConfig } from "./firebase";

const STORAGE_KEY = "next-control-demo-data";

export function isFirebaseConfigured(): boolean {
  return hasFirebaseConfig();
}

export function isDemoSession(): boolean {
  if (hasFirebaseConfig() && import.meta.env.PROD) {
    return false;
  }

  return localStorage.getItem("next-control-demo-session") === "true";
}

export function getDataSourceLabel(): DataSourceLabel {
  return isFirebaseConfigured() && !isDemoSession() ? "Usando Firebase" : "Usando modo demo local";
}

export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getStoredData(): StoredData {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    const initialData = shouldSeedDemoData() ? seedData : createEmptyStoredData();
    saveStoredData(initialData);
    return structuredClone(initialData);
  }

  try {
    return normalizeStoredData(JSON.parse(stored) as Partial<StoredData>);
  } catch {
    const initialData = shouldSeedDemoData() ? seedData : createEmptyStoredData();
    saveStoredData(initialData);
    return structuredClone(initialData);
  }
}

export function saveStoredData(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetDemoData(): StoredData {
  const nextData = structuredClone(seedData);
  saveStoredData(nextData);
  return nextData;
}

function normalizeStoredData(data: Partial<StoredData>): StoredData {
  const fallback = shouldSeedDemoData() ? seedData : createEmptyStoredData();

  return {
    obras: data.obras ?? [],
    oportunidades: data.oportunidades ?? [],
    cobros: data.cobros ?? [],
    actividades: data.actividades ?? [],
    cuadrillas: data.cuadrillas ?? [],
    tareasInstalacion: data.tareasInstalacion ?? [],
    movimientosFinancieros: data.movimientosFinancieros ?? fallback.movimientosFinancieros,
    rubrosAvanceConfigurados: data.rubrosAvanceConfigurados ?? fallback.rubrosAvanceConfigurados,
    reportesAvance: data.reportesAvance ?? fallback.reportesAvance,
    materialesPendientes: data.materialesPendientes ?? fallback.materialesPendientes,
    actividadesAvance: data.actividadesAvance ?? fallback.actividadesAvance,
    users: data.users ?? fallback.users,
    clientes: data.clientes ?? fallback.clientes,
    proveedores: data.proveedores ?? fallback.proveedores,
    cheques: data.cheques ?? fallback.cheques,
    tareas: data.tareas ?? fallback.tareas,
    jornadasCampo: data.jornadasCampo ?? fallback.jornadasCampo,
    asignacionesCampo: data.asignacionesCampo ?? fallback.asignacionesCampo,
    produccionEventos: data.produccionEventos ?? fallback.produccionEventos,
    instalacionEventos: data.instalacionEventos ?? fallback.instalacionEventos,
    ordenesProduccion: data.ordenesProduccion ?? fallback.ordenesProduccion
  };
}

function shouldSeedDemoData(): boolean {
  return !hasFirebaseConfig() || isDemoSession();
}

function createEmptyStoredData(): StoredData {
  return {
    obras: [],
    oportunidades: [],
    cobros: [],
    actividades: [],
    cuadrillas: [],
    tareasInstalacion: [],
    movimientosFinancieros: [],
    rubrosAvanceConfigurados: [],
    reportesAvance: [],
    materialesPendientes: [],
    actividadesAvance: [],
    users: [],
    clientes: [],
    proveedores: [],
    cheques: [],
    tareas: [],
    jornadasCampo: [],
    asignacionesCampo: [],
    produccionEventos: [],
    instalacionEventos: [],
    ordenesProduccion: []
  };
}
