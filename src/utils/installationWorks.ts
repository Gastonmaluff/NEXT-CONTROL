import type { Obra, ProductionOrder } from "../types";
import type { InstallationUnit } from "./installationUnits";

export type InstallationWork = Pick<Obra, "id" | "nombre" | "estado"> & { production?: boolean };
const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").normalize("NFC").toLocaleLowerCase("es");

// These IDs belong to operational works, not financial records. Keep imported
// identities authoritative so renaming a source never moves existing progress.
export function productionWorkId(order: ProductionOrder, units: InstallationUnit[]): string {
  const existing = units.find(unit => unit.sourceOrderId === order.id);
  return existing?.obraId || order.obraId || `produccion:${encodeURIComponent(normalizeName(order.obraNombre) || order.id)}`;
}

export function installationWorks(works: InstallationWork[], orders: ProductionOrder[], units: InstallationUnit[]): InstallationWork[] {
  const result = new Map(works.map(work => [work.id, { ...work }]));
  for (const unit of units) {
    if (!result.has(unit.obraId)) result.set(unit.obraId, { id: unit.obraId, nombre: unit.obraNombre, estado: "Instalacion", production: unit.origin === "produccion" });
  }
  for (const order of orders) {
    const id = productionWorkId(order, units);
    const existing = result.get(id);
    result.set(id, { id, nombre: existing?.nombre || order.obraNombre.trim() || order.numero || order.id, estado: existing?.estado || "Instalacion", production: true });
  }
  return [...result.values()].sort((a, b) => Number(Boolean(b.production)) - Number(Boolean(a.production)) || a.nombre.localeCompare(b.nombre, "es"));
}
