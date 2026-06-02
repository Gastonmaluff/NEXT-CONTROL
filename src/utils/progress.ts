export type WeightedProgressItem = {
  weight: number;
  progress: number;
};

export function calculateWeightedProgress(items: WeightedProgressItem[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const weightedProgress = items.reduce(
    (sum, item) => sum + item.weight * item.progress,
    0
  );

  return Math.round(weightedProgress / totalWeight);
}
