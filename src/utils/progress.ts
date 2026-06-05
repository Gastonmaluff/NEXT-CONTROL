import type { ProgressReport, WorkProgressRubric } from "../types";

export type WeightedProgressItem = {
  weight?: number;
  progress?: number;
  peso?: number;
  avance?: number;
  pesoOperativo?: number;
};

export function calculateWeightedProgress(items: WeightedProgressItem[]): number {
  if (!items.length) {
    return 0;
  }

  const normalized = items.map((item) => ({
    weight: clampProgress(item.pesoOperativo ?? item.peso ?? item.weight ?? 0),
    progress: clamp(item.avance ?? item.progress ?? 0)
  }));

  const totalWeight = normalized.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const weightedProgress = normalized.reduce(
    (sum, item) => sum + item.weight * item.progress,
    0
  );

  return clampProgress(Math.round(weightedProgress / 100));
}

export function calculateRubricProgress(rubro: WorkProgressRubric, reports: ProgressReport[]): number {
  const entries = getEntriesForRubric(rubro.id, reports);
  const latest = entries[entries.length - 1];

  if (!latest) {
    return 0;
  }

  if (rubro.modoCalculo === "manual") {
    return clampProgress(latest.porcentajeNuevo);
  }

  if (rubro.cantidadTotalPrevista <= 0) {
    return clampProgress(latest.porcentajeNuevo);
  }

  const total = latest.cantidadAcumuladaNueva ?? calculateTotalExecuted(rubro.id, reports);
  return clampProgress((total / rubro.cantidadTotalPrevista) * 100);
}

export function calculateTotalExecuted(rubroId: string, reports: ProgressReport[]): number {
  const entries = getEntriesForRubric(rubroId, reports);
  const latestWithAccumulated = [...entries].reverse().find((entry) =>
    typeof entry.cantidadAcumuladaNueva === "number"
  );

  if (latestWithAccumulated?.cantidadAcumuladaNueva !== undefined) {
    return latestWithAccumulated.cantidadAcumuladaNueva;
  }

  return entries.reduce((sum, entry) => sum + (entry.cantidadEjecutadaHoy ?? 0), 0);
}

export function calculateWeightedProgressFromReports(
  rubros: WorkProgressRubric[],
  reports: ProgressReport[]
): number {
  return calculateWeightedProgress(
    rubros.map((rubro) => ({
      pesoOperativo: rubro.pesoOperativo,
      progress: calculateRubricProgress(rubro, reports)
    }))
  );
}

export function validateRubricWeights(rubros: WorkProgressRubric[]): {
  totalWeight: number;
  isValid: boolean;
} {
  const totalWeight = rubros.reduce((sum, rubro) => sum + clampProgress(rubro.pesoOperativo), 0);
  return {
    totalWeight,
    isValid: totalWeight === 100
  };
}

export function getLatestRubricEntry(rubroId: string, reports: ProgressReport[]) {
  const entries = getEntriesForRubric(rubroId, reports);
  return entries[entries.length - 1] ?? null;
}

export function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clamp(value: number): number {
  return clampProgress(value);
}

function getEntriesForRubric(rubroId: string, reports: ProgressReport[]) {
  return reports
    .slice()
    .sort((a, b) => `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`))
    .flatMap((report) => report.entries)
    .filter((entry) => entry.rubroId === rubroId);
}
