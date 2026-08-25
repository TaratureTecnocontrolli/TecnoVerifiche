"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SimpleAccuracyChart from "@/components/SimpleAccuracyChart";

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

type EditableFlowPoint = {
  id: string;
  measurementId: string | null;
  nominalVolume: string;
  setVolume: string;
  reading1: string;
  reading2: string;
  reading3: string;
  tolerancePercent: string;
  notes: string;
};

type EditableScale = {
  id: string;
  scaleId: string;
  scaleName: string;
  scaleRange: string;
  referenceInstrumentId: string;
  notes: string;
  points: EditableFlowPoint[];
};

type CalculatedFlowPoint = {
  id: string;
  nominalVolume: number;
  setVolume: number;
  reading1: number;
  reading2: number;
  reading3: null;
  average: number;
  min: number;
  max: number;
  error: number;
  errorPercent: number;
  repeatabilityPercent: number;
  tolerancePercent: number | null;
  result: string | null;
};

type EditFlowMeasurementsFormProps = {
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


function normalizeUnit(value: unknown) {
  const unit = String(value ?? "").trim();

  if (!unit || unit === "-") {
    return "";
  }

  return unit;
}

function unitSuffix(unit: string) {
  return unit ? " (" + unit + ")" : "";
}

function inferUnitFromText(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(/\b(ml|mL|l|L|litri|litro|kg|g|kN|N|bar|MPa|°C|C)\b/);

  if (!match) {
    return "";
  }

  const unit = match[1];

  if (unit.toLowerCase() === "litri" || unit.toLowerCase() === "litro") {
    return "l";
  }

  return unit;
}

function buildReferenceInstrumentSnapshot(
  instrument: ReferenceInstrument | undefined
) {
  if (!instrument) {
    return null;
  }

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

  return {
    id: firstScale?.id || "flow-scale",
    scaleId: firstScale?.id || "",
    scaleName: firstScale?.scale_name || "Scala portata / volume",
    scaleRange: firstScale?.scale_range || "",
    referenceInstrumentId: firstScale?.reference_instrument_id || "",
    notes: firstScale?.notes || "",
    points: scaleMeasurements.map((measurement) => ({
      id: measurement.id || crypto.randomUUID(),
      measurementId: measurement.id,
      nominalVolume: numberToInputValue(measurement.nominal_value),
      setVolume: numberToInputValue(measurement.applied_value),
      reading1: numberToInputValue(measurement.cycle_1),
      reading2: numberToInputValue(measurement.cycle_2),
      reading3: "",
      tolerancePercent: "",
      notes: measurement.notes || "",
    })),
  };
}

function calculateFlowPoint(point: EditableFlowPoint): CalculatedFlowPoint {
  const nominalVolume = toNumber(point.nominalVolume);
  const setVolume = toNumber(point.setVolume);
  const reading1 = toNumber(point.reading1);
  const reading2 = toNumber(point.reading2);
  const values = [reading1, reading2];

  const average =
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Formula derivata dal rapporto contalitri:
  // Errore = Media letture - Volume impostato
  // Errore % = Errore / Volume impostato × 100
  const error = average - setVolume;
  const errorPercent = setVolume !== 0 ? (error / setVolume) * 100 : 0;
  const repeatabilityPercent =
    average !== 0 ? ((max - min) / average) * 100 : 0;

  const tolerancePercent = nullableNumberFromInput(point.tolerancePercent);

  let result: string | null = null;

  if (tolerancePercent !== null) {
    result =
      Math.abs(errorPercent) <= tolerancePercent ? "CONFORME" : "NON CONFORME";
  }

  return {
    id: point.id,
    nominalVolume,
    setVolume,
    reading1,
    reading2,
    reading3: null,
    average,
    min,
    max,
    error,
    errorPercent,
    repeatabilityPercent,
    tolerancePercent,
    result,
  };
}

function buildFinalResult(points: CalculatedFlowPoint[]) {
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

export default function EditFlowMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  isInternalVerification = false,
  initialScales,
  initialMeasurements,
  referenceInstruments,
}: EditFlowMeasurementsFormProps) {
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


  const calculatedPoints = useMemo(() => {
    return scale.points.map(calculateFlowPoint);
  }, [scale.points]);

  const selectedReferenceInstrument = referenceInstruments.find(
    (instrument) => instrument.id === scale.referenceInstrumentId
  );

  const selectedReferenceStatus = selectedReferenceInstrument
    ? effectiveStatus(selectedReferenceInstrument)
    : null;

  const flowUnit =
    normalizeUnit(selectedReferenceInstrument?.unit) || inferUnitFromText(scale.scaleRange) || "l";

  const hasBlockedReferenceInstrument =
    selectedReferenceStatus && isReferenceInstrumentBlocked(selectedReferenceStatus);

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function updateScaleField(
    field: keyof Omit<EditableScale, "id" | "scaleId" | "points">,
    value: string
  ) {
    resetSaveState();
    setScale((currentScale) => ({
      ...currentScale,
      [field]: value,
    }));
  }

  function updatePoint(
    pointId: string,
    field: keyof Omit<EditableFlowPoint, "id" | "measurementId">,
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

    setScale((currentScale) => {
      const lastPoint = currentScale.points[currentScale.points.length - 1];
      const nextNominalValue = lastPoint
        ? toNumber(lastPoint.nominalVolume) + 5
        : 5;

      return {
        ...currentScale,
        points: [
          ...currentScale.points,
          {
            id: crypto.randomUUID(),
            measurementId: null,
            nominalVolume: numberToInputValue(nextNominalValue),
            setVolume: numberToInputValue(nextNominalValue),
            reading1: "",
            reading2: "",
            reading3: "",
            tolerancePercent: "",
            notes: "",
          },
        ],
      };
    });
  }

  function addStandardPoints() {
    resetSaveState();

    const standardValues = [5, 10, 25, 50, 75, 100];

    setScale((currentScale) => ({
      ...currentScale,
      points: standardValues.map((value) => ({
        id: crypto.randomUUID(),
        measurementId: null,
        nominalVolume: numberToInputValue(value),
        setVolume: numberToInputValue(value),
        reading1: "",
        reading2: "",
        reading3: "",
        tolerancePercent: "",
        notes: "",
      })),
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
      throw new Error("Inserisci il nome della scala.");
    }

    if (!scale.referenceInstrumentId) {
      throw new Error("Seleziona lo strumento campione usato.");
    }

    if (!selectedReferenceInstrument) {
      throw new Error("Strumento campione usato non trovato.");
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error(
        "Lo strumento campione usato è scaduto o fuori servizio."
      );
    }

    if (scale.points.length === 0) {
      throw new Error("Inserisci almeno un punto di verifica.");
    }

    const invalidPoint = scale.points.find((point) => {
      return (
        point.nominalVolume.trim() === "" ||
        point.setVolume.trim() === "" ||
        point.reading1.trim() === "" ||
        point.reading2.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error(
        "Compila volume nominale, volume impostato e le due letture per tutti i punti."
      );
    }
  }

  async function ensureScaleExists() {
    if (scale.scaleId) {
      return scale.scaleId;
    }

    if (!selectedReferenceInstrument) {
      throw new Error("Strumento campione usato non selezionato.");
    }

    const { data: insertedScale, error: insertScaleError } = await supabase
      .from("calibration_record_scales")
      .insert({
        calibration_record_id: recordId,
        scale_order: 1,
        scale_name: scale.scaleName.trim(),
        scale_range: scale.scaleRange.trim() || null,
        reference_instrument_id: selectedReferenceInstrument.id,
        reference_instrument_snapshot: buildReferenceInstrumentSnapshot(
          selectedReferenceInstrument
        ),
        notes: scale.notes.trim() || null,
      })
      .select("id")
      .single();

    if (insertScaleError || !insertedScale) {
      throw new Error(
        insertScaleError?.message || "Errore durante la creazione della scala."
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

      if (!selectedReferenceInstrument) {
        throw new Error("Strumento campione usato non selezionato.");
      }

      const scaleId = await ensureScaleExists();

      const { error: scaleError } = await supabase
        .from("calibration_record_scales")
        .update({
          scale_order: 1,
          scale_name: scale.scaleName.trim(),
          scale_range: scale.scaleRange.trim() || null,
          reference_instrument_id: selectedReferenceInstrument.id,
          reference_instrument_snapshot: buildReferenceInstrumentSnapshot(
            selectedReferenceInstrument
          ),
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
          nominal_value: calculatedPoint.nominalVolume,
          applied_value: calculatedPoint.setVolume,
          cycle_1: calculatedPoint.reading1,
          cycle_2: calculatedPoint.reading2,
          cycle_3: null,
          max_value: calculatedPoint.max,
          min_value: calculatedPoint.min,
          average_value: calculatedPoint.average,
          mean_error: calculatedPoint.error,
          accuracy_error_percent: calculatedPoint.errorPercent,
          repeatability_error_percent: calculatedPoint.repeatabilityPercent,
          result: calculatedPoint.result,
          notes:
            editablePoint.notes.trim() ||
            (calculatedPoint.tolerancePercent !== null
              ? "Tolleranza errore: ±" +
                String(calculatedPoint.tolerancePercent).replace(".", ",") +
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
              insertError?.message || "Errore durante l’inserimento del punto."
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
        "Misure portata aggiornate correttamente. Risultato finale: " +
          finalResult +
          "."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure portata.";

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
              Dati tecnici portata / contalitri
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
              Scala portata / volume
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Nome scala *
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
                  Campo / fondo scala
                </span>
                <input
                  value={scale.scaleRange}
                  onChange={(event) =>
                    updateScaleField("scaleRange", event.target.value)
                  }
                  placeholder="Es. FS 500 l"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 lg:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Strumento campione usato *
                </span>
                <select
                  value={scale.referenceInstrumentId}
                  onChange={(event) =>
                    updateScaleField("referenceInstrumentId", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleziona strumento campione</option>

                  {referenceInstruments.map((instrument) => (
                    <option key={instrument.id} value={instrument.id}>
                      {instrument.name || "Strumento campione"}
                      {instrument.internal_code
                        ? " - " + instrument.internal_code
                        : ""}
                      {getRange(instrument) ? " - " + getRange(instrument) : ""}
                      {instrument.serial_number
                        ? " - Mat. " + instrument.serial_number
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Note scala
              </span>
              <input
                value={scale.notes}
                onChange={(event) =>
                  updateScaleField("notes", event.target.value)
                }
                placeholder="Eventuali note sulla scala"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            {selectedReferenceInstrument && selectedReferenceStatus && (
              <div
                className={
                  "mt-5 rounded-xl border p-4 text-sm " +
                  statusClass(selectedReferenceStatus)
                }
              >
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <p className="font-semibold">Stato</p>
                    <p>{statusLabel(selectedReferenceStatus)}</p>
                  </div>

                  <div>
                    <p className="font-semibold">Certificato</p>
                    <p>{selectedReferenceInstrument.certificate_number ?? "-"}</p>
                  </div>

                  <div>
                    <p className="font-semibold">Scadenza</p>
                    <p>
                      {formatItalianDate(
                        selectedReferenceInstrument.certificate_expiry
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold">Campo</p>
                    <p>{getRange(selectedReferenceInstrument) ?? "-"}</p>
                  </div>

                  <div>
                    <p className="font-semibold">File</p>
                    {selectedReferenceInstrument.certificate_file_url ? (
                      <a
                        href={selectedReferenceInstrument.certificate_file_url}
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

                {hasBlockedReferenceInstrument && (
                  <p className="mt-3 font-medium">
                    Blocco: lo strumento campione è scaduto o fuori servizio.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Punto</th>
                  <th className="px-4 py-3">Volume nominale{unitSuffix(flowUnit)}</th>
                  <th className="px-4 py-3">Volume impostato{unitSuffix(flowUnit)}</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">
                    Lettura I
                  </th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">
                    Lettura II
                  </th>
                  <th className="px-4 py-3">Media{unitSuffix(flowUnit)}</th>
                  <th className="px-4 py-3">Errore{unitSuffix(flowUnit)}</th>
                  <th className="px-4 py-3">Errore %</th>
                  <th className="px-4 py-3">Ripetibilità %</th>
                  <th className="px-4 py-3">Toll. %</th>
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

                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.nominalVolume ?? ""}
                          onChange={(event) =>
                            updatePoint(
                              point.id,
                              "nominalVolume",
                              event.target.value
                            )
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.setVolume ?? ""}
                          onChange={(event) =>
                            updatePoint(point.id, "setVolume", event.target.value)
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </td>

                      <td className="bg-amber-50 px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.reading1 ?? ""}
                          onChange={(event) =>
                            updatePoint(point.id, "reading1", event.target.value)
                          }
                          className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                      </td>

                      <td className="bg-amber-50 px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.reading2 ?? ""}
                          onChange={(event) =>
                            updatePoint(point.id, "reading2", event.target.value)
                          }
                          className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                      </td>

                      <td className="px-4 py-3">
                        {formatItalianNumber(point.average, 3)}
                      </td>

                      <td className="px-4 py-3">
                        {formatItalianNumber(point.error, 3)}
                      </td>

                      <td className="px-4 py-3">
                        {formatItalianNumber(point.errorPercent, 3)}
                      </td>

                      <td className="px-4 py-3">
                        {formatItalianNumber(point.repeatabilityPercent, 3)}
                      </td>

                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editablePoint?.tolerancePercent ?? ""}
                          onChange={(event) =>
                            updatePoint(
                              point.id,
                              "tolerancePercent",
                              event.target.value
                            )
                          }
                          placeholder="es. 10"
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                        />
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
            </table>
          </div>



          <div className="border-t border-slate-200 p-5">
            <SimpleAccuracyChart
              title="Grafico errore accuratezza % - Portata / contalitri"
              lineColor="#0284c7"
              points={calculatedPoints.map((point, index) => ({
                label:
                  point.setVolume
                    ? formatItalianNumber(point.setVolume, 3)
                    : "Punto " + String(index + 1),
                value: point.errorPercent,
              }))}
            />
          </div>

          <div className="border-t border-slate-200 p-5">
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={addStandardPoints}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Carica punti 5-10-25-50-75-100
              </button>

              <button
                type="button"
                onClick={addPoint}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Aggiungi punto
              </button>
            </div>
          </div>
        </section>
      </fieldset>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salva misure portata
          </h2>
          <p className="text-sm text-slate-500">
            I valori vengono salvati usando volume nominale, volume impostato,
            due letture, media, errore, errore percentuale e ripetibilità.
          </p>
        </div>

        <button
          type="button"
          onClick={saveMeasurements}
          disabled={isSaving || isReadOnly || Boolean(hasBlockedReferenceInstrument)}
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
