"use client";

import {
  INTERNAL_MEASUREMENT_QUANTITY_SUGGESTIONS,
  INTERNAL_MEASUREMENT_UNIT_SUGGESTIONS,
  emptyInternalMeasurement,
  type InternalInstrumentMeasurement,
} from "@/lib/internal-instrument-measurements";

export default function InternalInstrumentMeasurementsEditor({
  measurements,
  onChange,
  disabled = false,
}: {
  measurements: InternalInstrumentMeasurement[];
  onChange: (rows: InternalInstrumentMeasurement[]) => void;
  disabled?: boolean;
}) {
  function updateRow(index: number, patch: Partial<InternalInstrumentMeasurement>) {
    onChange(
      measurements.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  }

  function setPrimary(index: number) {
    onChange(
      measurements.map((row, rowIndex) => ({
        ...row,
        is_primary: rowIndex === index,
      }))
    );
  }

  function addRow() {
    onChange([
      ...measurements,
      emptyInternalMeasurement(measurements.length + 1),
    ]);
  }

  function removeRow(index: number) {
    const next = measurements.filter((_, rowIndex) => rowIndex !== index);
    if (next.length > 0 && !next.some((row) => row.is_primary)) {
      next[0] = { ...next[0], is_primary: true };
    }
    onChange(next.map((row, rowIndex) => ({ ...row, sort_order: rowIndex + 1 })));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Grandezze e campi di misura
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Lo stesso strumento può gestire più grandezze. La grandezza principale
            mantiene la compatibilità con le verifiche esistenti.
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={addRow}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Aggiungi grandezza
          </button>
        )}
      </div>

      <datalist id="internal-measurement-quantities">
        {INTERNAL_MEASUREMENT_QUANTITY_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="internal-measurement-units">
        {INTERNAL_MEASUREMENT_UNIT_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <div className="mt-5 space-y-4">
        {measurements.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Inserisci almeno una grandezza misurata.
          </div>
        )}

        {measurements.map((row, index) => (
          <div
            key={row.id || `measurement-${index}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="primary-internal-measurement"
                    checked={row.is_primary}
                    onChange={() => setPrimary(index)}
                    disabled={disabled}
                  />
                  Grandezza principale
                </label>
              </div>

              {!disabled && measurements.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="rounded-lg px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Elimina
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Grandezza misurata *
                </span>
                <input
                  list="internal-measurement-quantities"
                  value={row.measurement_quantity}
                  onChange={(event) =>
                    updateRow(index, { measurement_quantity: event.target.value })
                  }
                  disabled={disabled}
                  placeholder="Es. Volume, Velocità di rotazione, Lunghezza"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Unità</span>
                <input
                  list="internal-measurement-units"
                  value={row.unit}
                  onChange={(event) => updateRow(index, { unit: event.target.value })}
                  disabled={disabled}
                  placeholder="Es. l, rpm, mm"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Campo / fondo scala
                </span>
                <input
                  value={row.measurement_range}
                  onChange={(event) =>
                    updateRow(index, { measurement_range: event.target.value })
                  }
                  disabled={disabled}
                  placeholder="Es. 0 - 60 l"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Risoluzione</span>
                <input
                  value={row.resolution}
                  onChange={(event) =>
                    updateRow(index, { resolution: event.target.value })
                  }
                  disabled={disabled}
                  placeholder="Es. 0,1 l"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>
            </div>

            <label className="mt-3 block space-y-1">
              <span className="text-sm font-medium text-slate-700">Note grandezza</span>
              <input
                value={row.notes}
                onChange={(event) => updateRow(index, { notes: event.target.value })}
                disabled={disabled}
                placeholder="Eventuali note specifiche per questa grandezza"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
