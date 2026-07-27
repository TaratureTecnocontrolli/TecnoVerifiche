"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CalibrationScale = {
  id: string;
  scale_order: number | null;
  scale_name: string | null;
  scale_range: string | null;
  notes: string | null;
};

type CalibrationMeasurement = {
  id: string;
  calibration_record_id?: string | null;
  scale_id: string | null;
  section: string | null;
  point_order: number | null;
  nominal_value: number | null;
  applied_value: number | null;
  cycle_1: number | null;
  cycle_2: number | null;
  cycle_3: number | null;
  max_value: number | null;
  min_value: number | null;
  average_value: number | null;
  mean_error: number | null;
  accuracy_error_percent: number | null;
  repeatability_error_percent: number | null;
  result: string | null;
  notes: string | null;
};

type EditableMeasurement = {
  id: string;
  scale_id: string | null;
  section: string;
  point_order: string;
  nominal_value: string;
  applied_value: string;
  cycle_1: string;
  cycle_2: string;
  cycle_3: string;
  max_value: string;
  min_value: string;
  average_value: string;
  mean_error: string;
  accuracy_error_percent: string;
  repeatability_error_percent: string;
  result: string;
  notes: string;
};

type InternalMeasurementsEditFormProps = {
  recordId: string;
  scales: CalibrationScale[];
  measurements: CalibrationMeasurement[];
};

function numberToInput(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return String(value).replace(".", ",");
}

function textToNumber(value: string) {
  const cleanValue = value.trim().replace(",", ".");

  if (!cleanValue) {
    return null;
  }

  const parsed = Number(cleanValue);

  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableText(value: string) {
  const text = value.trim();

  return text || null;
}

function formatComputed(value: number | null, digits = 4) {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: digits,
  }).format(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateValues(row: EditableMeasurement) {
  const readings = [row.cycle_1, row.cycle_2, row.cycle_3]
    .map(textToNumber)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const nominalValue = textToNumber(row.nominal_value);
  const appliedValue = textToNumber(row.applied_value);
  const targetValue = appliedValue ?? nominalValue;

  const maxValue = readings.length > 0 ? Math.max(...readings) : null;
  const minValue = readings.length > 0 ? Math.min(...readings) : null;
  const averageValue = average(readings);
  const meanError =
    averageValue !== null && targetValue !== null ? averageValue - targetValue : null;

  const accuracyErrorPercent =
    meanError !== null && targetValue !== null && targetValue !== 0
      ? (meanError / targetValue) * 100
      : null;

  const repeatabilityErrorPercent =
    maxValue !== null &&
    minValue !== null &&
    averageValue !== null &&
    averageValue !== 0
      ? ((maxValue - minValue) / Math.abs(averageValue)) * 100
      : null;

  return {
    maxValue,
    minValue,
    averageValue,
    meanError,
    accuracyErrorPercent,
    repeatabilityErrorPercent,
  };
}

function toEditableMeasurement(measurement: CalibrationMeasurement): EditableMeasurement {
  return {
    id: measurement.id,
    scale_id: measurement.scale_id,
    section: measurement.section ?? "",
    point_order:
      measurement.point_order === null || measurement.point_order === undefined
        ? ""
        : String(measurement.point_order),
    nominal_value: numberToInput(measurement.nominal_value),
    applied_value: numberToInput(measurement.applied_value),
    cycle_1: numberToInput(measurement.cycle_1),
    cycle_2: numberToInput(measurement.cycle_2),
    cycle_3: numberToInput(measurement.cycle_3),
    max_value: numberToInput(measurement.max_value),
    min_value: numberToInput(measurement.min_value),
    average_value: numberToInput(measurement.average_value),
    mean_error: numberToInput(measurement.mean_error),
    accuracy_error_percent: numberToInput(measurement.accuracy_error_percent),
    repeatability_error_percent: numberToInput(measurement.repeatability_error_percent),
    result: measurement.result ?? "",
    notes: measurement.notes ?? "",
  };
}

export default function InternalMeasurementsEditForm({
  recordId,
  scales,
  measurements,
}: InternalMeasurementsEditFormProps) {
  const [rows, setRows] = useState<EditableMeasurement[]>(
    measurements.map(toEditableMeasurement)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const rowsByScaleId = useMemo(() => {
    const grouped = new Map<string, EditableMeasurement[]>();

    rows.forEach((row) => {
      const key = row.scale_id ?? "senza-scala";
      const currentRows = grouped.get(key) ?? [];
      currentRows.push(row);
      grouped.set(key, currentRows);
    });

    grouped.forEach((items) => {
      items.sort((a, b) => Number(a.point_order || 0) - Number(b.point_order || 0));
    });

    return grouped;
  }, [rows]);

  function updateRow(rowId: string, field: keyof EditableMeasurement, value: string) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextRow = {
          ...row,
          [field]: value,
        };

        if (
          field === "nominal_value" ||
          field === "applied_value" ||
          field === "cycle_1" ||
          field === "cycle_2" ||
          field === "cycle_3"
        ) {
          const computed = calculateValues(nextRow);

          return {
            ...nextRow,
            max_value: formatComputed(computed.maxValue),
            min_value: formatComputed(computed.minValue),
            average_value: formatComputed(computed.averageValue),
            mean_error: formatComputed(computed.meanError),
            accuracy_error_percent: formatComputed(computed.accuracyErrorPercent),
            repeatability_error_percent: formatComputed(
              computed.repeatabilityErrorPercent
            ),
          };
        }

        return nextRow;
      })
    );

    setMessage("");
    setErrorMessage("");
  }

  async function saveRows() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      for (const row of rows) {
        const { error } = await supabase
          .from("calibration_measurements")
          .update({
            point_order: textToNumber(row.point_order),
            nominal_value: textToNumber(row.nominal_value),
            applied_value: textToNumber(row.applied_value),
            cycle_1: textToNumber(row.cycle_1),
            cycle_2: textToNumber(row.cycle_2),
            cycle_3: textToNumber(row.cycle_3),
            max_value: textToNumber(row.max_value),
            min_value: textToNumber(row.min_value),
            average_value: textToNumber(row.average_value),
            mean_error: textToNumber(row.mean_error),
            accuracy_error_percent: textToNumber(row.accuracy_error_percent),
            repeatability_error_percent: textToNumber(row.repeatability_error_percent),
            result: toNullableText(row.result),
            notes: toNullableText(row.notes),
          })
          .eq("id", row.id)
          .eq("calibration_record_id", recordId);

        if (error) {
          throw new Error(error.message);
        }
      }

      setMessage("Misure VI aggiornate correttamente.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure VI."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="print-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            Modifica misure VI
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Qui puoi correggere le letture del rapportino interno. I valori
            calcolati si aggiornano quando modifichi letture o valore nominale.
          </p>
        </div>

        <button
          type="button"
          onClick={saveRows}
          disabled={isSaving || rows.length === 0}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Salvataggio..." : "Salva misure"}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {errorMessage}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nessuna misura trovata per questo rapportino VI.
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {scales.length > 0 ? (
            scales.map((scale) => {
              const scaleRows = rowsByScaleId.get(scale.id) ?? [];

              return (
                <div key={scale.id} className="rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-950">
                      {scale.scale_name || "Scala senza nome"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Fondo scala: {scale.scale_range || "-"} · Note:{" "}
                      {scale.notes || "-"}
                    </p>
                  </div>

                  <MeasurementsTable rows={scaleRows} onChange={updateRow} />
                </div>
              );
            })
          ) : (
            <MeasurementsTable rows={rows} onChange={updateRow} />
          )}
        </div>
      )}
    </section>
  );
}

function MeasurementsTable({
  rows,
  onChange,
}: {
  rows: EditableMeasurement[];
  onChange: (
    rowId: string,
    field: keyof EditableMeasurement,
    value: string
  ) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Nessuna misura associata a questa scala.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1250px] w-full border-collapse text-xs">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="border-b border-slate-200 px-2 py-2">Punto</th>
            <th className="border-b border-slate-200 px-2 py-2">Nominale</th>
            <th className="border-b border-slate-200 px-2 py-2">Applicato</th>
            <th className="border-b border-slate-200 px-2 py-2">Ciclo 1</th>
            <th className="border-b border-slate-200 px-2 py-2">Ciclo 2</th>
            <th className="border-b border-slate-200 px-2 py-2">Ciclo 3</th>
            <th className="border-b border-slate-200 px-2 py-2">Max</th>
            <th className="border-b border-slate-200 px-2 py-2">Min</th>
            <th className="border-b border-slate-200 px-2 py-2">Media</th>
            <th className="border-b border-slate-200 px-2 py-2">Errore</th>
            <th className="border-b border-slate-200 px-2 py-2">Errore %</th>
            <th className="border-b border-slate-200 px-2 py-2">Ripet. %</th>
            <th className="border-b border-slate-200 px-2 py-2">Esito</th>
            <th className="border-b border-slate-200 px-2 py-2">Note</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="odd:bg-white even:bg-slate-50">
              <EditableCell
                value={row.point_order}
                onChange={(value) => onChange(row.id, "point_order", value)}
                className="w-16"
              />
              <EditableCell
                value={row.nominal_value}
                onChange={(value) => onChange(row.id, "nominal_value", value)}
              />
              <EditableCell
                value={row.applied_value}
                onChange={(value) => onChange(row.id, "applied_value", value)}
              />
              <EditableCell
                value={row.cycle_1}
                onChange={(value) => onChange(row.id, "cycle_1", value)}
              />
              <EditableCell
                value={row.cycle_2}
                onChange={(value) => onChange(row.id, "cycle_2", value)}
              />
              <EditableCell
                value={row.cycle_3}
                onChange={(value) => onChange(row.id, "cycle_3", value)}
              />
              <EditableCell
                value={row.max_value}
                onChange={(value) => onChange(row.id, "max_value", value)}
                muted
              />
              <EditableCell
                value={row.min_value}
                onChange={(value) => onChange(row.id, "min_value", value)}
                muted
              />
              <EditableCell
                value={row.average_value}
                onChange={(value) => onChange(row.id, "average_value", value)}
                muted
              />
              <EditableCell
                value={row.mean_error}
                onChange={(value) => onChange(row.id, "mean_error", value)}
                muted
              />
              <EditableCell
                value={row.accuracy_error_percent}
                onChange={(value) =>
                  onChange(row.id, "accuracy_error_percent", value)
                }
                muted
              />
              <EditableCell
                value={row.repeatability_error_percent}
                onChange={(value) =>
                  onChange(row.id, "repeatability_error_percent", value)
                }
                muted
              />
              <td className="border-b border-slate-100 px-2 py-2">
                <select
                  value={row.result}
                  onChange={(event) =>
                    onChange(row.id, "result", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
                >
                  <option value="">-</option>
                  <option value="Conforme">Conforme</option>
                  <option value="Non conforme">Non conforme</option>
                  <option value="Da valutare">Da valutare</option>
                </select>
              </td>
              <td className="border-b border-slate-100 px-2 py-2">
                <input
                  value={row.notes}
                  onChange={(event) => onChange(row.id, "notes", event.target.value)}
                  className="w-full min-w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  muted = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td className="border-b border-slate-100 px-2 py-2">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          "w-full rounded-lg border px-2 py-1 " +
          (muted
            ? "border-slate-200 bg-slate-50 text-slate-600 "
            : "border-slate-300 bg-white text-slate-900 ") +
          className
        }
      />
    </td>
  );
}