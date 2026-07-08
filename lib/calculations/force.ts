export type ForcePointInput = {
  id: string;
  nominalValue: number;
  appliedValue: number;
  cycle1: number;
  cycle2: number;
  cycle3: number;
};

export type ForcePointResult = ForcePointInput & {
  maxValue: number;
  minValue: number;
  averageValue: number;
  meanError: number;
  accuracyErrorPercent: number;
  repeatabilityErrorPercent: number;
};

function round(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateForcePoint(point: ForcePointInput): ForcePointResult {
  const values = [point.cycle1, point.cycle2, point.cycle3];

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const averageValue = values.reduce((sum, value) => sum + value, 0) / values.length;

  const meanError = point.appliedValue - averageValue;

  const accuracyErrorPercent =
    point.appliedValue !== 0
      ? ((point.appliedValue - averageValue) / point.appliedValue) * 100
      : 0;

  const repeatabilityErrorPercent =
    averageValue !== 0 ? ((maxValue - minValue) / averageValue) * 100 : 0;

  return {
    ...point,
    maxValue: round(maxValue),
    minValue: round(minValue),
    averageValue: round(averageValue),
    meanError: round(meanError),
    accuracyErrorPercent: round(accuracyErrorPercent),
    repeatabilityErrorPercent: round(repeatabilityErrorPercent),
  };
}

export function calculateForcePoints(points: ForcePointInput[]): ForcePointResult[] {
  return points.map(calculateForcePoint);
}