"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import ReferenceInstrumentMultiSelect from "@/components/ReferenceInstrumentMultiSelect";

type ReferenceInstrument = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  range?: string | null;
  certificate_number?: string | null;
  certificate_expiry?: string | null;
  certificate_file_url?: string | null;
  certificate_file_name?: string | null;
  status?: string | null;
};

type InitialScale = {
  id: string;
  calibration_record_id: string;
  scale_order: number;
  scale_name: string;
  scale_range: string | null;
  reference_instrument_id: string | null;
  reference_instrument_snapshot: Record<string, unknown> | null;
  reference_instrument_ids?: string[] | null;
  reference_instruments_snapshot?: Record<string, unknown>[] | null;
  notes: string | null;
};

type InitialMeasurement = {
  id: string;
  calibration_record_id: string;
  scale_id: string | null;
  point_order: number;
  section: string | null;
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

type EditableLogPoint = {
  id: string;
  measurementId: string | null;
  date: string;
  time: string;
  measuredTemp: string;
  referenceTemp: string;
  notes: string;
};

type EditTemperatureLogFormProps = {
  recordId: string;
  recordNumber: string | null;
  reportStatus: string | null;
  isInternalVerification?: boolean;
  initialScales: InitialScale[];
  initialMeasurements: InitialMeasurement[];
  referenceInstruments: ReferenceInstrument[];
};

const NOTES_TIMESTAMP_PATTERN = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\] ?([\s\S]*)$/;

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowInputTime() {
  const now = new Date();
  return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

function toNumber(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");

  if (
    normalized === "" ||
    normalized === "-" ||
    normalized === "," ||
    normalized === "." ||
    normalized === "-," ||
    normalized === "-."
  ) {
    return 0;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function normalizeEuropeanDecimalInput(value: string) {
  let normalized = value.replace(/\./g, ",");
  normalized = normalized.replace(/[^\d,-]/g, "");
  normalized = normalized.replace(/(?!^)-/g, "");

  const hasMinus = normalized.startsWith("-");
  const withoutMinus = normalized.replace(/-/g, "");
  const parts = withoutMinus.split(",");

  if (parts.length <= 1) {
    return hasMinus ? "-" + withoutMinus : withoutMinus;
  }

  const integerPart = parts[0];
  const decimalPart = parts.slice(1).join("");
  const result = integerPart + "," + decimalPart;

  return hasMinus ? "-" + result : result;
}

function numberToInputValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return String(value).replace(".", ",");
}

function formatItalianNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatItalianDate(date: string | null | undefined) {
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function daysToExpiry(date: string | null | undefined) {
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(date);
  expiry.setHours(0, 0, 0, 0);

  const differenceMs = expiry.getTime() - today.getTime();

  return Math.ceil(differenceMs / (1000 * 60 * 60 * 24));
}

function effectiveStatus(instrument: ReferenceInstrument) {
  const baseStatus = instrument.status || "valid";

  if (baseStatus === "out_of_service") {
    return "out_of_service";
  }

  const days = daysToExpiry(instrument.certificate_expiry);

  if (days === null) {
    return baseStatus;
  }

  if (days < 0) {
    return "expired";
  }

  if (days <= 30) {
    return "expiring";
  }

  return "valid";
}

function statusLabel(status: string) {
  if (status === "valid") return "Valido";
  if (status === "expiring") return "In scadenza";
  if (status === "expired") return "Scaduto";
  if (status === "out_of_service") return "Fuori servizio";

  return status;
}

function statusClass(status: string) {
  if (status === "valid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (status === "expiring") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (status === "expired") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  if (status === "out_of_service") {
    return "border-slate-300 bg-slate-100 text-slate-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function isReferenceInstrumentBlocked(status: string) {
  return status === "expired" || status === "out_of_service";
}

function getRange(instrument: {
  measurement_range?: string | null;
  range?: string | null;
}) {
  return instrument.measurement_range || instrument.range || null;
}

function buildReferenceInstrumentSnapshot(instrument: ReferenceInstrument) {
  return {
    instrument_id: instrument.id,
    name: instrument.name ?? null,
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    serial_number: instrument.serial_number ?? null,
    internal_code: instrument.internal_code ?? null,
    measurement_quantity: instrument.measurement_quantity ?? null,
    unit: instrument.unit ?? null,
    measurement_range: getRange(instrument),
    certificate_number: instrument.certificate_number ?? null,
    certificate_expiry: instrument.certificate_expiry ?? null,
    certificate_file_url: instrument.certificate_file_url ?? null,
    certificate_file_name: instrument.certificate_file_name ?? null,
    status: effectiveStatus(instrument),
  };
}

function splitNotes(notes: string | null): { date: string; time: string; notes: string } {
  if (!notes) {
    return { date: "", time: "", notes: "" };
  }

  const match = notes.match(NOTES_TIMESTAMP_PATTERN);

  if (!match) {
    return { date: "", time: "", notes };
  }

  return { date: match[1], time: match[2], notes: match[3] || "" };
}

function joinNotes(date: string, time: string, notes: string): string | null {
  const trimmedNotes = notes.trim();

  if (date && time) {
    return "[" + date + " " + time + "] " + trimmedNotes;
  }

  return trimmedNotes || null;
}

function emptyLogPoint(): EditableLogPoint {
  return {
    id: crypto.randomUUID(),
    measurementId: null,
    date: todayInputDate(),
    time: nowInputTime(),
    measuredTemp: "",
    referenceTemp: "",
    notes: "",
  };
}

function buildLogPoints(
  scales: InitialScale[],
  measurements: InitialMeasurement[]
): EditableLogPoint[] {
  const scale = [...scales].sort((a, b) => a.scale_order - b.scale_order)[0];

  const scaleMeasurements = scale
    ? measurements
        .filter((measurement) => measurement.scale_id === scale.id)
        .sort((a, b) => a.point_order - b.point_order)
    : [];

  if (scaleMeasurements.length === 0) {
    return [emptyLogPoint()];
  }

  return scaleMeasurements.map((measurement) => {
    const parsedNotes = splitNotes(measurement.notes);

    return {
      id: measurement.id || crypto.randomUUID(),
      measurementId: measurement.id,
      date: parsedNotes.date,
      time: parsedNotes.time,
      measuredTemp: numberToInputValue(measurement.cycle_1),
      referenceTemp: numberToInputValue(measurement.cycle_2),
      notes: parsedNotes.notes,
    };
  });
}

export default function EditTemperatureLogForm({
  recordId,
  recordNumber,
  reportStatus,
  isInternalVerification = false,
  initialScales,
  initialMeasurements,
  referenceInstruments,
}: EditTemperatureLogFormProps) {
  const [scaleId] = useState(() => initialScales[0]?.id || "");
  const [referenceInstrumentIds, setReferenceInstrumentIds] = useState<string[]>(
    () => {
      const firstScale = initialScales[0];
      if (
        firstScale?.reference_instrument_ids &&
        firstScale.reference_instrument_ids.length > 0
      ) {
        return firstScale.reference_instrument_ids;
      }
      return firstScale?.reference_instrument_id
        ? [firstScale.reference_instrument_id]
        : [];
    }
  );
  const [scaleNotes, setScaleNotes] = useState(() => initialScales[0]?.notes || "");
  const [points, setPoints] = useState<EditableLogPoint[]>(() =>
    buildLogPoints(initialScales, initialMeasurements)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const isReadOnly = reportStatus === "issued";
  const detailsHref = isInternalVerification
    ? "/verifiche/" + recordId + "/rapportino-interno"
    : "/verifiche/" + recordId + "/rapporto";

  const reportHref = isInternalVerification
    ? "/verifiche/" + recordId + "/rapportino-interno"
    : "/verifiche/" + recordId + "/rapporto/finale";


  const selectedReferenceInstruments = referenceInstruments.filter((instrument) =>
    referenceInstrumentIds.includes(instrument.id)
  );

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    (instrument) => isReferenceInstrumentBlocked(effectiveStatus(instrument))
  );

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function toggleReferenceInstrument(instrumentId: string) {
    resetSaveState();
    setReferenceInstrumentIds((current) =>
      current.includes(instrumentId)
        ? current.filter((id) => id !== instrumentId)
        : [...current, instrumentId]
    );
  }

  function updatePoint(
    pointId: string,
    field: keyof Omit<EditableLogPoint, "id" | "measurementId">,
    value: string
  ) {
    const normalizedValue =
      field === "measuredTemp" || field === "referenceTemp"
        ? normalizeEuropeanDecimalInput(value)
        : value;

    resetSaveState();

    setPoints((current) =>
      current.map((point) =>
        point.id === pointId ? { ...point, [field]: normalizedValue } : point
      )
    );
  }

  function addPoint() {
    resetSaveState();
    setPoints((current) => [...current, emptyLogPoint()]);
  }

  function removePoint(pointId: string) {
    resetSaveState();
    setPoints((current) => current.filter((point) => point.id !== pointId));
  }

  function validate() {
    if (selectedReferenceInstruments.length === 0) {
      throw new Error("Seleziona almeno un termometro/termostato di riferimento usato.");
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error(
        "Uno degli strumenti di riferimento usati è scaduto o fuori servizio."
      );
    }

    if (points.length === 0) {
      throw new Error("Inserisci almeno una rilevazione.");
    }

    const invalidPoint = points.find((point) => {
      return (
        !point.date ||
        !point.time ||
        point.measuredTemp.trim() === "" ||
        point.referenceTemp.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error(
        "Compila data, orario, temperatura misurata e temperatura di riferimento per tutte le righe."
      );
    }
  }

  async function ensureScaleExists() {
    if (scaleId) {
      return scaleId;
    }

    const referenceSnapshots = selectedReferenceInstruments.map(
      buildReferenceInstrumentSnapshot
    );
    const primaryReference = selectedReferenceInstruments[0];

    const { data: insertedScale, error: insertScaleError } = await supabase
      .from("calibration_record_scales")
      .insert({
        calibration_record_id: recordId,
        scale_order: 1,
        scale_name: "Temperatura",
        scale_range: null,
        reference_instrument_id: primaryReference.id,
        reference_instrument_snapshot: referenceSnapshots[0],
        reference_instrument_ids: selectedReferenceInstruments.map(
          (instrument) => instrument.id
        ),
        reference_instruments_snapshot: referenceSnapshots,
        notes: scaleNotes.trim() || null,
      })
      .select("id")
      .single();

    if (insertScaleError || !insertedScale) {
      throw new Error(
        insertScaleError?.message || "Errore durante la creazione della scala."
      );
    }

    return insertedScale.id as string;
  }

  async function saveMeasurements() {
    setSaveMessage("");
    setSaveError("");

    if (isReadOnly) {
      setSaveError(
        "Il rapporto è emesso: per modificare le misure devi prima riaprirlo per correzione dall’anteprima finale."
      );
      return;
    }

    setIsSaving(true);

    try {
      validate();

      const resolvedScaleId = await ensureScaleExists();

      const referenceSnapshots = selectedReferenceInstruments.map(
        buildReferenceInstrumentSnapshot
      );
      const primaryReference = selectedReferenceInstruments[0];

      const { error: scaleError } = await supabase
        .from("calibration_record_scales")
        .update({
          reference_instrument_id: primaryReference.id,
          reference_instrument_snapshot: referenceSnapshots[0],
          reference_instrument_ids: selectedReferenceInstruments.map(
            (instrument) => instrument.id
          ),
          reference_instruments_snapshot: referenceSnapshots,
          notes: scaleNotes.trim() || null,
        })
        .eq("id", resolvedScaleId);

      if (scaleError) {
        throw new Error(scaleError.message);
      }

      const keepMeasurementIds = points
        .map((point) => point.measurementId)
        .filter((id): id is string => Boolean(id));

      if (keepMeasurementIds.length > 0) {
        const { error: deleteMissingError } = await supabase
          .from("calibration_measurements")
          .delete()
          .eq("calibration_record_id", recordId)
          .eq("scale_id", resolvedScaleId)
          .not("id", "in", "(" + keepMeasurementIds.join(",") + ")");

        if (deleteMissingError) {
          throw new Error(deleteMissingError.message);
        }
      } else {
        const { error: deleteAllError } = await supabase
          .from("calibration_measurements")
          .delete()
          .eq("calibration_record_id", recordId)
          .eq("scale_id", resolvedScaleId);

        if (deleteAllError) {
          throw new Error(deleteAllError.message);
        }
      }

      const sortedPoints = [...points].sort((a, b) => {
        const aKey = a.date + " " + a.time;
        const bKey = b.date + " " + b.time;
        return aKey.localeCompare(bKey);
      });

      const updatedPoints: EditableLogPoint[] = [];

      for (let pointIndex = 0; pointIndex < sortedPoints.length; pointIndex += 1) {
        const point = sortedPoints[pointIndex];
        const measuredTemp = toNumber(point.measuredTemp);
        const referenceTemp = toNumber(point.referenceTemp);

        const payload = {
          calibration_record_id: recordId,
          scale_id: resolvedScaleId,
          section: "Temperatura",
          point_order: pointIndex + 1,
          nominal_value: null,
          applied_value: null,
          cycle_1: measuredTemp,
          cycle_2: referenceTemp,
          cycle_3: null,
          max_value: null,
          min_value: null,
          average_value: null,
          mean_error: measuredTemp - referenceTemp,
          accuracy_error_percent: null,
          repeatability_error_percent: null,
          result: null,
          notes: joinNotes(point.date, point.time, point.notes),
        };

        if (point.measurementId) {
          const { error: updateError } = await supabase
            .from("calibration_measurements")
            .update(payload)
            .eq("id", point.measurementId);

          if (updateError) {
            throw new Error(updateError.message);
          }

          updatedPoints.push(point);
        } else {
          const { data: insertedMeasurement, error: insertError } = await supabase
            .from("calibration_measurements")
            .insert(payload)
            .select("id")
            .single();

          if (insertError || !insertedMeasurement) {
            throw new Error(
              insertError?.message || "Errore durante l’inserimento della rilevazione."
            );
          }

          updatedPoints.push({ ...point, measurementId: insertedMeasurement.id });
        }
      }

      setPoints(updatedPoints);

      await supabase
        .from("calibration_records")
        .update({ report_status: "draft" })
        .eq("id", recordId)
        .neq("report_status", "issued");

      setSaveMessage("Log temperatura aggiornato correttamente.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio del log temperatura.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
          <p className="font-bold">Rapporto emesso: misure in sola lettura</p>
          <p className="mt-1">
            Per correggere i dati tecnici devi prima riaprire il rapporto dalla
            pagina di anteprima finale.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Dati tecnici temperatura
            </h2>
            <p className="text-sm text-slate-500">
              Verifica interna: {recordNumber || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={detailsHref}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {isInternalVerification ? "Rapportino" : "Dati rapporto"}
            </Link>

            <Link
              href={reportHref}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isInternalVerification ? "Rapportino" : "Rapporto"}
            </Link>
          </div>
        </div>
      </section>

      <fieldset disabled={isReadOnly} className="space-y-6 disabled:opacity-70">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Termometro / termostato di riferimento
            </h2>

            <div className="mt-5">
              <ReferenceInstrumentMultiSelect
                instruments={referenceInstruments}
                selectedIds={referenceInstrumentIds}
                onToggle={toggleReferenceInstrument}
                label="Strumenti di riferimento usati *"
              />
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Note (comuni al log)
              </span>
              <input
                value={scaleNotes}
                onChange={(event) => {
                  resetSaveState();
                  setScaleNotes(event.target.value);
                }}
                placeholder="Eventuali note"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            {selectedReferenceInstruments.length > 0 && (
              <div className="mt-5 space-y-3">
                {selectedReferenceInstruments.map((instrument) => {
                  const status = effectiveStatus(instrument);
                  const blocked = isReferenceInstrumentBlocked(status);

                  return (
                    <div
                      key={instrument.id}
                      className={"rounded-xl border p-4 text-sm " + statusClass(status)}
                    >
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
                        <div>
                          <p className="font-semibold">Strumento</p>
                          <p>{instrument.name || "-"}</p>
                        </div>

                        <div>
                          <p className="font-semibold">Stato</p>
                          <p>{statusLabel(status)}</p>
                        </div>

                        <div>
                          <p className="font-semibold">Certificato</p>
                          <p>{instrument.certificate_number ?? "-"}</p>
                        </div>

                        <div>
                          <p className="font-semibold">Scadenza</p>
                          <p>{formatItalianDate(instrument.certificate_expiry)}</p>
                        </div>

                        <div>
                          <p className="font-semibold">Campo</p>
                          <p>{getRange(instrument) ?? "-"}</p>
                        </div>

                        <div>
                          <p className="font-semibold">File</p>
                          {instrument.certificate_file_url ? (
                            <a
                              href={instrument.certificate_file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold hover:underline"
                            >
                              Apri certificato
                            </a>
                          ) : (
                            <p>-</p>
                          )}
                        </div>
                      </div>

                      {blocked && (
                        <p className="mt-3 font-medium">
                          Blocco: questo strumento di riferimento è scaduto o
                          fuori servizio.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Orario</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">
                    Temperatura misurata (°C)
                  </th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">
                    Temperatura riferimento (°C)
                  </th>
                  <th className="px-4 py-3">Scostamento (°C)</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {points.map((point) => {
                  const deviation =
                    point.measuredTemp.trim() !== "" && point.referenceTemp.trim() !== ""
                      ? toNumber(point.measuredTemp) - toNumber(point.referenceTemp)
                      : null;

                  return (
                    <tr key={point.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={point.date}
                          onChange={(event) =>
                            updatePoint(point.id, "date", event.target.value)
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          type="time"
                          value={point.time}
                          onChange={(event) =>
                            updatePoint(point.id, "time", event.target.value)
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </td>

                      <td className="bg-amber-50 px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={point.measuredTemp}
                          onChange={(event) =>
                            updatePoint(point.id, "measuredTemp", event.target.value)
                          }
                          className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                      </td>

                      <td className="bg-amber-50 px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={point.referenceTemp}
                          onChange={(event) =>
                            updatePoint(point.id, "referenceTemp", event.target.value)
                          }
                          className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                      </td>

                      <td className="px-4 py-3">{formatItalianNumber(deviation)}</td>

                      <td className="px-4 py-3">
                        <input
                          value={point.notes}
                          onChange={(event) =>
                            updatePoint(point.id, "notes", event.target.value)
                          }
                          placeholder="Note"
                          className="w-full min-w-[140px] rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removePoint(point.id)}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 p-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addPoint}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Aggiungi rilevazione
              </button>
            </div>
          </div>
        </section>
      </fieldset>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salva log temperatura
          </h2>
          <p className="text-sm text-slate-500">
            Nessun calcolo di errore o esito: i dati vengono registrati così
            come rilevati.
          </p>
        </div>

        <button
          type="button"
          onClick={saveMeasurements}
          disabled={isSaving || isReadOnly || hasBlockedReferenceInstrument}
          className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isReadOnly
            ? "Misure in sola lettura"
            : isSaving
              ? "Salvataggio..."
              : "Salva log"}
        </button>
      </section>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          {saveMessage}
        </div>
      )}

      {saveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {saveError}
        </div>
      )}
    </div>
  );
}
