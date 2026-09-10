import type { ProductionItemStatus, ProductionMissingItem, ProductionOrderPosition, ProductionOrderStatus } from "../types";

export type ProductionQuickAction = "start" | "finish" | "undo";

export function getProductionMissingItems(position: ProductionOrderPosition) {
  return (position.faltantes ?? []).filter((item) => item.estado !== "resuelto");
}

export function addProductionMissingItem(
  position: ProductionOrderPosition,
  descripcion: string,
  observacion: string,
  reportadoPor: string
): ProductionOrderPosition {
  const cleanDescription = descripcion.trim();
  if (!cleanDescription) return position;

  const missingItem: ProductionMissingItem = {
    id: createMissingItemId(),
    descripcion: cleanDescription,
    observacion: observacion.trim() || undefined,
    reportadoPor,
    reportadoAt: new Date().toISOString(),
    estado: "pendiente"
  };

  return {
    ...position,
    faltantes: [...(position.faltantes ?? []), missingItem]
  };
}

export function resolveProductionMissingItem(
  position: ProductionOrderPosition,
  missingItemId: string,
  resueltoPor: string
): ProductionOrderPosition {
  return {
    ...position,
    faltantes: (position.faltantes ?? []).map((item) => item.id === missingItemId
      ? { ...item, estado: "resuelto", resueltoPor, resueltoAt: new Date().toISOString() }
      : item)
  };
}

export function getProductionPositionCounts(position: ProductionOrderPosition) {
  const total = Math.max(0, Number(position.cantidadTotal) || 0);
  const finished = clamp(Number(position.cantidadTerminada) || 0, 0, total);
  const inProduction = clamp(Number(position.cantidadEnProduccion) || 0, 0, total - finished);
  const pending = Math.max(0, total - finished - inProduction);

  return { total, pending, inProduction, finished };
}

export function applyProductionQuickAction(
  position: ProductionOrderPosition,
  action: ProductionQuickAction
): ProductionOrderPosition {
  const counts = getProductionPositionCounts(position);
  let { pending, inProduction, finished } = counts;

  if (action === "start" && pending > 0) {
    pending -= 1;
    inProduction += 1;
  }

  if (action === "finish") {
    if (inProduction > 0) {
      inProduction -= 1;
      finished += 1;
    } else if (pending > 0) {
      pending -= 1;
      finished += 1;
    }
  }

  if (action === "undo" && finished > 0) {
    finished -= 1;
    pending += 1;
  }

  return {
    ...position,
    cantidadPendiente: pending,
    cantidadEnProduccion: inProduction,
    cantidadTerminada: finished,
    estado: getProductionPositionStatus(counts.total, pending, inProduction, finished)
  };
}

export function getProductionOrderProgress(positions: ProductionOrderPosition[]) {
  const totals = positions.reduce(
    (summary, position) => {
      const counts = getProductionPositionCounts(position);
      summary.total += counts.total;
      summary.pending += counts.pending;
      summary.inProduction += counts.inProduction;
      summary.finished += counts.finished;
      return summary;
    },
    { total: 0, pending: 0, inProduction: 0, finished: 0 }
  );

  return {
    ...totals,
    percentage: totals.total ? Math.round((totals.finished / totals.total) * 100) : 0
  };
}

export function getProductionOrderStatus(positions: ProductionOrderPosition[]): ProductionOrderStatus {
  const progress = getProductionOrderProgress(positions);
  if (positions.some((position) => getProductionMissingItems(position).length > 0)) return "bloqueada";
  if (progress.total > 0 && progress.finished === progress.total) return "terminada";
  if (progress.finished > 0) return "parcial";
  if (progress.inProduction > 0) return "en_produccion";
  return "recibida";
}

function getProductionPositionStatus(
  total: number,
  pending: number,
  inProduction: number,
  finished: number
): ProductionItemStatus {
  if (total > 0 && finished === total) return "completado";
  if (finished > 0) return "parcial";
  if (inProduction > 0 || pending < total) return "en_proceso";
  return "pendiente";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createMissingItemId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `faltante-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
