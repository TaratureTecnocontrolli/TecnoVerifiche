"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

type EditableWeightPoint = {
  id: string;
  measurementId: string | null;
  nominalWeight: string;
  referenceWeight: string;
  reading1: string;
  reading2: string;
  reading3: string;
  notes: string;
};

type MassSection = {
  scaleId: string;
  points: EditableWeightPoint[];
};

type CalculatedWeightPoint = {
  id: string;
  nominalWeight: number;
  referenceWeight: number;
  reading1: number;
  reading2: number;
  reading3: number;
  average: number;
  min: number;
  max: number;
  error: number;
  errorPercent: number | null;
  repeatabilityPercent: number;
};

type EditMassMeasurementsFormProps = {
  recordId: string;
  recordNumber: string | null;
  reportStatus: string | null;
  isInternalVerification?: boolean;
  initialScales: InitialScale[];
  initialMeasurements: InitialMeasurement[];
  referenceInstruments: ReferenceInstrument[];
};

const ECCENTRICITY_ZONE_LABELS = ["Zona C", "Zona 3", "Zona 4", "Zona 1", "Zona 2"];

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

function formatItalianNumber(value: number | null | undefined, digits = 4) {
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

function emptyPoint(): EditableWeightPoint {
  return {
    id: crypto.randomUUID(),
    measurementId: null,
    nominalWeight: "",
    referenceWeight: "",
    reading1: "",
    reading2: "",
    reading3: "",
    notes: "",
  };
}

function buildSection(
  scales: InitialScale[],
  measurements: InitialMeasurement[],
  scaleOrder: number,
  defaultPointCount: number
): MassSection {
  const scale = scales.find((item) => item.scale_order === scaleOrder);

  const scaleMeasurements = scale
    ? measurements
        .filter((measurement) => measurement.scale_id === scale.id)
        .sort((a, b) => a.point_order - b.point_order)
    : [];

  return {
    scaleId: scale?.id || "",
    points:
      scaleMeasurements.length > 0
        ? scaleMeasurements.map((measurement) => ({
            id: measurement.id || crypto.randomUUID(),
            measurementId: measurement.id,
            nominalWeight: numberToInputValue(measurement.nominal_value),
            referenceWeight: numberToInputValue(measurement.applied_value),
            reading1: numberToInputValue(measurement.cycle_1),
            reading2: numberToInputValue(measurement.cycle_2),
            reading3: numberToInputValue(measurement.cycle_3),
            notes: measurement.notes || "",
          }))
        : Array.from({ length: defaultPointCount }, emptyPoint),
  };
}

function calculateWeightPoint(
  point: EditableWeightPoint,
  hasErrorPercent: boolean
): CalculatedWeightPoint {
  const nominalWeight = toNumber(point.nominalWeight);
  const referenceWeight = toNumber(point.referenceWeight);
  const reading1 = toNumber(point.reading1);
  const reading2 = toNumber(point.reading2);
  const reading3 = toNumber(point.reading3);
  const values = [reading1, reading2, reading3];

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Formula da modello Excel MMT - Misura della massa:
  // Errore = media letture - peso nominale
  // Errore % (solo prova di linearità) = (media letture / peso campione - 1) * 100
  // Ripetibilità % = (lettura max - lettura min) * 100 / media letture
  const error = average - nominalWeight;
  const errorPercent =
    hasErrorPercent && referenceWeight !== 0
      ? (average / referenceWeight - 1) * 100
      : null;
  const repeatabilityPercent = average !== 0 ? ((max - min) * 100) / average : 0;

  return {
    id: point.id,
    nominalWeight,
    referenceWeight,
    reading1,
    reading2,
    reading3,
    average,
    min,
    max,
    error,
    errorPercent,
    repeatabilityPercent,
  };
}

export default function EditMassMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  isInternalVerification = false,
  initialScales,
  initialMeasurements,
  referenceInstruments,
}: EditMassMeasurementsFormProps) {
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
  const [scaleNotes, setScaleNotes] = useState(
    () => initialScales[0]?.notes || ""
  );

  const [repeatability, setRepeatability] = useState<MassSection>(() =>
    buildSection(initialScales, initialMeasurements, 1, 1)
  );
  const [eccentricity, setEccentricity] = useState<MassSection>(() =>
    buildSection(initialScales, initialMeasurements, 2, 5)
  );
  const [linearity, setLinearity] = useState<MassSection>(() =>
    buildSection(initialScales, initialMeasurements, 3, 5)
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


  const calculatedRepeatability = useMemo(
    () => repeatability.points.map((point) => calculateWeightPoint(point, false)),
    [repeatability.points]
  );
  const calculatedEccentricity = useMemo(
    () => eccentricity.points.map((point) => calculateWeightPoint(point, false)),
    [eccentricity.points]
  );
  const calculatedLinearity = useMemo(
    () => linearity.points.map((point) => calculateWeightPoint(point, true)),
    [linearity.points]
  );

  const eccentricityValue = useMemo(() => {
    if (calculatedEccentricity.length < 2) {
      return null;
    }

    const sum = calculatedEccentricity.reduce(
      (total, point) => total + point.repeatabilityPercent,
      0
    );
    const average = sum / calculatedEccentricity.length;

    return average - calculatedEccentricity[0].repeatabilityPercent;
  }, [calculatedEccentricity]);

  const selectedReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) =>
      referenceInstrumentIds.includes(instrument.id)
    );
  }, [referenceInstruments, referenceInstrumentIds]);

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
    section: "repeatability" | "eccentricity" | "linearity",
    pointId: string,
    field: keyof Omit<EditableWeightPoint, "id" | "measurementId">,
    value: string
  ) {
    const normalizedValue =
      field === "notes" ? value : normalizeEuropeanDecimalInput(value);

    resetSaveState();

    const setter =
      section === "repeatability"
        ? setRepeatability
        : section === "eccentricity"
          ? setEccentricity
          : setLinearity;

    setter((current) => ({
      ...current,
      points: current.points.map((point) =>
        point.id === pointId ? { ...point, [field]: normalizedValue } : point
      ),
    }));
  }

  function addLinearityPoint() {
    resetSaveState();

    setLinearity((current) => {
      const lastPoint = current.points[current.points.length - 1];

      return {
        ...current,
        points: [
          ...current.points,
          {
            ...emptyPoint(),
            nominalWeight: lastPoint
              ? numberToInputValue(toNumber(lastPoint.nominalWeight) + 100)
              : "",
            referenceWeight: lastPoint
              ? numberToInputValue(toNumber(lastPoint.referenceWeight) + 100)
              : "",
          },
        ],
      };
    });
  }

  function removeLinearityPoint(pointId: string) {
    resetSaveState();

    setLinearity((current) => ({
      ...current,
      points: current.points.filter((point) => point.id !== pointId),
    }));
  }

  function validate() {
    if (selectedReferenceInstruments.length === 0) {
      throw new Error("Seleziona almeno una massa campione usata.");
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error(
        "Una delle masse campione usate è scaduta o fuori servizio."
      );
    }

    const allPoints = [
      ...repeatability.points,
      ...eccentricity.points,
      ...linearity.points,
    ];

    const invalidPoint = allPoints.find((point) => {
      return (
        point.nominalWeight.trim() === "" ||
        point.referenceWeight.trim() === "" ||
        point.reading1.trim() === "" ||
        point.reading2.trim() === "" ||
        point.reading3.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error(
        "Compila peso nominale, peso campione e le tre letture per tutti i punti delle tre prove."
      );
    }
  }

  async function ensureScaleExists(
    scaleId: string,
    scaleOrder: number,
    scaleName: string,
    setSection: (updater: (current: MassSection) => MassSection) => void
  ) {
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
        scale_order: scaleOrder,
        scale_name: scaleName,
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
        insertScaleError?.message || "Errore durante la creazione della prova."
      );
    }

    setSection((current) => ({ ...current, scaleId: insertedScale.id }));

    return insertedScale.id as string;
  }

  async function saveSection(
    scaleId: string,
    scaleName: string,
    points: EditableWeightPoint[],
    calculatedPoints: CalculatedWeightPoint[]
  ) {
    const referenceSnapshots = selectedReferenceInstruments.map(
      buildReferenceInstrumentSnapshot
    );
    const primaryReference = selectedReferenceInstruments[0];

    const { error: scaleError } = await supabase
      .from("calibration_record_scales")
      .update({
        scale_name: scaleName,
        reference_instrument_id: primaryReference.id,
        reference_instrument_snapshot: referenceSnapshots[0],
        reference_instrument_ids: selectedReferenceInstruments.map(
          (instrument) => instrument.id
        ),
        reference_instruments_snapshot: referenceSnapshots,
        notes: scaleNotes.trim() || null,
      })
      .eq("id", scaleId);

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

    const updatedPoints: EditableWeightPoint[] = [...points];

    for (let pointIndex = 0; pointIndex < calculatedPoints.length; pointIndex += 1) {
      const calculatedPoint = calculatedPoints[pointIndex];
      const editablePoint = points[pointIndex];

      const payload = {
        calibration_record_id: recordId,
        scale_id: scaleId,
        section: scaleName,
        point_order: pointIndex + 1,
        nominal_value: calculatedPoint.nominalWeight,
        applied_value: calculatedPoint.referenceWeight,
        cycle_1: calculatedPoint.reading1,
        cycle_2: calculatedPoint.reading2,
        cycle_3: calculatedPoint.reading3,
        max_value: calculatedPoint.max,
        min_value: calculatedPoint.min,
        average_value: calculatedPoint.average,
        mean_error: calculatedPoint.error,
        accuracy_error_percent: calculatedPoint.errorPercent,
        repeatability_error_percent: calculatedPoint.repeatabilityPercent,
        result: null,
        notes: editablePoint.notes.trim() || null,
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
        const { data: insertedMeasurement, error: insertError } = await supabase
          .from("calibration_measurements")
          .insert(payload)
          .select("id")
          .single();

        if (insertError || !insertedMeasurement) {
          throw new Error(
            insertError?.message || "Errore durante l’inserimento del punto."
          );
        }

        updatedPoints[pointIndex] = {
          ...editablePoint,
          measurementId: insertedMeasurement.id,
        };
      }
    }

    return updatedPoints;
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

      const repeatabilityScaleId = await ensureScaleExists(
        repeatability.scaleId,
        1,
        "Ripetibilità",
        setRepeatability
      );
      const eccentricityScaleId = await ensureScaleExists(
        eccentricity.scaleId,
        2,
        "Eccentricità",
        setEccentricity
      );
      const linearityScaleId = await ensureScaleExists(
        linearity.scaleId,
        3,
        "Linearità",
        setLinearity
      );

      const updatedRepeatabilityPoints = await saveSection(
        repeatabilityScaleId,
        "Ripetibilità",
        repeatability.points,
        calculatedRepeatability
      );
      setRepeatability((current) => ({
        ...current,
        scaleId: repeatabilityScaleId,
        points: updatedRepeatabilityPoints,
      }));

      const updatedEccentricityPoints = await saveSection(
        eccentricityScaleId,
        "Eccentricità",
        eccentricity.points,
        calculatedEccentricity
      );
      setEccentricity((current) => ({
        ...current,
        scaleId: eccentricityScaleId,
        points: updatedEccentricityPoints,
      }));

      const updatedLinearityPoints = await saveSection(
        linearityScaleId,
        "Linearità",
        linearity.points,
        calculatedLinearity
      );
      setLinearity((current) => ({
        ...current,
        scaleId: linearityScaleId,
        points: updatedLinearityPoints,
      }));

      await supabase
        .from("calibration_records")
        .update({ report_status: "draft" })
        .eq("id", recordId)
        .neq("report_status", "issued");

      setSaveMessage(
        "Misure massa (ripetibilità, eccentricità, linearità) aggiornate correttamente."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure massa.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  function renderPointRow(
    section: "repeatability" | "eccentricity" | "linearity",
    editablePoint: EditableWeightPoint,
    calculatedPoint: CalculatedWeightPoint,
    label: string,
    onRemove?: () => void
  ) {
    return (
      <tr key={editablePoint.id} className="hover:bg-slate-50">
        <td className="px-4 py-3 font-medium text-slate-700">{label}</td>

        <td className="px-4 py-3">
          <input
            type="text"
            inputMode="decimal"
            value={editablePoint.nominalWeight}
            onChange={(event) =>
              updatePoint(section, editablePoint.id, "nominalWeight", event.target.value)
            }
            className="w-24 rounded-lg border border-slate-300 px-2 py-1"
          />
        </td>

        <td className="px-4 py-3">
          <input
            type="text"
            inputMode="decimal"
            value={editablePoint.referenceWeight}
            onChange={(event) =>
              updatePoint(section, editablePoint.id, "referenceWeight", event.target.value)
            }
            className="w-24 rounded-lg border border-slate-300 px-2 py-1"
          />
        </td>

        <td className="bg-amber-50 px-4 py-3">
          <input
            type="text"
            inputMode="decimal"
            value={editablePoint.reading1}
            onChange={(event) =>
              updatePoint(section, editablePoint.id, "reading1", event.target.value)
            }
            className="w-20 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </td>

        <td className="bg-amber-50 px-4 py-3">
          <input
            type="text"
            inputMode="decimal"
            value={editablePoint.reading2}
            onChange={(event) =>
              updatePoint(section, editablePoint.id, "reading2", event.target.value)
            }
            className="w-20 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </td>

        <td className="bg-amber-50 px-4 py-3">
          <input
            type="text"
            inputMode="decimal"
            value={editablePoint.reading3}
            onChange={(event) =>
              updatePoint(section, editablePoint.id, "reading3", event.target.value)
            }
            className="w-20 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </td>

        <td className="px-4 py-3">{formatItalianNumber(calculatedPoint.average)}</td>
        <td className="px-4 py-3">{formatItalianNumber(calculatedPoint.error)}</td>

        {calculatedPoint.errorPercent !== null && (
          <td className="px-4 py-3">{formatItalianNumber(calculatedPoint.errorPercent)}</td>
        )}

        <td className="px-4 py-3">
          {formatItalianNumber(calculatedPoint.repeatabilityPercent)}
        </td>

        {onRemove && (
          <td className="px-4 py-3">
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Elimina
            </button>
          </td>
        )}
      </tr>
    );
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
              Dati tecnici massa
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
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Masse campione usate
          </h2>

          <div className="mt-5">
            <ReferenceInstrumentMultiSelect
              instruments={referenceInstruments}
              selectedIds={referenceInstrumentIds}
              onToggle={toggleReferenceInstrument}
              label="Masse campione usate *"
            />
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Note (comuni alle tre prove)
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
                        <p className="font-semibold">Massa</p>
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
                        Blocco: questa massa campione è scaduta o fuori
                        servizio.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Verifica di ripetibilità
            </h2>
            <p className="text-sm text-slate-500">
              Un unico punto di carico, tre letture ripetute.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Punto</th>
                  <th className="px-4 py-3">Peso nominale (g)</th>
                  <th className="px-4 py-3">Peso campione (g)</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 1</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 2</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 3</th>
                  <th className="px-4 py-3">Media</th>
                  <th className="px-4 py-3">Errore (g)</th>
                  <th className="px-4 py-3">Ripetibilità %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {repeatability.points.map((point, index) =>
                  renderPointRow(
                    "repeatability",
                    point,
                    calculatedRepeatability[index],
                    "Zona C"
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Verifica di eccentricità
            </h2>
            <p className="text-sm text-slate-500">
              Zona centrale (C) e quattro zone periferiche del piatto di pesata.
              {eccentricityValue !== null && (
                <>
                  {" "}
                  Eccentricità (Zona C):{" "}
                  <strong>{formatItalianNumber(eccentricityValue)}%</strong>
                </>
              )}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Peso nominale (g)</th>
                  <th className="px-4 py-3">Peso campione (g)</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 1</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 2</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 3</th>
                  <th className="px-4 py-3">Media</th>
                  <th className="px-4 py-3">Errore (g)</th>
                  <th className="px-4 py-3">Ripetibilità %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eccentricity.points.map((point, index) =>
                  renderPointRow(
                    "eccentricity",
                    point,
                    calculatedEccentricity[index],
                    ECCENTRICITY_ZONE_LABELS[index] || "Zona " + (index + 1)
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Verifica di linearità
            </h2>
            <p className="text-sm text-slate-500">
              Punti distribuiti sull&apos;intero campo di pesata dello strumento.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Punto</th>
                  <th className="px-4 py-3">Peso nominale (g)</th>
                  <th className="px-4 py-3">Peso campione (g)</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 1</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 2</th>
                  <th className="bg-amber-100 px-4 py-3 text-amber-900">Lettura 3</th>
                  <th className="px-4 py-3">Media</th>
                  <th className="px-4 py-3">Errore (g)</th>
                  <th className="px-4 py-3">Errore %</th>
                  <th className="px-4 py-3">Ripetibilità %</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linearity.points.map((point, index) =>
                  renderPointRow(
                    "linearity",
                    point,
                    calculatedLinearity[index],
                    String(index + 1),
                    () => removeLinearityPoint(point.id)
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 p-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addLinearityPoint}
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
            Salva misure massa
          </h2>
          <p className="text-sm text-slate-500">
            Salva insieme le tre prove: ripetibilità, eccentricità e linearità.
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
