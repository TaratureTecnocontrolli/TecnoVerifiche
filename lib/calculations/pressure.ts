export type PressurePhase = "carico" | "scarico";

export type PressurePointInput = {
  id: string;
  phase: PressurePhase;
  verificationPoint: number;
  appliedValue: number;
  reading1: number;
  reading2: number;
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
    const readings = [point.reading1, point.reading2];

    const maxReading = Math.max(...readings);
    const minReading = Math.min(...readings);
    const averageReading =
      readings.reduce((sum, value) => sum + value, 0) / readings.length;

    const meanError = averageReading - point.appliedValue;

    const accuracyErrorPercent = safePercent(
      meanError,
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
