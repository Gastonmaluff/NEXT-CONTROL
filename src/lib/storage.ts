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
    saveStoredData(seedData);
    return structuredClone(seedData);
  }

  try {
    return normalizeStoredData(JSON.parse(stored) as Partial<StoredData>);
  } catch {
    saveStoredData(seedData);
    return structuredClone(seedData);
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
  return {
    obras: data.obras ?? [],
    oportunidades: data.oportunidades ?? [],
    cobros: data.cobros ?? [],
    actividades: data.actividades ?? [],
    cuadrillas: data.cuadrillas ?? [],
    tareasInstalacion: data.tareasInstalacion ?? [],
    movimientosFinancieros: data.movimientosFinancieros ?? seedData.movimientosFinancieros,
    rubrosAvanceConfigurados: data.rubrosAvanceConfigurados ?? seedData.rubrosAvanceConfigurados,
    reportesAvance: data.reportesAvance ?? seedData.reportesAvance,
    materialesPendientes: data.materialesPendientes ?? seedData.materialesPendientes,
    actividadesAvance: data.actividadesAvance ?? seedData.actividadesAvance,
    users: data.users ?? seedData.users,
    clientes: data.clientes ?? seedData.clientes ?? [],
    proveedores: data.proveedores ?? seedData.proveedores ?? [],
    cheques: data.cheques ?? seedData.cheques ?? []
  };
}
