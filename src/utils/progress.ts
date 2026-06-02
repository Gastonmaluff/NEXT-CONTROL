export type WeightedProgressItem = {
  weight?: number;
  progress?: number;
  peso?: number;
  avance?: number;
};

export function calculateWeightedProgress(items: WeightedProgressItem[]): number {
  if (!items.length) {
    return 0;
  }

  const normalized = items.map((item) => ({
    weight: clamp(item.peso ?? item.weight ?? 0),
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

  return Math.round(weightedProgress / totalWeight);
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}
