import type { Obra, ProductionItemStatus, WorkBreakdownItem, WorkProgressRubric } from "../types";
import { normalizeUnit, type OperationalUnit } from "./units";

export type ProductionWorkRow = {
  id: string;
  obra: Obra;
  rubro: WorkProgressRubric;
  item?: WorkBreakdownItem;
  descripcion: string;
  cantidadTotal: number;
  cantidadProducida: number;
  cantidadPendiente: number;
  unidad: OperationalUnit;
  esDetalle: boolean;
  medida?: string;
  metrosCuadradosPorUnidad?: number;
  metrosCuadradosTotales?: number;
  metrosCuadradosProducidos?: number;
  metrosCuadradosPendientes?: number;
  estado: ProductionItemStatus;
  observacion?: string;
};

export function calculateM2Unitario(ancho?: number, alto?: number): number {
  const width = Number(ancho ?? 0);
  const height = Number(alto ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0;
  }
  return roundMeasure(width * height);
}

export function calculateM2Total(ancho?: number, alto?: number, cantidad?: number): number {
  const quantity = Number(cantidad ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }
  return roundMeasure(calculateM2Unitario(ancho, alto) * quantity);
}

export function calculateRubricQuantityFromItems(
  unidad: OperationalUnit,
  items: WorkBreakdownItem[]
): number {
  if (!items.length) return 0;
  if (unidad === "m2") {
    return roundMeasure(items.reduce((sum, item) => sum + (item.m2Total ?? calculateM2Total(item.ancho, item.alto, item.cantidad)), 0));
  }
  return roundMeasure(items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0));
}

export function normalizeProductionStatus(status?: string, produced = 0, total = 0): ProductionItemStatus {
  if (status === "completado" || status === "en_proceso" || status === "parcial" || status === "pendiente") {
    if (status === "completado" && produced < total) return produced > 0 ? "parcial" : "pendiente";
    return status;
  }
  if (total > 0 && produced >= total) return "completado";
  if (produced > 0) return "parcial";
  return "pendiente";
}

export function getProductionRows(obras: Obra[], rubrics: WorkProgressRubric[]): ProductionWorkRow[] {
  const worksById = new Map(obras.map((obra) => [obra.id, obra]));
  return rubrics.flatMap((rubro) => {
    const obra = worksById.get(rubro.obraId);
    if (!obra) return [];

    const itemRows: ProductionWorkRow[] = (rubro.items ?? [])
      .filter((item) => item.fabricarEnTaller)
      .map((item): ProductionWorkRow => {
        const unit = normalizeUnit(item.unidadProduccion ?? "unidad") || "unidad";
        const total = Number(item.cantidad || 0);
        const produced = Number(item.cantidadProducida ?? 0);
        const m2Unit = item.metrosCuadradosPorUnidad ?? item.m2Unitario ?? calculateM2Unitario(item.ancho, item.alto);
        const m2Total = item.metrosCuadradosTotales ?? item.m2Total ?? calculateM2Total(item.ancho, item.alto, item.cantidad);
        const pending = Math.max(total - produced, 0);
        return {
          id: `${rubro.id}:${item.id}`,
          obra,
          rubro,
          item,
          descripcion: item.descripcion || rubro.nombre,
          cantidadTotal: total,
          cantidadProducida: produced,
          cantidadPendiente: pending,
          unidad: unit,
          esDetalle: true,
          medida: item.ancho && item.alto ? `${item.ancho} x ${item.alto}` : undefined,
          metrosCuadradosPorUnidad: m2Unit,
          metrosCuadradosTotales: m2Total,
          metrosCuadradosProducidos: roundMeasure(produced * m2Unit),
          metrosCuadradosPendientes: roundMeasure(Math.max(m2Total - produced * m2Unit, 0)),
          estado: normalizeProductionStatus(item.estadoProduccion, produced, total),
          observacion: item.observacion
        };
      });

    if (itemRows.length) {
      return itemRows;
    }

    if (!rubro.requiereProduccion) {
      return [];
    }

    const unit = normalizeUnit(rubro.unidadPrincipal ?? rubro.unidad) || "unidad";
    const total = rubro.cantidadTotalPrevista;
    const produced = Number(rubro.cantidadProducida ?? 0);
    return [{
      id: `${rubro.id}:simple`,
      obra,
      rubro,
      descripcion: rubro.nombre,
      cantidadTotal: total,
      cantidadProducida: produced,
      cantidadPendiente: Math.max(total - produced, 0),
      unidad: unit,
      esDetalle: false,
      metrosCuadradosPorUnidad: unit === "m2" ? 1 : undefined,
      metrosCuadradosTotales: unit === "m2" ? total : undefined,
      metrosCuadradosProducidos: unit === "m2" ? produced : undefined,
      metrosCuadradosPendientes: unit === "m2" ? Math.max(total - produced, 0) : undefined,
      estado: normalizeProductionStatus(rubro.estadoProduccion, produced, total),
      observacion: rubro.observacionProduccion
    }];
  });
}

export function productionProgress(produced: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((produced / total) * 100)));
}

export function roundMeasure(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
