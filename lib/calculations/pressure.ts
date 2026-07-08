export type PressurePhase = "carico" | "scarico";

export type PressurePointInput = {
  id: string;
  phase: PressurePhase;
  verificationPoint: number;
  appliedValue: number;
  reading1: number;
  reading2: number;
  reading3: number;
};

export type PressurePointResult = PressurePointInput & {
  maxReading: number;
  minReading: number;
  averageReading: number;
  meanError: number;
  accuracyErrorPercent: number;
  repeatabilityErrorPercent: number;
};

function safePercent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

export function calculatePressurePoints(
  points: PressurePointInput[]
): PressurePointResult[] {
  return points.map((point) => {
    const maxReading = Math.max(point.reading1, point.reading2, point.reading3);
    const minReading = Math.min(point.reading1, point.reading2, point.reading3);
    const averageReading = (point.reading1 + point.reading2 + point.reading3) / 3;

    const meanError =
      ((point.appliedValue * 3) -
        (point.reading1 + point.reading2 + point.reading3)) /
      3;

    const accuracyErrorPercent = safePercent(
      point.appliedValue - averageReading,
      point.appliedValue
    );

    const repeatabilityErrorPercent = safePercent(
      maxReading - minReading,
      averageReading
    );

    return {
      ...point,
      maxReading,
      minReading,
      averageReading,
      meanError,
      accuracyErrorPercent,
      repeatabilityErrorPercent,
    };
  });
}