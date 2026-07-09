export type MeasurementLike = {
  id: string;
  point_order: number;
  nominal_value: number | null;
  applied_value: number | null;
  accuracy_error_percent: number | null;
};

function getXValue(measurement: MeasurementLike) {
  return measurement.applied_value ?? measurement.nominal_value ?? null;
}

export function hasValidChartMeasurements(measurements: MeasurementLike[]) {
  return measurements.some(
    (measurement) =>
      getXValue(measurement) !== null && measurement.accuracy_error_percent !== null
  );
}
