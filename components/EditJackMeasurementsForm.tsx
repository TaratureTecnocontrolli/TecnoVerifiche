"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calculateAverageConversionCoefficient,
  calculateMartinettoPoint,
  type MartinettoCalculatedPoint,
} from "@/lib/martinetti-calculations";
import { supabase } from "@/lib/supabase";
import ReferenceInstrumentMultiSelect from "./ReferenceInstrumentMultiSelect";
import JackConversionChart from "./JackConversionChart";

type ReferenceInstrument = {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  certificate_number?: string | null;
  certificate_expiry?: string | null;
  status: string;
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

type EditablePoint = {
  id: string;
  measurementId: string | null;
  pressureBar: string;
  cycle1: string;
  cycle2: string;
  cycle3: string;
};

type EditableScale = {
  id: string;
  scaleId: string;
  scaleName: string;
  scaleRange: string;
  referenceInstrumentIds: string[];
  notes: string;
  points: EditablePoint[];
};

type EditJackMeasurementsFormProps = {
  recordId: string;
  recordNumber: string | null;
  reportStatus: string | null;
  initialVerificationDate?: string | null;
  isInternalVerification?: boolean;
  initialScales: InitialScale[];
  initialMeasurements: InitialMeasurement[];
  referenceInstruments: ReferenceInstrument[];
};

function toNumber(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberToInputValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
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

function formatItalianNumber(
  value: number | null | undefined,
  maximumFractionDigits = 4
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits,
  }).format(value);
}

function buildReferenceInstrumentSnapshot(instrument: ReferenceInstrument | undefined) {
  if (!instrument) return null;

  return {
    instrument_id: instrument.id,
    name: instrument.name,
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    serial_number: instrument.serial_number ?? null,
    internal_code: instrument.internal_code ?? null,
    measurement_quantity: instrument.measurement_quantity ?? null,
    unit: instrument.unit ?? null,
    measurement_range: instrument.measurement_range ?? null,
    certificate_number: instrument.certificate_number ?? null,
    certificate_expiry: instrument.certificate_expiry ?? null,
    status: instrument.status,
  };
}

function isReferenceInstrumentBlocked(instrument: ReferenceInstrument) {
  if (instrument.status === "out_of_service") return true;
  if (!instrument.certificate_expiry) return instrument.status === "expired";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(instrument.certificate_expiry);
  expiry.setHours(0, 0, 0, 0);

  return instrument.status === "expired" || expiry.getTime() < today.getTime();
}

function emptyPoint(): EditablePoint {
  return {
    id: crypto.randomUUID(),
    measurementId: null,
    pressureBar: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
  };
}

function buildEditableScales(
  scales: InitialScale[],
  measurements: InitialMeasurement[]
): EditableScale[] {
  return [...scales]
    .sort((a, b) => a.scale_order - b.scale_order)
    .map((scale) => {
      const scaleMeasurements = measurements
        .filter((measurement) => measurement.scale_id === scale.id)
        .sort((a, b) => a.point_order - b.point_order);

      const referenceInstrumentIds =
        scale.reference_instrument_ids && scale.reference_instrument_ids.length > 0
          ? scale.reference_instrument_ids
          : scale.reference_instrument_id
            ? [scale.reference_instrument_id]
            : [];

      return {
        id: scale.id,
        scaleId: scale.id,
        scaleName: scale.scale_name || "Martinetto",
        scaleRange: scale.scale_range || "",
        referenceInstrumentIds,
        notes: scale.notes || "",
        points:
          scaleMeasurements.length > 0
            ? scaleMeasurements.map((measurement) => ({
                id: measurement.id || crypto.randomUUID(),
                measurementId: measurement.id,
                pressureBar: numberToInputValue(
                  measurement.nominal_value ?? measurement.applied_value
                ),
                cycle1: numberToInputValue(measurement.cycle_1),
                cycle2: numberToInputValue(measurement.cycle_2),
                cycle3: numberToInputValue(measurement.cycle_3),
              }))
            : [emptyPoint()],
      };
    });
}

function isPointComplete(point: EditablePoint) {
  return (
    point.pressureBar.trim() !== "" &&
    point.cycle1.trim() !== "" &&
    point.cycle2.trim() !== "" &&
    point.cycle3.trim() !== ""
  );
}

function calculateEditablePoint(point: EditablePoint): MartinettoCalculatedPoint | null {
  if (!isPointComplete(point)) return null;

  return calculateMartinettoPoint({
    id: point.id,
    pressureBar: toNumber(point.pressureBar),
    cycle1: toNumber(point.cycle1),
    cycle2: toNumber(point.cycle2),
    cycle3: toNumber(point.cycle3),
  });
}

export default function EditJackMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  initialVerificationDate,
  isInternalVerification = false,
  initialScales,
  initialMeasurements,
  referenceInstruments,
}: EditJackMeasurementsFormProps) {
  const [verificationDate, setVerificationDate] = useState(
    initialVerificationDate || ""
  );

  const [scales, setScales] = useState<EditableScale[]>(() =>
    buildEditableScales(initialScales, initialMeasurements)
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

  const calculatedScales = useMemo(() => {
    return scales.map((scale) => {
      const calculatedPoints = scale.points.map(calculateEditablePoint);
      const validPoints = calculatedPoints.filter(
        (point): point is MartinettoCalculatedPoint => point !== null
      );

      return {
        ...scale,
        calculatedPoints,
        averageConversionCoefficient:
          calculateAverageConversionCoefficient(validPoints),
      };
    });
  }, [scales]);

  const selectedReferenceInstruments = useMemo(() => {
    const selectedIds = new Set(scales.flatMap((scale) => scale.referenceInstrumentIds));
    return referenceInstruments.filter((instrument) => selectedIds.has(instrument.id));
  }, [referenceInstruments, scales]);

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    isReferenceInstrumentBlocked
  );

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function updateScaleField(
    scaleId: string,
    field: "scaleName" | "scaleRange" | "notes",
    value: string
  ) {
    resetSaveState();
    setScales((current) =>
      current.map((scale) =>
        scale.id === scaleId ? { ...scale, [field]: value } : scale
      )
    );
  }

  function toggleReferenceInstrument(scaleId: string, instrumentId: string) {
    resetSaveState();
    setScales((current) =>
      current.map((scale) => {
        if (scale.id !== scaleId) return scale;

        const selected = scale.referenceInstrumentIds.includes(instrumentId);
        return {
          ...scale,
          referenceInstrumentIds: selected
            ? scale.referenceInstrumentIds.filter((id) => id !== instrumentId)
            : [...scale.referenceInstrumentIds, instrumentId],
        };
      })
    );
  }

  function updatePoint(
    scaleId: string,
    pointId: string,
    field: "pressureBar" | "cycle1" | "cycle2" | "cycle3",
    value: string
  ) {
    resetSaveState();
    const normalizedValue = normalizeEuropeanDecimalInput(value);

    setScales((current) =>
      current.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              points: scale.points.map((point) =>
                point.id === pointId
                  ? { ...point, [field]: normalizedValue }
                  : point
              ),
            }
          : scale
      )
    );
  }

  function addPoint(scaleId: string) {
    resetSaveState();
    setScales((current) =>
      current.map((scale) =>
        scale.id === scaleId
          ? { ...scale, points: [...scale.points, emptyPoint()] }
          : scale
      )
    );
  }

  function removePoint(scaleId: string, pointId: string) {
    resetSaveState();
    setScales((current) =>
      current.map((scale) =>
        scale.id === scaleId
          ? { ...scale, points: scale.points.filter((point) => point.id !== pointId) }
          : scale
      )
    );
  }

  function validate() {
    if (scales.length === 0) {
      throw new Error("Nessuna scala/campo di verifica disponibile.");
    }

    for (const scale of scales) {
      if (!scale.scaleName.trim()) {
        throw new Error("Inserisci il nome della scala/campo.");
      }

      if (scale.referenceInstrumentIds.length === 0) {
        throw new Error("Seleziona almeno uno strumento campione per " + scale.scaleName + ".");
      }

      if (scale.points.length === 0) {
        throw new Error("Inserisci almeno un punto per " + scale.scaleName + ".");
      }

      const incompletePoint = scale.points.find((point) => !isPointComplete(point));
      if (incompletePoint) {
        throw new Error(
          "Compila pressione e tutte le tre letture per ogni punto di " +
            scale.scaleName +
            "."
        );
      }

      const invalidPressure = scale.points.find(
        (point) => toNumber(point.pressureBar) === 0
      );
      if (invalidPressure) {
        throw new Error("La pressione deve essere diversa da zero per calcolare il coefficiente di conversione.");
      }
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error("Uno strumento campione selezionato è scaduto o fuori servizio.");
    }
  }

  async function saveMeasurements() {
    setSaveMessage("");
    setSaveError("");

    if (isReadOnly) {
      setSaveError(
        "Il rapporto è emesso: per modificare le misure devi prima riaprirlo per correzione."
      );
      return;
    }

    setIsSaving(true);

    try {
      if (isInternalVerification && !verificationDate) {
        throw new Error("Inserisci la data della verifica.");
      }

      validate();

      const nextScales = [...scales];

      for (let scaleIndex = 0; scaleIndex < nextScales.length; scaleIndex += 1) {
        const scale = nextScales[scaleIndex];
        const selectedReferences = referenceInstruments.filter((instrument) =>
          scale.referenceInstrumentIds.includes(instrument.id)
        );
        const primaryReference = selectedReferences[0];

        const { error: scaleError } = await supabase
          .from("calibration_record_scales")
          .update({
            scale_name: scale.scaleName.trim(),
            scale_range: scale.scaleRange.trim() || null,
            reference_instrument_id: primaryReference?.id ?? null,
            reference_instrument_snapshot: buildReferenceInstrumentSnapshot(primaryReference),
            reference_instrument_ids: selectedReferences.map((instrument) => instrument.id),
            reference_instruments_snapshot: selectedReferences.map(
              buildReferenceInstrumentSnapshot
            ),
            notes: scale.notes.trim() || null,
          })
          .eq("id", scale.scaleId);

        if (scaleError) throw new Error(scaleError.message);

        const keepIds = scale.points
          .map((point) => point.measurementId)
          .filter((id): id is string => Boolean(id));

        if (keepIds.length > 0) {
          const { error: deleteMissingError } = await supabase
            .from("calibration_measurements")
            .delete()
            .eq("calibration_record_id", recordId)
            .eq("scale_id", scale.scaleId)
            .not("id", "in", "(" + keepIds.join(",") + ")");

          if (deleteMissingError) throw new Error(deleteMissingError.message);
        } else {
          const { error: deleteAllError } = await supabase
            .from("calibration_measurements")
            .delete()
            .eq("calibration_record_id", recordId)
            .eq("scale_id", scale.scaleId);

          if (deleteAllError) throw new Error(deleteAllError.message);
        }

        const updatedPoints: EditablePoint[] = [];

        for (let pointIndex = 0; pointIndex < scale.points.length; pointIndex += 1) {
          const point = scale.points[pointIndex];
          const calculated = calculateMartinettoPoint({
            id: point.id,
            pressureBar: toNumber(point.pressureBar),
            cycle1: toNumber(point.cycle1),
            cycle2: toNumber(point.cycle2),
            cycle3: toNumber(point.cycle3),
          });

          const payload = {
            calibration_record_id: recordId,
            scale_id: scale.scaleId,
            section: scale.scaleName.trim(),
            point_order: pointIndex + 1,
            nominal_value: calculated.pressureBar,
            applied_value: calculated.pressureBar,
            cycle_1: calculated.cycle1,
            cycle_2: calculated.cycle2,
            cycle_3: calculated.cycle3,
            max_value: calculated.maxValue,
            min_value: calculated.minValue,
            average_value: calculated.averageValue,
            mean_error: null,
            accuracy_error_percent: null,
            repeatability_error_percent: calculated.repeatabilityErrorPercent,
            result: null,
            notes: null,
          };

          if (point.measurementId) {
            const { error: updateError } = await supabase
              .from("calibration_measurements")
              .update(payload)
              .eq("id", point.measurementId);

            if (updateError) throw new Error(updateError.message);
            updatedPoints.push(point);
          } else {
            const { data: inserted, error: insertError } = await supabase
              .from("calibration_measurements")
              .insert(payload)
              .select("id")
              .single();

            if (insertError || !inserted) {
              throw new Error(insertError?.message || "Errore durante l'inserimento del punto.");
            }

            updatedPoints.push({ ...point, measurementId: inserted.id });
          }
        }

        nextScales[scaleIndex] = { ...scale, points: updatedPoints };
      }

      setScales(nextScales);

      if (isInternalVerification) {
        const { error: verificationDateRecordError } = await supabase
          .from("calibration_records")
          .update({ verification_date: verificationDate })
          .eq("id", recordId);

        if (verificationDateRecordError) {
          throw new Error(verificationDateRecordError.message);
        }

        const { error: verificationDateDetailsError } = await supabase
          .from("calibration_report_details")
          .update({ test_date: verificationDate })
          .eq("calibration_record_id", recordId);

        if (verificationDateDetailsError) {
          throw new Error(verificationDateDetailsError.message);
        }
      }

      await supabase
        .from("calibration_records")
        .update({ report_status: "draft" })
        .eq("id", recordId)
        .neq("report_status", "issued");

      setSaveMessage("Misure martinetto aggiornate correttamente.");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure martinetto."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {isInternalVerification && (
        <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Data verifica interna</h2>
          <div className="mt-4 max-w-sm">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Data verifica *</span>
              <input
                type="date"
                value={verificationDate}
                disabled={isReadOnly}
                onChange={(event) => {
                  setVerificationDate(event.target.value);
                  resetSaveState();
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            La modifica aggiorna la data della verifica e la data prova riportata nel rapportino interno.
          </p>
        </div>
      )}

      {isReadOnly && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
          <p className="font-bold">Rapporto emesso: misure in sola lettura</p>
          <p className="mt-1">
            Per correggere i dati tecnici devi prima riaprire il rapporto per correzione.
          </p>
        </section>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Misure martinetto
            </h2>
            <p className="text-sm text-slate-500">
              Pressione in bar, letture in kN, coefficiente di conversione e ripetibilità.
            </p>
            {recordNumber && (
              <p className="mt-1 text-xs text-slate-500">Verifica {recordNumber}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={detailsHref}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {isInternalVerification ? "Rapportino interno" : "Dati rapporto"}
            </Link>
            <Link
              href={reportHref}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isInternalVerification ? "Anteprima rapportino" : "Rapporto finale"}
            </Link>
          </div>
        </div>
      </div>

      {calculatedScales.map((scale, scaleIndex) => {
        const validCalculatedPoints = scale.calculatedPoints.filter(
          (point): point is MartinettoCalculatedPoint => point !== null
        );

        return (
          <div
            key={scale.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 p-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Nome scala/campo</span>
                  <input
                    value={scale.scaleName}
                    disabled={isReadOnly}
                    onChange={(event) =>
                      updateScaleField(scale.id, "scaleName", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Fondo scala / campo</span>
                  <input
                    value={scale.scaleRange}
                    disabled={isReadOnly}
                    onChange={(event) =>
                      updateScaleField(scale.id, "scaleRange", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </label>

                <div className="md:col-span-2">
                  <ReferenceInstrumentMultiSelect
                    instruments={referenceInstruments}
                    selectedIds={scale.referenceInstrumentIds}
                    onToggle={(instrumentId) =>
                      !isReadOnly && toggleReferenceInstrument(scale.id, instrumentId)
                    }
                    label="Strumenti campione usati *"
                  />
                </div>
              </div>

              <label className="mt-4 block space-y-1">
                <span className="text-sm font-medium text-slate-700">Note scala</span>
                <input
                  value={scale.notes}
                  disabled={isReadOnly}
                  onChange={(event) =>
                    updateScaleField(scale.id, "notes", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Punto</th>
                    <th className="px-4 py-3">Pressione (bar)</th>
                    <th className="px-4 py-3">I ciclo (kN)</th>
                    <th className="px-4 py-3">II ciclo (kN)</th>
                    <th className="px-4 py-3">III ciclo (kN)</th>
                    <th className="px-4 py-3">Max (kN)</th>
                    <th className="px-4 py-3">Min (kN)</th>
                    <th className="px-4 py-3">Media (kN)</th>
                    <th className="px-4 py-3">Coeff. conversione (kN/bar)</th>
                    <th className="px-4 py-3">Ripetibilità %</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scale.points.map((point, pointIndex) => {
                    const calculated = scale.calculatedPoints[pointIndex];

                    return (
                      <tr key={point.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {pointIndex + 1}
                        </td>
                        {(["pressureBar", "cycle1", "cycle2", "cycle3"] as const).map(
                          (field) => (
                            <td key={field} className="px-4 py-3">
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={isReadOnly}
                                value={point[field]}
                                onChange={(event) =>
                                  updatePoint(
                                    scale.id,
                                    point.id,
                                    field,
                                    event.target.value
                                  )
                                }
                                className="w-28 rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                              />
                            </td>
                          )
                        )}
                        <td className="px-4 py-3">{formatItalianNumber(calculated?.maxValue)}</td>
                        <td className="px-4 py-3">{formatItalianNumber(calculated?.minValue)}</td>
                        <td className="px-4 py-3 font-semibold">{formatItalianNumber(calculated?.averageValue)}</td>
                        <td className="px-4 py-3 font-semibold">
                          {formatItalianNumber(calculated?.conversionCoefficient, 6)}
                        </td>
                        <td className="px-4 py-3">
                          {formatItalianNumber(calculated?.repeatabilityErrorPercent, 4)}
                        </td>
                        <td className="px-4 py-3">
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => removePoint(scale.id, point.id)}
                              className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Elimina
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="rounded-xl border border-slate-300 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Coefficiente medio di conversione
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {formatItalianNumber(scale.averageConversionCoefficient, 6)} kN/bar
                  </p>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => addPoint(scale.id)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Aggiungi punto
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                Andamento coefficiente di conversione - {scale.scaleName || `Scala ${scaleIndex + 1}`}
              </h3>
              <p className="mb-3 text-xs text-slate-500">
                Asse X: pressione in bar. Asse Y: coefficiente calcolato Media / Pressione in kN/bar.
                La linea tratteggiata indica il coefficiente medio.
              </p>
              <JackConversionChart
                points={validCalculatedPoints.map((point) => ({
                  pressureBar: point.pressureBar,
                  conversionCoefficient: point.conversionCoefficient,
                }))}
                averageCoefficient={scale.averageConversionCoefficient}
              />
            </div>
          </div>
        );
      })}

      {saveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {saveError}
        </div>
      )}

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          {saveMessage}
        </div>
      )}

      <div className="flex justify-end rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <button
          type="button"
          onClick={saveMeasurements}
          disabled={isReadOnly || isSaving || hasBlockedReferenceInstrument}
          className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Salvataggio..." : "Salva misure martinetto"}
        </button>
      </div>
    </div>
  );
}
