"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ReferenceInstrumentMultiSelect from "@/components/ReferenceInstrumentMultiSelect";
import MeasurementErrorChart from "@/components/MeasurementErrorChart";

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

type EditableSclerometricPoint = {
  id: string;
  measurementId: string | null;
  reading1: string;
  reading2: string;
  reading3: string;
  notes: string;
};

type EditableScale = {
  id: string;
  scaleId: string;
  scaleName: string;
  scaleRange: string;
  referenceInstrumentIds: string[];
  notes: string;
  nominalValue: string;
  tolerancePercent: string;
  points: EditableSclerometricPoint[];
};

type CalculatedSclerometricPoint = {
  id: string;
  reading1: number;
  reading2: number;
  reading3: number;
  average: number;
  min: number;
  max: number;
  error: number;
  errorPercent: number;
  result: string | null;
};

type EditSclerometricMeasurementsFormProps = {
  recordId: string;
  recordNumber: string | null;
  reportStatus: string | null;
  isInternalVerification?: boolean;
  initialScales: InitialScale[];
  initialMeasurements: InitialMeasurement[];
  referenceInstruments: ReferenceInstrument[];
};

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

function nullableNumberFromInput(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return toNumber(trimmed);
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

function formatItalianNumber(value: number | null | undefined, digits = 3) {
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

function buildEditableScale(
  scales: InitialScale[],
  measurements: InitialMeasurement[]
): EditableScale {
  const sortedScales = [...scales].sort((a, b) => a.scale_order - b.scale_order);
  const firstScale = sortedScales[0];

  const scaleMeasurements = firstScale
    ? measurements
        .filter((measurement) => measurement.scale_id === firstScale.id)
        .sort((a, b) => a.point_order - b.point_order)
    : [...measurements].sort((a, b) => a.point_order - b.point_order);

  const referenceInstrumentIds =
    firstScale?.reference_instrument_ids && firstScale.reference_instrument_ids.length > 0
      ? firstScale.reference_instrument_ids
      : firstScale?.reference_instrument_id
        ? [firstScale.reference_instrument_id]
        : [];

  return {
    id: firstScale?.id || "sclerometric-scale",
    scaleId: firstScale?.id || "",
    scaleName: firstScale?.scale_name || "Prova sclerometrica",
    scaleRange: firstScale?.scale_range || "",
    referenceInstrumentIds,
    notes: firstScale?.notes || "",
    nominalValue: numberToInputValue(
      scaleMeasurements[0]?.nominal_value ?? 80
    ),
    tolerancePercent: "",
    points:
      scaleMeasurements.length > 0
        ? scaleMeasurements.map((measurement) => ({
            id: measurement.id || crypto.randomUUID(),
            measurementId: measurement.id,
            reading1: numberToInputValue(measurement.cycle_1),
            reading2: numberToInputValue(measurement.cycle_2),
            reading3: numberToInputValue(measurement.cycle_3),
            notes: measurement.notes || "",
          }))
        : Array.from({ length: 10 }, () => ({
            id: crypto.randomUUID(),
            measurementId: null,
            reading1: "",
            reading2: "",
            reading3: "",
            notes: "",
          })),
  };
}

function buildFinalResult(points: CalculatedSclerometricPoint[]) {
  const results = points
    .map((point) => point.result)
    .filter((result): result is string => Boolean(result));

  if (results.length === 0) {
    return "DA VALUTARE";
  }

  if (results.some((result) => result === "NON CONFORME")) {
    return "NON CONFORME";
  }

  if (results.length === points.length && results.every((result) => result === "CONFORME")) {
    return "CONFORME";
  }

  return "DA VALUTARE";
}

function calculateSclerometricPoint(
  point: EditableSclerometricPoint,
  nominalValue: number,
  tolerancePercent: number | null
): CalculatedSclerometricPoint {
  const reading1 = toNumber(point.reading1);
  const reading2 = toNumber(point.reading2);
  const reading3 = toNumber(point.reading3);
  const values = [reading1, reading2, reading3];

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Formula da modello Excel PS - Prove sclerometriche:
  // Errore medio = media letture - valore nominale incudine
  // Errore % = errore medio / valore nominale incudine * 100
  const error = average - nominalValue;
  const errorPercent = nominalValue !== 0 ? (error / nominalValue) * 100 : 0;

  let result: string | null = null;

  if (tolerancePercent !== null) {
    result = Math.abs(errorPercent) <= tolerancePercent ? "CONFORME" : "NON CONFORME";
  }

  return {
    id: point.id,
    reading1,
    reading2,
    reading3,
    average,
    min,
    max,
    error,
    errorPercent,
    result,
  };
}

export default function EditSclerometricMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  isInternalVerification = false,
  initialScales,
  initialMeasurements,
  referenceInstruments,
}: EditSclerometricMeasurementsFormProps) {
  const [scale, setScale] = useState<EditableScale>(() =>
    buildEditableScale(initialScales, initialMeasurements)
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


  const nominalValueNumber = toNumber(scale.nominalValue);
  const tolerancePercentNumber = nullableNumberFromInput(scale.tolerancePercent);

  const calculatedPoints = useMemo(() => {
    return scale.points.map((point) =>
      calculateSclerometricPoint(point, nominalValueNumber, tolerancePercentNumber)
    );
  }, [scale.points, nominalValueNumber, tolerancePercentNumber]);

  const overallAverage = useMemo(() => {
    if (calculatedPoints.length === 0) {
      return null;
    }

    const sum = calculatedPoints.reduce((total, point) => total + point.average, 0);
    return sum / calculatedPoints.length;
  }, [calculatedPoints]);

  const overallError =
    overallAverage !== null ? overallAverage - nominalValueNumber : null;
  const overallErrorPercent =
    overallError !== null && nominalValueNumber !== 0
      ? (overallError / nominalValueNumber) * 100
      : null;

  const selectedReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) =>
      scale.referenceInstrumentIds.includes(instrument.id)
    );
  }, [referenceInstruments, scale.referenceInstrumentIds]);

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    (instrument) => isReferenceInstrumentBlocked(effectiveStatus(instrument))
  );

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function updateScaleField(
    field: keyof Omit<EditableScale, "id" | "scaleId" | "points" | "referenceInstrumentIds">,
    value: string
  ) {
    resetSaveState();
    setScale((currentScale) => ({
      ...currentScale,
      [field]: value,
    }));
  }

  function toggleReferenceInstrument(instrumentId: string) {
    resetSaveState();
    setScale((currentScale) => ({
      ...currentScale,
      referenceInstrumentIds: currentScale.referenceInstrumentIds.includes(instrumentId)
        ? currentScale.referenceInstrumentIds.filter((id) => id !== instrumentId)
        : [...currentScale.referenceInstrumentIds, instrumentId],
    }));
  }

  function updateScaleNumericField(
    field: "nominalValue" | "tolerancePercent",
    value: string
  ) {
    resetSaveState();
    setScale((currentScale) => ({
      ...currentScale,
      [field]: normalizeEuropeanDecimalInput(value),
    }));
  }

  function updatePoint(
    pointId: string,
    field: keyof Omit<EditableSclerometricPoint, "id" | "measurementId">,
    value: string
  ) {
    const normalizedValue =
      field === "notes" ? value : normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setScale((currentScale) => ({
      ...currentScale,
      points: currentScale.points.map((point) =>
        point.id === pointId ? { ...point, [field]: normalizedValue } : point
      ),
    }));
  }

  function addPoint() {
    resetSaveState();

    setScale((currentScale) => ({
      ...currentScale,
      points: [
        ...currentScale.points,
        {
          id: crypto.randomUUID(),
          measurementId: null,
          reading1: "",
          reading2: "",
          reading3: "",
          notes: "",
        },
      ],
    }));
  }

  function removePoint(pointId: string) {
    resetSaveState();

    setScale((currentScale) => ({
      ...currentScale,
      points: currentScale.points.filter((point) => point.id !== pointId),
    }));
  }

  function validate() {
    if (!scale.scaleName.trim()) {
      throw new Error("Inserisci il nome della prova.");
    }

    if (selectedReferenceInstruments.length === 0) {
      throw new Error("Seleziona almeno un'incudine di riferimento usata.");
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error(
        "Una delle incudini di riferimento usate è scaduta o fuori servizio."
      );
    }

    if (!scale.nominalValue.trim()) {
      throw new Error("Inserisci il valore nominale dell'incudine di riferimento.");
    }

    if (scale.points.length === 0) {
      throw new Error("Inserisci almeno una battuta.");
    }

    const invalidPoint = scale.points.find((point) => {
      return (
        point.reading1.trim() === "" ||
        point.reading2.trim() === "" ||
        point.reading3.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error("Compila le tre letture per tutte le battute.");
    }
  }

  async function ensureScaleExists() {
    if (scale.scaleId) {
      return scale.scaleId;
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
        scale_name: scale.scaleName.trim(),
        scale_range: scale.scaleRange.trim() || null,
        reference_instrument_id: primaryReference.id,
        reference_instrument_snapshot: referenceSnapshots[0],
        reference_instrument_ids: selectedReferenceInstruments.map(
          (instrument) => instrument.id
        ),
        reference_instruments_snapshot: referenceSnapshots,
        notes: scale.notes.trim() || null,
      })
      .select("id")
      .single();

    if (insertScaleError || !insertedScale) {
      throw new Error(
        insertScaleError?.message || "Errore durante la creazione della prova."
      );
    }

    setScale((currentScale) => ({
      ...currentScale,
      scaleId: insertedScale.id,
    }));

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

      const scaleId = await ensureScaleExists();

      const referenceSnapshots = selectedReferenceInstruments.map(
        buildReferenceInstrumentSnapshot
      );
      const primaryReference = selectedReferenceInstruments[0];

      const { error: scaleError } = await supabase
        .from("calibration_record_scales")
        .update({
          scale_order: 1,
          scale_name: scale.scaleName.trim(),
          scale_range: scale.scaleRange.trim() || null,
          reference_instrument_id: primaryReference.id,
          reference_instrument_snapshot: referenceSnapshots[0],
          reference_instrument_ids: selectedReferenceInstruments.map(
            (instrument) => instrument.id
          ),
          reference_instruments_snapshot: referenceSnapshots,
          notes: scale.notes.trim() || null,
        })
        .eq("id", scaleId);

      if (scaleError) {
        throw new Error(scaleError.message);
      }

      const keepMeasurementIds = scale.points
        .map((point) => point.measurementId)
        .filter((id): id is string => Boolean(id));

      if (keepMeasurementIds.length > 0) {
        const { error: deleteMissingError } = await supabase
          .from("calibration_measurements")
          .delete()
          .eq("calibration_record_id", recordId)
          .eq("scale_id", scaleId)
          .not("id", "in", "(" + keepMeasurementIds.join(",") + ")");

        if (deleteMissingError) {
          throw new Error(deleteMissingError.message);
        }
      } else {
        const { error: deleteAllError } = await supabase
          .from("calibration_measurements")
          .delete()
          .eq("calibration_record_id", recordId)
          .eq("scale_id", scaleId);

        if (deleteAllError) {
          throw new Error(deleteAllError.message);
        }
      }

      for (let pointIndex = 0; pointIndex < calculatedPoints.length; pointIndex += 1) {
        const calculatedPoint = calculatedPoints[pointIndex];
        const editablePoint = scale.points[pointIndex];

        const payload = {
          calibration_record_id: recordId,
          scale_id: scaleId,
          section: scale.scaleName.trim(),
          point_order: pointIndex + 1,
          nominal_value: nominalValueNumber,
          applied_value: nominalValueNumber,
          cycle_1: calculatedPoint.reading1,
          cycle_2: calculatedPoint.reading2,
          cycle_3: calculatedPoint.reading3,
          max_value: calculatedPoint.max,
          min_value: calculatedPoint.min,
          average_value: calculatedPoint.average,
          mean_error: calculatedPoint.error,
          accuracy_error_percent: calculatedPoint.errorPercent,
          repeatability_error_percent: null,
          result: calculatedPoint.result,
          notes:
            editablePoint.notes.trim() ||
            (tolerancePercentNumber !== null
              ? "Tolleranza errore: ±" +
                String(tolerancePercentNumber).replace(".", ",") +
                "%"
              : null),
        };

        if (editablePoint.measurementId) {
          const { error: updateError } = await supabase
            .from("calibration_measurements")
            .update(payload)
            .eq("id", editablePoint.measurementId);

          if (updateError) {
            throw new Error(updateError.message);
          }
        } else {
          const { data: insertedMeasurement, error: insertError } =
            await supabase
              .from("calibration_measurements")
              .insert(payload)
              .select("id")
              .single();

          if (insertError || !insertedMeasurement) {
            throw new Error(
              insertError?.message || "Errore durante l’inserimento della battuta."
            );
          }

          setScale((currentScale) => ({
            ...currentScale,
            scaleId,
            points: currentScale.points.map((currentPoint) =>
              currentPoint.id === editablePoint.id
                ? {
                    ...currentPoint,
                    measurementId: insertedMeasurement.id,
                  }
                : currentPoint
            ),
          }));
        }
      }

      const finalResult = buildFinalResult(calculatedPoints);

      await supabase
        .from("calibration_records")
        .update({
          report_status: "draft",
          final_result: finalResult,
        })
        .eq("id", recordId)
        .neq("report_status", "issued");

      setSaveMessage(
        "Misure sclerometriche aggiornate correttamente. Risultato finale: " +
          finalResult +
          "."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure sclerometriche.";

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
              Dati tecnici prova sclerometrica
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
              Prova sclerometrica
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Nome prova *
                </span>
                <input
                  value={scale.scaleName}
                  onChange={(event) =>
                    updateScaleField("scaleName", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Valore nominale incudine *
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={scale.nominalValue}
                  onChange={(event) =>
                    updateScaleNumericField("nominalValue", event.target.value)
                  }
                  placeholder="Es. 80"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Tolleranza errore %
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={scale.tolerancePercent}
                  onChange={(event) =>
                    updateScaleNumericField("tolerancePercent", event.target.value)
                  }
                  placeholder="Es. 3,75"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-4">
              <ReferenceInstrumentMultiSelect
                instruments={referenceInstruments}
                selectedIds={scale.referenceInstrumentIds}
                onToggle={toggleReferenceInstrument}
                label="Incudini di riferimento usate *"
              />
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Note prova
              </span>
              <input
                value={scale.notes}
                onChange={(event) =>
                  updateScaleField("notes", event.target.value)
                }
                placeholder="Eventuali note sulla prova"
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
                          <p className="font-semibold">Incudine</p>
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
                          Blocco: questa incudine di riferimento è scaduta o
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
                  <th className="px-4 py-3">Battuta</th>
                  <th className="bg-orange-100 px-4 py-3 text-orange-900">
                    Lettura 1
                  </th>
                  <th className="bg-slate-100 px-4 py-3 text-slate-900">
                    Lettura 2
                  </th>
                  <th className="bg-orange-100 px-4 py-3 text-orange-900">
                    Lettura 3
                  </th>
                  <th className="px-4 py-3">Media</th>
                  <th className="px-4 py-3">Errore</th>
                  <th className="px-4 py-3">Errore %</th>
                  <th className="px-4 py-3">Esito</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {calculatedPoints.map((point, pointIndex) => {
                  const editablePoint = scale.points[pointIndex];

                  return (
                    <tr key={point.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {pointIndex + 1}
                      </td>

                      <td className="bg-white px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.reading1 ?? ""}
                          onChange={(event) =>
                            updatePoint(point.id, "reading1", event.target.value)
                          }
                          className="w-24 rounded-lg border border-orange-300 bg-white px-2 py-1 font-semibold text-orange-950 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.reading2 ?? ""}
                          onChange={(event) =>
                            updatePoint(point.id, "reading2", event.target.value)
                          }
                          className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-950 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </td>

                      <td className="bg-white px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.reading3 ?? ""}
                          onChange={(event) =>
                            updatePoint(point.id, "reading3", event.target.value)
                          }
                          className="w-24 rounded-lg border border-orange-300 bg-white px-2 py-1 font-semibold text-orange-950 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />
                      </td>

                      <td className="px-4 py-3">
                        {formatItalianNumber(point.average)}
                      </td>

                      <td className="px-4 py-3">
                        {formatItalianNumber(point.error)}
                      </td>

                      <td className="px-4 py-3">
                        {formatItalianNumber(point.errorPercent)}
                      </td>

                      <td className="px-4 py-3">
                        {point.result ? (
                          <span
                            className={
                              point.result === "CONFORME"
                                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                                : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                            }
                          >
                            {point.result}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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

              {calculatedPoints.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                  <tr>
                    <td className="px-4 py-3" colSpan={4}>
                      Media complessiva ({calculatedPoints.length} battute)
                    </td>
                    <td className="px-4 py-3">
                      {formatItalianNumber(overallAverage)}
                    </td>
                    <td className="px-4 py-3">
                      {formatItalianNumber(overallError)}
                    </td>
                    <td className="px-4 py-3">
                      {formatItalianNumber(overallErrorPercent)}
                    </td>
                    <td className="px-4 py-3" colSpan={2}>
                      {tolerancePercentNumber !== null && overallErrorPercent !== null ? (
                        <span
                          className={
                            Math.abs(overallErrorPercent) <= tolerancePercentNumber
                              ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                              : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                          }
                        >
                          {Math.abs(overallErrorPercent) <= tolerancePercentNumber
                            ? "CONFORME"
                            : "NON CONFORME"}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="border-t border-slate-200 p-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addPoint}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Aggiungi battuta
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 p-5">
            <MeasurementErrorChart
              title="Grafico errore accuratezza % - Prova sclerometrica"
              lineColor="#ea580c"
              measurements={calculatedPoints.map((point, index) => ({
                id: point.id,
                point_order: index + 1,
                nominal_value: nominalValueNumber,
                applied_value: nominalValueNumber,
                accuracy_error_percent: point.errorPercent,
              }))}
            />
          </div>
        </section>
      </fieldset>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salva misure sclerometriche
          </h2>
          <p className="text-sm text-slate-500">
            I valori vengono salvati usando battuta, tre letture, media,
            errore medio ed errore percentuale rispetto al valore nominale
            dell&apos;incudine di riferimento.
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
              : "Salva misure"}
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
