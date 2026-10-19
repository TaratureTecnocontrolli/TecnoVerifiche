export type MartinettoPointInput = {
  id: string;
  pressureBar: number;
  cycle1: number;
  cycle2: number;
  cycle3: number;
};

export type MartinettoCalculatedPoint = MartinettoPointInput & {
  maxValue: number;
  minValue: number;
  averageValue: number;
  conversionCoefficient: number | null;
  repeatabilityErrorPercent: number | null;
};

export function calculateMartinettoPoint(
  point: MartinettoPointInput
): MartinettoCalculatedPoint {
  const values = [point.cycle1, point.cycle2, point.cycle3];
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const averageValue = (point.cycle1 + point.cycle2 + point.cycle3) / 3;

  const conversionCoefficient =
    point.pressureBar !== 0 ? averageValue / point.pressureBar : null;

  const repeatabilityErrorPercent =
    averageValue !== 0 ? ((maxValue - minValue) / averageValue) * 100 : null;

  return {
    ...point,
    maxValue,
    minValue,
    averageValue,
    conversionCoefficient,
    repeatabilityErrorPercent,
  };
}

export function calculateMartinettoPoints(
  points: MartinettoPointInput[]
): MartinettoCalculatedPoint[] {
  return points.map(calculateMartinettoPoint);
}

export function calculateAverageConversionCoefficient(
  points: MartinettoCalculatedPoint[]
): number | null {
  const coefficients = points
    .map((point) => point.conversionCoefficient)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (coefficients.length === 0) {
    return null;
  }

  return coefficients.reduce((sum, value) => sum + value, 0) / coefficients.length;
}

export const MARTINETTO_FORMULAS = {
  average: "Media = (I ciclo + II ciclo + III ciclo) / 3",
  conversionCoefficient:
    "Coefficiente di conversione (kN/bar) = Media letture (kN) / Pressione (bar)",
  repeatability:
    "Errore di ripetibilità (%) = [(Lettura Max - Lettura Min) / Media letture] × 100",
  averageConversionCoefficient:
    "Coefficiente medio di conversione = media aritmetica dei coefficienti di conversione dei punti validi",
} as const;
