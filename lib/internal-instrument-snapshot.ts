import type { SupabaseClient } from "@supabase/supabase-js";

export type InternalInstrumentMeasurementSnapshot = {
  id: string;
  measurement_quantity: string;
  unit: string | null;
  measurement_range: string | null;
  resolution: string | null;
  notes: string | null;
  is_primary: boolean;
  sort_order: number;
};

export async function attachInternalInstrumentMeasurements<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  snapshot: T,
  internalInstrumentId: string
): Promise<T & { measurements: InternalInstrumentMeasurementSnapshot[] }> {
  const { data, error } = await supabase
    .from("internal_instrument_measurements")
    .select(
      "id, measurement_quantity, unit, measurement_range, resolution, notes, is_primary, sort_order"
    )
    .eq("internal_instrument_id", internalInstrumentId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Errore caricamento grandezze strumento interno: " + error.message);
  }

  return {
    ...snapshot,
    measurements: ((data ?? []) as InternalInstrumentMeasurementSnapshot[]).map(
      (row) => ({ ...row })
    ),
  };
}

export function snapshotMeasurementSummary(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const value = (snapshot as Record<string, unknown>).measurements;
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      measurement_quantity:
        typeof item.measurement_quantity === "string" ? item.measurement_quantity : "",
      unit: typeof item.unit === "string" ? item.unit : null,
      measurement_range:
        typeof item.measurement_range === "string" ? item.measurement_range : null,
      resolution: typeof item.resolution === "string" ? item.resolution : null,
      is_primary: item.is_primary === true,
      sort_order: Number(item.sort_order) || 1,
    }))
    .filter((item) => item.measurement_quantity);
}
