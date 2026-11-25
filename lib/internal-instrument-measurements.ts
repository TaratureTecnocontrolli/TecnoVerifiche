export type InternalInstrumentMeasurement = {
  id?: string | null;
  measurement_quantity: string;
  unit: string;
  measurement_range: string;
  resolution: string;
  notes: string;
  is_primary: boolean;
  sort_order: number;
};

export const INTERNAL_MEASUREMENT_QUANTITY_SUGGESTIONS = [
  "Forza",
  "Pressione",
  "Coppia",
  "Volume",
  "Portata",
  "Velocità di rotazione",
  "Temperatura",
  "Lunghezza",
  "Dimensionale",
  "Massa",
  "Indice di rimbalzo",
  "Pull-off",
];

export const INTERNAL_MEASUREMENT_UNIT_SUGGESTIONS = [
  "kN",
  "kN/bar",
  "N",
  "daN",
  "MN",
  "bar",
  "mbar",
  "Pa",
  "kPa",
  "MPa",
  "Nm",
  "Ncm",
  "l",
  "ml",
  "m³",
  "l/min",
  "l/h",
  "m³/h",
  "rpm",
  "giri/min",
  "°C",
  "mm",
  "cm",
  "m",
  "kg",
  "g",
  "indice di rimbalzo",
  "%",
];

export function emptyInternalMeasurement(order = 1): InternalInstrumentMeasurement {
  return {
    id: null,
    measurement_quantity: "",
    unit: "",
    measurement_range: "",
    resolution: "",
    notes: "",
    is_primary: order === 1,
    sort_order: order,
  };
}

export function normalizeInternalMeasurements(
  rows: InternalInstrumentMeasurement[]
): InternalInstrumentMeasurement[] {
  const cleaned = rows
    .filter((row) => row.measurement_quantity.trim())
    .map((row, index) => ({
      ...row,
      measurement_quantity: row.measurement_quantity.trim(),
      unit: row.unit.trim(),
      measurement_range: row.measurement_range.trim(),
      resolution: row.resolution.trim(),
      notes: row.notes.trim(),
      sort_order: index + 1,
    }));

  if (cleaned.length === 0) return [];

  const primaryIndex = cleaned.findIndex((row) => row.is_primary);
  return cleaned.map((row, index) => ({
    ...row,
    is_primary: index === (primaryIndex >= 0 ? primaryIndex : 0),
  }));
}

export function measurementRowsForRpc(rows: InternalInstrumentMeasurement[]) {
  return normalizeInternalMeasurements(rows).map((row) => ({
    measurement_quantity: row.measurement_quantity,
    unit: row.unit || null,
    measurement_range: row.measurement_range || null,
    resolution: row.resolution || null,
    notes: row.notes || null,
    is_primary: row.is_primary,
  }));
}
