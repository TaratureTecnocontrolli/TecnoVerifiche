"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SimpleAccuracyChart from "@/components/SimpleAccuracyChart";
import ReferenceInstrumentMultiSelect from "@/components/ReferenceInstrumentMultiSelect";
import {
  calculateTorqueMassPoint,
  massKgFromTorque,
  overallTorqueResult,
  parseTorqueMeasurementMetadata,
  readTorqueProcedureSettings,
  serializeTorqueMeasurementMetadata,
  STANDARD_GRAVITY_M_S2,
  TORQUE_ACCURACY_LIMIT_PERCENT,
  type TorqueMassCalculatedPoint,
} from "@/lib/torque-calculations";

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

type EditableTorquePoint = {
  id: string;
  measurementId: string | null;
  theoreticalMassKg: string;
  appliedMass1Kg: string;
  appliedMass2Kg: string;
  appliedMass3Kg: string;
  notes: string;
  legacyReconstructed?: boolean;
};

type EditableScale = {
  id: string;
  scaleId: string;
  scaleName: string;
  scaleRange: string;
  referenceInstrumentIds: string[];
  notes: string;
  points: EditableTorquePoint[];
};

type CalculatedTorquePoint = TorqueMassCalculatedPoint;

type EditTorqueMeasurementsFormProps = {
  recordId: string;
  recordNumber: string | null;
  reportStatus: string | null;
  initialVerificationDate?: string | null;
  procedureSnapshot?: Record<string, unknown> | null;
  initialScales: InitialScale[];
  initialMeasurements: InitialMeasurement[];
  referenceInstruments: ReferenceInstrument[];
  isInternal?: boolean;
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
  measurements: InitialMeasurement[],
  armLengthM: number,
  gravityM_s2: number
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
    id: firstScale?.id || "torque-scale",
    scaleId: firstScale?.id || "",
    scaleName: firstScale?.scale_name || "Scala coppia",
    scaleRange: firstScale?.scale_range || "",
    referenceInstrumentIds,
    notes: firstScale?.notes || "",
    points: scaleMeasurements.map((measurement) => {
      const metadata = parseTorqueMeasurementMetadata(measurement.notes);

      if (metadata) {
        return {
          id: measurement.id || crypto.randomUUID(),
          measurementId: measurement.id,
          theoreticalMassKg: numberToInputValue(metadata.theoreticalMassKg),
          appliedMass1Kg: numberToInputValue(metadata.appliedMass1Kg),
          appliedMass2Kg: numberToInputValue(metadata.appliedMass2Kg),
          appliedMass3Kg: numberToInputValue(metadata.appliedMass3Kg),
          notes: metadata.userNotes || "",
          legacyReconstructed: false,
        };
      }

      return {
        id: measurement.id || crypto.randomUUID(),
        measurementId: measurement.id,
        theoreticalMassKg: numberToInputValue(
          massKgFromTorque(measurement.nominal_value ?? measurement.applied_value ?? 0, armLengthM, gravityM_s2)
        ),
        appliedMass1Kg: numberToInputValue(
          massKgFromTorque(measurement.cycle_1 ?? 0, armLengthM, gravityM_s2)
        ),
        appliedMass2Kg: numberToInputValue(
          massKgFromTorque(measurement.cycle_2 ?? 0, armLengthM, gravityM_s2)
        ),
        appliedMass3Kg: numberToInputValue(
          massKgFromTorque(measurement.cycle_3 ?? 0, armLengthM, gravityM_s2)
        ),
        notes: measurement.notes || "",
        legacyReconstructed: true,
      };
    }),
  };
}

function calculateTorquePoint(
  point: EditableTorquePoint,
  armLengthM: number,
  gravityM_s2: number
): CalculatedTorquePoint {
  return calculateTorqueMassPoint(
    {
      id: point.id,
      theoreticalMassKg: toNumber(point.theoreticalMassKg),
      appliedMass1Kg: toNumber(point.appliedMass1Kg),
      appliedMass2Kg: toNumber(point.appliedMass2Kg),
      appliedMass3Kg: toNumber(point.appliedMass3Kg),
    },
    armLengthM,
    gravityM_s2
  );
}

export default function EditTorqueMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  initialVerificationDate,
  procedureSnapshot,
  initialScales,
  initialMeasurements,
  referenceInstruments,
  isInternal = false,
}: EditTorqueMeasurementsFormProps) {
  const [verificationDate, setVerificationDate] = useState(
    initialVerificationDate || ""
  );
  const initialProcedureSettings = readTorqueProcedureSettings(procedureSnapshot);
  const [armLength, setArmLength] = useState(
    numberToInputValue(initialProcedureSettings.armLengthM) || "1"
  );
  const gravityM_s2 = initialProcedureSettings.gravityM_s2 || STANDARD_GRAVITY_M_S2;

  const [scale, setScale] = useState<EditableScale>(() =>
    buildEditableScale(
      initialScales,
      initialMeasurements,
      initialProcedureSettings.armLengthM,
      initialProcedureSettings.gravityM_s2
    )
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const isReadOnly = reportStatus === "issued";

  const armLengthM = toNumber(armLength);
  const calculatedPoints = useMemo(() => {
    return scale.points.map((point) =>
      calculateTorquePoint(point, armLengthM, gravityM_s2)
    );
  }, [scale.points, armLengthM, gravityM_s2]);
  const overallResult = useMemo(
    () => overallTorqueResult(calculatedPoints),
    [calculatedPoints]
  );

  const availableReferenceInstruments = useMemo(() => {
    const massOnly = referenceInstruments.filter((instrument) => {
      const text = [
        instrument.name,
        instrument.measurement_quantity,
        instrument.unit,
        getRange(instrument),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        text.includes("massa") ||
        text.includes("mass") ||
        text.includes("pesiera") ||
        text.includes("peso") ||
        text.includes("kg") ||
        text.includes("gram")
      );
    });
    return massOnly.length > 0 ? massOnly : referenceInstruments;
  }, [referenceInstruments]);

  const selectedReferenceInstruments = referenceInstruments.filter((instrument) =>
    scale.referenceInstrumentIds.includes(instrument.id)
  );
  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    (instrument) => isReferenceInstrumentBlocked(effectiveStatus(instrument))
  );
  const hasLegacyReconstructedPoints = scale.points.some(
    (point) => point.legacyReconstructed
  );

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

  function toggleReferenceInstrument(instrumentId: string) {
    resetSaveState();
    setScale((currentScale) => ({
      ...currentScale,
      referenceInstrumentIds: currentScale.referenceInstrumentIds.includes(instrumentId)
        ? currentScale.referenceInstrumentIds.filter((id) => id !== instrumentId)
        : [...currentScale.referenceInstrumentIds, instrumentId],
    }));
  }

  function updatePoint(
    pointId: string,
    field: keyof Omit<EditableTorquePoint, "id" | "measurementId">,
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
          theoreticalMassKg: "",
          appliedMass1Kg: "",
          appliedMass2Kg: "",
          appliedMass3Kg: "",
          notes: "",
          legacyReconstructed: false,
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
      throw new Error("Inserisci il nome della scala.");
    }
    if (armLength.trim() === "" || armLengthM <= 0) {
      throw new Error("Inserisci una lunghezza del braccio maggiore di zero.");
    }
    if (scale.referenceInstrumentIds.length === 0) {
      throw new Error("Seleziona almeno uno strumento campione usato.");
    }
    if (selectedReferenceInstruments.length !== scale.referenceInstrumentIds.length) {
      throw new Error("Uno strumento campione selezionato non è stato trovato.");
    }
    if (hasBlockedReferenceInstrument) {
      throw new Error("Uno strumento campione usato è scaduto o fuori servizio.");
    }
    if (scale.points.length === 0) {
      throw new Error("Inserisci almeno un punto di coppia.");
    }
    const invalidPoint = scale.points.find((point) =>
      point.theoreticalMassKg.trim() === "" ||
      point.appliedMass1Kg.trim() === "" ||
      point.appliedMass2Kg.trim() === "" ||
      point.appliedMass3Kg.trim() === ""
    );
    if (invalidPoint) {
      throw new Error("Compila massa teorica di riferimento e le tre masse applicate per tutti i punti.");
    }
  }

  async function ensureScaleExists() {
    if (scale.scaleId) {
      return scale.scaleId;
    }
    const primaryReference = selectedReferenceInstruments[0];
    if (!primaryReference) {
      throw new Error("Strumento campione usato non selezionato.");
    }
    const referenceSnapshots = selectedReferenceInstruments.map(
      buildReferenceInstrumentSnapshot
    );
    const { data: insertedScale, error: insertScaleError } = await supabase
      .from("calibration_record_scales")
      .insert({
        calibration_record_id: recordId,
        scale_order: 1,
        scale_name: scale.scaleName.trim(),
        scale_range: scale.scaleRange.trim() || null,
        reference_instrument_id: primaryReference.id,
        reference_instrument_snapshot: referenceSnapshots[0],
        reference_instrument_ids: selectedReferenceInstruments.map((instrument) => instrument.id),
        reference_instruments_snapshot: referenceSnapshots,
        notes: scale.notes.trim() || null,
      })
      .select("id")
      .single();
    if (insertScaleError || !insertedScale) {
      throw new Error(insertScaleError?.message || "Errore durante la creazione della scala.");
    }
    setScale((currentScale) => ({ ...currentScale, scaleId: insertedScale.id }));
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
      if (isInternal && !verificationDate) {
        throw new Error("Inserisci la data della verifica.");
      }

      validate();

      const primaryReference = selectedReferenceInstruments[0];
      if (!primaryReference) {
        throw new Error("Strumento campione usato non selezionato.");
      }

      const scaleId = await ensureScaleExists();
      const referenceSnapshots = selectedReferenceInstruments.map(
        buildReferenceInstrumentSnapshot
      );

      const { error: scaleError } = await supabase
        .from("calibration_record_scales")
        .update({
          scale_order: 1,
          scale_name: scale.scaleName.trim(),
          scale_range: scale.scaleRange.trim() || null,
          reference_instrument_id: primaryReference.id,
          reference_instrument_snapshot: referenceSnapshots[0],
          reference_instrument_ids: selectedReferenceInstruments.map((instrument) => instrument.id),
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
          nominal_value: calculatedPoint.nominalTorqueNm,
          applied_value: calculatedPoint.nominalTorqueNm,
          cycle_1: calculatedPoint.reading1Nm,
          cycle_2: calculatedPoint.reading2Nm,
          cycle_3: calculatedPoint.reading3Nm,
          max_value: calculatedPoint.maxNm,
          min_value: calculatedPoint.minNm,
          average_value: calculatedPoint.averageNm,
          mean_error: calculatedPoint.meanErrorNm,
          accuracy_error_percent: calculatedPoint.accuracyErrorPercent,
          repeatability_error_percent: calculatedPoint.repeatabilityErrorPercent,
          result: calculatedPoint.result,
          notes: serializeTorqueMeasurementMetadata({
            theoreticalMassKg: calculatedPoint.theoreticalMassKg,
            appliedMass1Kg: calculatedPoint.appliedMass1Kg,
            appliedMass2Kg: calculatedPoint.appliedMass2Kg,
            appliedMass3Kg: calculatedPoint.appliedMass3Kg,
            userNotes: editablePoint.notes.trim() || null,
          }),
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
      const updatedProcedureSnapshot = {
        ...(procedureSnapshot ?? {}),
        code: "PTS13",
        name: "Verifica chiavi dinamometriche mediante masse campione e braccio di leva",
        revision: null,
        calculation_engine_version: "torque-mass-v1",
        gravity_acceleration_m_s2: gravityM_s2,
        arm_length_m: armLengthM,
        accuracy_limit_percent: TORQUE_ACCURACY_LIMIT_PERCENT,
      };

      const recordUpdate: Record<string, unknown> = {
        procedure_snapshot: updatedProcedureSnapshot,
        final_result: overallResult,
        report_status: "draft",
      };
      if (isInternal) {
        recordUpdate.verification_date = verificationDate;
      }
      const { error: recordUpdateError } = await supabase
        .from("calibration_records")
        .update(recordUpdate)
        .eq("id", recordId)
        .neq("report_status", "issued");
      if (recordUpdateError) {
        throw new Error(recordUpdateError.message);
      }

      const detailsUpdate: Record<string, unknown> = {
        execution_method: [
          "Per ciascun punto viene definita la massa teorica di riferimento. Il punto di verifica è calcolato come Massa teorica × g × L braccio.",
          "Per ognuno dei tre cicli viene registrata la massa applicata e la corrispondente lettura di coppia è calcolata come Massa applicata × g × L braccio.",
          "Scostamento = Media letture - Punto di verifica.",
          "Errore accuratezza % = Scostamento / Punto di verifica × 100.",
          "Errore ripetibilità % = (Lettura massima - Lettura minima) / Media letture × 100.",
          "La verifica è conforme quando, per tutti i punti, il valore assoluto dell'errore di accuratezza è ≤ 3%.",
        ].join("\n"),
        results_text: "Per ciascun punto sono riportati massa teorica di riferimento, masse applicate, coppie calcolate, massimo, minimo, media, scostamento, errore di accuratezza ed errore di ripetibilità. Criterio di conformità: |Errore accuratezza| ≤ 3% su tutti i punti.",
      };
      if (isInternal) {
        detailsUpdate.test_date = verificationDate;
      }
      const { error: detailsUpdateError } = await supabase
        .from("calibration_report_details")
        .update(detailsUpdate)
        .eq("calibration_record_id", recordId);
      if (detailsUpdateError) {
        throw new Error(detailsUpdateError.message);
      }

      setSaveMessage("Misure dinamometriche aggiornate correttamente.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure dinamometriche.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {isInternal && (
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
            Per correggere i dati tecnici devi prima riaprire il rapporto dalla
            pagina di anteprima finale.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Dati tecnici dinamometria
            </h2>
            <p className="text-sm text-slate-500">
              Verifica interna: {recordNumber || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={isInternal ? "/verifiche/" + recordId + "/rapportino-interno" : "/verifiche/" + recordId + "/rapporto"}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {isInternal ? "Rapportino" : "Dati rapporto"}
            </Link>

            <Link
              href={isInternal ? "/verifiche/" + recordId + "/rapportino-interno" : "/verifiche/" + recordId + "/rapporto/finale"}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isInternal ? "Rapportino" : "Rapporto"}
            </Link>
          </div>
        </div>
      </section>

      <fieldset disabled={isReadOnly} className="space-y-6 disabled:opacity-70">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Scala coppia</h2>

            {hasLegacyReconstructedPoints && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Verifica storica: le masse sono state ricostruite dai valori di coppia già salvati usando g = {gravityM_s2} m/s² e L = {armLengthM || 1} m. Controllale prima di salvare.
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Nome scala *</span>
                <input value={scale.scaleName} onChange={(event) => updateScaleField("scaleName", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Campo / fondo scala</span>
                <input value={scale.scaleRange} onChange={(event) => updateScaleField("scaleRange", event.target.value)} placeholder="Es. 40 - 200 N·m" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">g (m/s²)</span>
                <p className="mt-1 font-semibold text-slate-950">{gravityM_s2}</p>
              </div>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">L braccio (m) *</span>
                <input value={armLength} onChange={(event) => { setArmLength(normalizeEuropeanDecimalInput(event.target.value)); resetSaveState(); }} inputMode="decimal" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="mt-4">
              <ReferenceInstrumentMultiSelect instruments={availableReferenceInstruments} selectedIds={scale.referenceInstrumentIds} onToggle={toggleReferenceInstrument} label="Masse / strumenti campione usati *" />
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-sm font-medium text-slate-700">Note scala</span>
              <input value={scale.notes} onChange={(event) => updateScaleField("notes", event.target.value)} placeholder="Eventuali note sulla scala" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            {selectedReferenceInstruments.length > 0 && (
              <div className="mt-5 space-y-3">
                {selectedReferenceInstruments.map((instrument) => {
                  const instrumentStatus = effectiveStatus(instrument);
                  return (
                    <div key={instrument.id} className={"rounded-xl border p-4 text-sm " + statusClass(instrumentStatus)}>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                        <div><p className="font-semibold">Strumento</p><p>{instrument.name || "-"}</p></div>
                        <div><p className="font-semibold">Stato</p><p>{statusLabel(instrumentStatus)}</p></div>
                        <div><p className="font-semibold">Certificato</p><p>{instrument.certificate_number ?? "-"}</p></div>
                        <div><p className="font-semibold">Scadenza</p><p>{formatItalianDate(instrument.certificate_expiry)}</p></div>
                        <div><p className="font-semibold">Campo</p><p>{getRange(instrument) ?? "-"}</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-b border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><span className="font-semibold">Formula:</span> coppia = massa × g × L braccio.</div>
              <div><span className="font-semibold">Criterio:</span> |Errore accuratezza| ≤ {TORQUE_ACCURACY_LIMIT_PERCENT}%</div>
              <div className="font-semibold">Esito complessivo: {overallResult || "-"}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Punto</th><th className="px-3 py-3">Punto verifica (N·m)</th><th className="bg-slate-100 px-3 py-3">Massa teorica rif. (kg)</th>
                  <th className="bg-amber-100 px-3 py-3 text-amber-900">Massa applicata I (kg)</th><th className="px-3 py-3">Lettura I (N·m)</th>
                  <th className="bg-amber-100 px-3 py-3 text-amber-900">Massa applicata II (kg)</th><th className="px-3 py-3">Lettura II (N·m)</th>
                  <th className="bg-amber-100 px-3 py-3 text-amber-900">Massa applicata III (kg)</th><th className="px-3 py-3">Lettura III (N·m)</th>
                  <th className="px-3 py-3">Max</th><th className="px-3 py-3">Min</th><th className="px-3 py-3">Media</th><th className="px-3 py-3">Scostamento</th>
                  <th className="px-3 py-3">Errore acc. %</th><th className="px-3 py-3">Ripet. %</th><th className="px-3 py-3">Esito</th><th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedPoints.map((point, pointIndex) => {
                  const editablePoint = scale.points[pointIndex];
                  return (
                    <tr key={point.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-medium">{pointIndex + 1}</td>
                      <td className="px-3 py-3 font-semibold">{formatItalianNumber(point.nominalTorqueNm, 3)}</td>
                      <td className="bg-slate-50 px-3 py-3"><input type="text" inputMode="decimal" value={editablePoint?.theoreticalMassKg ?? ""} onChange={(event) => updatePoint(point.id, "theoreticalMassKg", event.target.value)} className="w-24 rounded-lg border border-slate-300 px-2 py-1" /></td>
                      <td className="bg-amber-50 px-3 py-3"><input type="text" inputMode="decimal" value={editablePoint?.appliedMass1Kg ?? ""} onChange={(event) => updatePoint(point.id, "appliedMass1Kg", event.target.value)} className="w-24 rounded-lg border border-amber-300 bg-white px-2 py-1 font-semibold" /></td>
                      <td className="px-3 py-3">{formatItalianNumber(point.reading1Nm, 3)}</td>
                      <td className="bg-amber-50 px-3 py-3"><input type="text" inputMode="decimal" value={editablePoint?.appliedMass2Kg ?? ""} onChange={(event) => updatePoint(point.id, "appliedMass2Kg", event.target.value)} className="w-24 rounded-lg border border-amber-300 bg-white px-2 py-1 font-semibold" /></td>
                      <td className="px-3 py-3">{formatItalianNumber(point.reading2Nm, 3)}</td>
                      <td className="bg-amber-50 px-3 py-3"><input type="text" inputMode="decimal" value={editablePoint?.appliedMass3Kg ?? ""} onChange={(event) => updatePoint(point.id, "appliedMass3Kg", event.target.value)} className="w-24 rounded-lg border border-amber-300 bg-white px-2 py-1 font-semibold" /></td>
                      <td className="px-3 py-3">{formatItalianNumber(point.reading3Nm, 3)}</td>
                      <td className="px-3 py-3">{formatItalianNumber(point.maxNm, 3)}</td><td className="px-3 py-3">{formatItalianNumber(point.minNm, 3)}</td><td className="px-3 py-3 font-semibold">{formatItalianNumber(point.averageNm, 3)}</td>
                      <td className="px-3 py-3">{formatItalianNumber(point.meanErrorNm, 3)}</td><td className="px-3 py-3">{formatItalianNumber(point.accuracyErrorPercent, 3)}</td><td className="px-3 py-3">{formatItalianNumber(point.repeatabilityErrorPercent, 3)}</td>
                      <td className="px-3 py-3"><span className={point.result === "CONFORME" ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800"}>{point.result || "-"}</span></td>
                      <td className="px-3 py-3"><button type="button" onClick={() => removePoint(point.id)} className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Elimina</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 p-5">
            <SimpleAccuracyChart title="Grafico errore accuratezza % - Dinamometria" lineColor="#d97706" points={calculatedPoints.map((point, index) => ({ label: point.nominalTorqueNm ? formatItalianNumber(point.nominalTorqueNm, 3) : "Punto " + String(index + 1), value: point.accuracyErrorPercent ?? 0 }))} />
          </div>

          <div className="border-t border-slate-200 p-5"><div className="flex justify-end"><button type="button" onClick={addPoint} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Aggiungi punto</button></div></div>
        </section>
      </fieldset>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salva misure dinamometriche
          </h2>
          <p className="text-sm text-slate-500">
            I valori vengono salvati nella tabella misure usando coppia nominale,
            tre letture, media, errore, errore percentuale e ripetibilità.
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
