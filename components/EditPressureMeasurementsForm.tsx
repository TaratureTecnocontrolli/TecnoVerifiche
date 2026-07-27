"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calculatePressurePoints,
  type PressurePhase,
  type PressurePointInput} from "@/lib/calculations/pressure";
import { supabase } from "@/lib/supabase";
import PressureErrorChart from "./PressureErrorChart";
import ReferenceInstrumentMultiSelect from "./ReferenceInstrumentMultiSelect";

type ReferenceInstrument = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  certificate_number: string | null;
  certificate_expiry: string | null;
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
  section: string;
  nominal_value: number | null;
  applied_value: number | null;
  cycle_1: number | null;
  cycle_2: number | null;
  cycle_3: null,
  max_value: number | null;
  min_value: number | null;
  average_value: number | null;
  mean_error: number | null;
  accuracy_error_percent: number | null;
  repeatability_error_percent: number | null;
  result: string | null;
  notes: string | null;
};

type EditablePressurePoint = {
  id: string;
  measurementId: string | null;
  phase: PressurePhase;
  verificationPoint: string;
  appliedValue: string;
  reading1: string;
  reading2: string;
};

type EditableScale = {
  id: string;
  scaleId: string;
  scaleName: string;
  scaleRange: string;
  referenceInstrumentIds: string[];
  notes: string;
  points: EditablePressurePoint[];
};

type EditPressureMeasurementsFormProps = {
  recordId: string;
  recordNumber: string | null;
  reportStatus: string | null;
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

function formatItalianNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 4}).format(value);
}

function formatItalianDate(date: string | null) {
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
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

function buildReferenceInstrumentSnapshot(
  instrument: ReferenceInstrument | undefined
) {
  if (!instrument) {
    return null;
  }

  return {
    instrument_id: instrument.id,
    name: instrument.name,
    manufacturer: instrument.manufacturer,
    model: instrument.model,
    serial_number: instrument.serial_number,
    internal_code: instrument.internal_code,
    measurement_quantity: instrument.measurement_quantity,
    unit: instrument.unit,
    measurement_range: instrument.measurement_range,
    certificate_number: instrument.certificate_number,
    certificate_expiry: instrument.certificate_expiry,
    status: instrument.status};
}

function editablePointToPressurePoint(
  point: EditablePressurePoint
): PressurePointInput {
  return {
    id: point.id,
    phase: point.phase,
    verificationPoint: toNumber(point.verificationPoint),
    appliedValue: toNumber(point.appliedValue),
    reading1: toNumber(point.reading1),
    reading2: toNumber(point.reading2)};
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
    firstScale?.reference_instrument_ids &&
    firstScale.reference_instrument_ids.length > 0
      ? firstScale.reference_instrument_ids
      : firstScale?.reference_instrument_id
        ? [firstScale.reference_instrument_id]
        : [];

  return {
    id: firstScale?.id || "pressure-scale",
    scaleId: firstScale?.id || "",
    scaleName: firstScale?.scale_name || "Scala pressione",
    scaleRange: firstScale?.scale_range || "",
    referenceInstrumentIds,
    notes: firstScale?.notes || "",
    points: scaleMeasurements.map((measurement) => ({
      id: measurement.id || crypto.randomUUID(),
      measurementId: measurement.id,
      phase:
        measurement.section?.toLowerCase() === "scarico"
          ? "scarico"
          : "carico",
      verificationPoint: numberToInputValue(measurement.nominal_value),
      appliedValue: numberToInputValue(measurement.applied_value),
      reading1: numberToInputValue(measurement.cycle_1),
      reading2: numberToInputValue(measurement.cycle_2)}))};
}

export default function EditPressureMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  initialScales,
  initialMeasurements,
  referenceInstruments}: EditPressureMeasurementsFormProps) {
  const [scale, setScale] = useState<EditableScale>(() =>
    buildEditableScale(initialScales, initialMeasurements)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const isReadOnly = reportStatus === "issued";

  const calculatedPoints = useMemo(() => {
    return calculatePressurePoints(
      scale.points.map((point) => editablePointToPressurePoint(point))
    );
  }, [scale.points]);

  const loadPoints = useMemo(
    () => calculatedPoints.filter((point) => point.phase === "carico"),
    [calculatedPoints]
  );

  const unloadPoints = useMemo(
    () => calculatedPoints.filter((point) => point.phase === "scarico"),
    [calculatedPoints]
  );

  const selectedReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) =>
      scale.referenceInstrumentIds.includes(instrument.id)
    );
  }, [referenceInstruments, scale.referenceInstrumentIds]);

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    (instrument) => isReferenceInstrumentBlocked(instrument.status)
  );

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function updateScaleField(
    field: keyof Omit<
      EditableScale,
      "id" | "scaleId" | "points" | "referenceInstrumentIds"
    >,
    value: string
  ) {
    resetSaveState();
    setScale((currentScale) => ({
      ...currentScale,
      [field]: value}));
  }

  function toggleReferenceInstrument(instrumentId: string) {
    resetSaveState();

    setScale((currentScale) => ({
      ...currentScale,
      referenceInstrumentIds: currentScale.referenceInstrumentIds.includes(
        instrumentId
      )
        ? currentScale.referenceInstrumentIds.filter(
            (id) => id !== instrumentId
          )
        : [...currentScale.referenceInstrumentIds, instrumentId]}));
  }

  function updatePoint(
    pointId: string,
    field: keyof Omit<EditablePressurePoint, "id" | "measurementId">,
    value: string
  ) {
    const normalizedValue = normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setScale((currentScale) => ({
      ...currentScale,
      points: currentScale.points.map((point) =>
        point.id === pointId ? { ...point, [field]: normalizedValue } : point
      )}));
  }

  function addPoint(phase: PressurePhase) {
    resetSaveState();

    setScale((currentScale) => {
      const phasePoints = currentScale.points.filter(
        (point) => point.phase === phase
      );
      const lastPoint = phasePoints[phasePoints.length - 1];
      const nextAppliedValue = lastPoint
        ? toNumber(lastPoint.appliedValue) + (phase === "carico" ? 1 : -1)
        : phase === "carico"
          ? 1
          : 0;

      return {
        ...currentScale,
        points: [
          ...currentScale.points,
          {
            id: crypto.randomUUID(),
            measurementId: null,
            phase,
            verificationPoint: numberToInputValue(nextAppliedValue),
            appliedValue: numberToInputValue(nextAppliedValue),
            reading1: "",
            reading2: ""},
        ]};
    });
  }

  function removePoint(pointId: string) {
    resetSaveState();

    setScale((currentScale) => ({
      ...currentScale,
      points: currentScale.points.filter((point) => point.id !== pointId)}));
  }

  function validate() {
    if (!scale.scaleName.trim()) {
      throw new Error("Inserisci il nome della scala.");
    }

    if (scale.referenceInstrumentIds.length === 0) {
      throw new Error("Seleziona almeno uno strumento campione usato.");
    }

    if (selectedReferenceInstruments.length !== scale.referenceInstrumentIds.length) {
      throw new Error("Strumento campione usato non trovato.");
    }

    if (
      selectedReferenceInstruments.some((instrument) =>
        isReferenceInstrumentBlocked(instrument.status)
      )
    ) {
      throw new Error(
        "Uno strumento campione usato è scaduto o fuori servizio."
      );
    }

    if (scale.points.length === 0) {
      throw new Error("Inserisci almeno un punto di misura.");
    }

    const invalidPoint = scale.points.find((point) => {
      return (
        point.verificationPoint.trim() === "" ||
        point.appliedValue.trim() === "" ||
        point.reading1.trim() === "" ||
        point.reading2.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error(
        "Compila punti di verifica, carico applicato e le due letture per tutti i punti."
      );
    }
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

      const primaryReferenceInstrument = selectedReferenceInstruments[0];

      if (!primaryReferenceInstrument) {
        throw new Error("Strumento campione usato non selezionato.");
      }

      const { error: scaleError } = await supabase
        .from("calibration_record_scales")
        .update({
          scale_order: 1,
          scale_name: scale.scaleName.trim(),
          scale_range: scale.scaleRange.trim() || null,
          reference_instrument_id: primaryReferenceInstrument.id,
          reference_instrument_snapshot: buildReferenceInstrumentSnapshot(
            primaryReferenceInstrument
          ),
          reference_instrument_ids: selectedReferenceInstruments.map(
            (instrument) => instrument.id
          ),
          reference_instruments_snapshot: selectedReferenceInstruments.map(
            (instrument) => buildReferenceInstrumentSnapshot(instrument)
          ),
          notes: scale.notes.trim() || null})
        .eq("id", scale.scaleId);

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
          .eq("scale_id", scale.scaleId)
          .not("id", "in", "(" + keepMeasurementIds.join(",") + ")");

        if (deleteMissingError) {
          throw new Error(deleteMissingError.message);
        }
      } else {
        const { error: deleteAllError } = await supabase
          .from("calibration_measurements")
          .delete()
          .eq("calibration_record_id", recordId)
          .eq("scale_id", scale.scaleId);

        if (deleteAllError) {
          throw new Error(deleteAllError.message);
        }
      }

      for (let pointIndex = 0; pointIndex < calculatedPoints.length; pointIndex += 1) {
        const calculatedPoint = calculatedPoints[pointIndex];
        const editablePoint = scale.points[pointIndex];

        const payload = {
          calibration_record_id: recordId,
          scale_id: scale.scaleId,
          section: calculatedPoint.phase === "scarico" ? "Scarico" : "Carico",
          point_order: pointIndex + 1,
          nominal_value: calculatedPoint.verificationPoint,
          applied_value: calculatedPoint.appliedValue,
          cycle_1: calculatedPoint.reading1,
          cycle_2: calculatedPoint.reading2,
          cycle_3: null,
          max_value: calculatedPoint.maxReading,
          min_value: calculatedPoint.minReading,
          average_value: calculatedPoint.averageReading,
          mean_error: calculatedPoint.meanError,
          accuracy_error_percent: calculatedPoint.accuracyErrorPercent,
          repeatability_error_percent: calculatedPoint.repeatabilityErrorPercent,
          result: null,
          notes: null};

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
            points: currentScale.points.map((currentPoint) =>
              currentPoint.id === editablePoint.id
                ? {
                    ...currentPoint,
                    measurementId: insertedMeasurement.id}
                : currentPoint
            )}));
        }
      }

      await supabase
        .from("calibration_records")
        .update({
          report_status: "draft"})
        .eq("id", recordId)
        .neq("report_status", "issued");

      setSaveMessage("Misure pressione aggiornate correttamente.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure pressione.";

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
              Dati tecnici pressione
            </h2>
            <p className="text-sm text-slate-500">
              Verifica interna: {recordNumber || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={"/verifiche/" + recordId + "/rapporto"}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dati rapporto
            </Link>

            <Link
              href={"/verifiche/" + recordId + "/rapporto/finale"}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Rapporto
            </Link>
          </div>
        </div>
      </section>

      <fieldset disabled={isReadOnly} className="space-y-6 disabled:opacity-70">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Prova di misurazione della pressione
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
                  Fondo scala
                </span>
                <input
                  value={scale.scaleRange}
                  onChange={(event) =>
                    updateScaleField("scaleRange", event.target.value)
                  }
                  placeholder="Es. 0 - 10 bar"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="lg:col-span-2">
                <ReferenceInstrumentMultiSelect
                  instruments={referenceInstruments}
                  selectedIds={scale.referenceInstrumentIds}
                  onToggle={toggleReferenceInstrument}
                  label="Strumenti campione usati *"
                />
              </div>
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

            {selectedReferenceInstruments.length > 0 && (
              <div className="mt-5 space-y-3">
                {selectedReferenceInstruments.map((instrument) => (
                  <div
                    key={instrument.id}
                    className={
                      "rounded-xl border p-4 text-sm " +
                      statusClass(instrument.status)
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <p className="font-semibold">Strumento</p>
                        <p>{instrument.name}</p>
                      </div>

                      <div>
                        <p className="font-semibold">Stato</p>
                        <p>{statusLabel(instrument.status)}</p>
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
                        <p>{instrument.measurement_range ?? "-"}</p>
                      </div>
                    </div>

                    {isReferenceInstrumentBlocked(instrument.status) && (
                      <p className="mt-3 font-medium">
                        Blocco: lo strumento campione è scaduto o fuori
                        servizio.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {[
            { phase: "carico" as PressurePhase, title: "Prova in carico", rows: loadPoints },
            { phase: "scarico" as PressurePhase, title: "Prova in scarico", rows: unloadPoints },
          ].map((phaseBlock) => (
            <div key={phaseBlock.phase} className="border-t border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-5 py-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                    {phaseBlock.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {phaseBlock.phase === "carico"
                      ? "Punti a salire fino al raggiungimento dei bar prefissati."
                      : "Punti a scendere usando gli stessi punti della fase di carico."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => addPoint(phaseBlock.phase)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Aggiungi punto
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="text-center text-xs uppercase tracking-wide text-slate-700">
                    <tr className="border-y border-slate-300">
                      <th className="bg-orange-200 px-3 py-3 text-orange-950">
                        Punti di verifica
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="bg-lime-200 px-3 py-3 text-lime-950">
                        Carico applicato
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="bg-sky-200 px-3 py-3 text-sky-950">
                        Lettura I° ciclo
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="bg-sky-200 px-3 py-3 text-sky-950">
                        Lettura II° ciclo
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="px-3 py-3">
                        Lettura Max
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="px-3 py-3">
                        Lettura Min
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="px-3 py-3">
                        Media Lettura
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="px-3 py-3">
                        Errore Medio
                        <br />
                        <span className="font-normal lowercase">bar</span>
                      </th>
                      <th className="px-3 py-3">
                        Errore accuratezza
                        <br />
                        <span className="font-normal">%</span>
                      </th>
                      <th className="px-3 py-3">
                        Errore ripetibilità
                        <br />
                        <span className="font-normal">%</span>
                      </th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 text-center">
                    {phaseBlock.rows.map((point) => {
                      const editablePoint = scale.points.find(
                        (item) => item.id === point.id
                      );

                      return (
                        <tr key={point.id} className="hover:bg-slate-50">
                          <td className="bg-orange-50 px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editablePoint?.verificationPoint ?? ""}
                              onChange={(event) =>
                                updatePoint(
                                  point.id,
                                  "verificationPoint",
                                  event.target.value
                                )
                              }
                              className="w-24 rounded-lg border border-orange-300 bg-orange-50 px-2 py-1 text-center font-semibold text-orange-950"
                            />
                          </td>

                          <td className="bg-lime-50 px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editablePoint?.appliedValue ?? ""}
                              onChange={(event) =>
                                updatePoint(
                                  point.id,
                                  "appliedValue",
                                  event.target.value
                                )
                              }
                              className="w-24 rounded-lg border border-lime-300 bg-lime-50 px-2 py-1 text-center font-semibold text-lime-950"
                            />
                          </td>

                          <td className="bg-sky-50 px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editablePoint?.reading1 ?? ""}
                              onChange={(event) =>
                                updatePoint(point.id, "reading1", event.target.value)
                              }
                              className="w-24 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-center font-semibold text-sky-950"
                            />
                          </td>

                          <td className="bg-sky-50 px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editablePoint?.reading2 ?? ""}
                              onChange={(event) =>
                                updatePoint(point.id, "reading2", event.target.value)
                              }
                              className="w-24 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-center font-semibold text-sky-950"
                            />
                          </td>

                          <td className="px-3 py-2">
                            {formatItalianNumber(point.maxReading)}
                          </td>
                          <td className="px-3 py-2">
                            {formatItalianNumber(point.minReading)}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {formatItalianNumber(point.averageReading)}
                          </td>
                          <td className="px-3 py-2">
                            {formatItalianNumber(point.meanError)}
                          </td>
                          <td className="px-3 py-2">
                            {formatItalianNumber(point.accuracyErrorPercent)}
                          </td>
                          <td className="px-3 py-2">
                            {formatItalianNumber(point.repeatabilityErrorPercent)}
                          </td>
                          <td className="px-3 py-2">
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
                <PressureErrorChart
                  points={phaseBlock.rows}
                  title={"Grafico errore accuratezza % - " + phaseBlock.title}
                />
              </div>
            </div>
          ))}
        </section>
      </fieldset>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salva misure pressione
          </h2>
          <p className="text-sm text-slate-500">
            Dopo il salvataggio il rapporto torna in bozza, così il controllo
            completezza viene rieseguito prima dell’emissione.
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
