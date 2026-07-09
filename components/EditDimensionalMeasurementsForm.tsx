"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type EditableDimensionalPoint = {
  id: string;
  measurementId: string | null;
  nominalValue: string;
  reading1: string;
  reading2: string;
  reading3: string;
  notes: string;
};

type DimensionalScaleSection = {
  scaleId: string;
  scaleName: string;
  scaleRange: string;
  points: EditableDimensionalPoint[];
};

type CalculatedDimensionalPoint = {
  id: string;
  nominalValue: number;
  reading1: number;
  reading2: number;
  reading3: number;
  average: number;
  min: number;
  max: number;
  error: number;
  errorPercent: number;
  repeatabilityPercent: number;
  instrumentalUncertainty: number;
};

type EditDimensionalMeasurementsFormProps = {
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

function emptyPoint(nominalValue = ""): EditableDimensionalPoint {
  return {
    id: crypto.randomUUID(),
    measurementId: null,
    nominalValue,
    reading1: "",
    reading2: "",
    reading3: "",
    notes: "",
  };
}

function buildSections(
  scales: InitialScale[],
  measurements: InitialMeasurement[]
): DimensionalScaleSection[] {
  const sortedScales = [...scales].sort((a, b) => a.scale_order - b.scale_order);

  return sortedScales.map((scale) => {
    const scaleMeasurements = measurements
      .filter((measurement) => measurement.scale_id === scale.id)
      .sort((a, b) => a.point_order - b.point_order);

    return {
      scaleId: scale.id,
      scaleName: scale.scale_name,
      scaleRange: scale.scale_range || "",
      points:
        scaleMeasurements.length > 0
          ? scaleMeasurements.map((measurement) => ({
              id: measurement.id || crypto.randomUUID(),
              measurementId: measurement.id,
              nominalValue: numberToInputValue(measurement.nominal_value),
              reading1: numberToInputValue(measurement.cycle_1),
              reading2: numberToInputValue(measurement.cycle_2),
              reading3: numberToInputValue(measurement.cycle_3),
              notes: measurement.notes || "",
            }))
          : [emptyPoint()],
    };
  });
}

function calculateDimensionalPoint(
  point: EditableDimensionalPoint
): CalculatedDimensionalPoint {
  const nominalValue = toNumber(point.nominalValue);
  const reading1 = toNumber(point.reading1);
  const reading2 = toNumber(point.reading2);
  const reading3 = toNumber(point.reading3);
  const values = [reading1, reading2, reading3];

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Formula da modello Excel DC/DSS - Controllo dimensionale:
  // Errore medio = valore nominale - media scostamenti
  // Errore accuratezza % = (valore nominale - media scostamenti) / valore nominale * 100
  // Errore ripetibilità % = (scostamento max - scostamento min) / media scostamenti * 100
  // Incertezza strumentale = |errore medio| * 2
  const error = nominalValue - average;
  const errorPercent = nominalValue !== 0 ? (error / nominalValue) * 100 : 0;
  const repeatabilityPercent = average !== 0 ? ((max - min) * 100) / average : 0;
  const instrumentalUncertainty = Math.abs(error * 2);

  return {
    id: point.id,
    nominalValue,
    reading1,
    reading2,
    reading3,
    average,
    min,
    max,
    error,
    errorPercent,
    repeatabilityPercent,
    instrumentalUncertainty,
  };
}

export default function EditDimensionalMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  initialScales,
  initialMeasurements,
  referenceInstruments,
}: EditDimensionalMeasurementsFormProps) {
  const [referenceInstrumentId, setReferenceInstrumentId] = useState(
    () => initialScales[0]?.reference_instrument_id || ""
  );
  const [scaleNotes, setScaleNotes] = useState(() => initialScales[0]?.notes || "");
  const [sections, setSections] = useState<DimensionalScaleSection[]>(() =>
    buildSections(initialScales, initialMeasurements)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const isReadOnly = reportStatus === "issued";

  const calculatedSections = useMemo(
    () =>
      sections.map((section) => section.points.map(calculateDimensionalPoint)),
    [sections]
  );

  const selectedReferenceInstrument = referenceInstruments.find(
    (instrument) => instrument.id === referenceInstrumentId
  );

  const selectedReferenceStatus = selectedReferenceInstrument
    ? effectiveStatus(selectedReferenceInstrument)
    : null;

  const hasBlockedReferenceInstrument =
    selectedReferenceStatus && isReferenceInstrumentBlocked(selectedReferenceStatus);

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function updatePoint(
    sectionIndex: number,
    pointId: string,
    field: keyof Omit<EditableDimensionalPoint, "id" | "measurementId">,
    value: string
  ) {
    const normalizedValue =
      field === "notes" ? value : normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setSections((current) =>
      current.map((section, index) =>
        index !== sectionIndex
          ? section
          : {
              ...section,
              points: section.points.map((point) =>
                point.id === pointId ? { ...point, [field]: normalizedValue } : point
              ),
            }
      )
    );
  }

  function addPoint(sectionIndex: number) {
    resetSaveState();

    setSections((current) =>
      current.map((section, index) => {
        if (index !== sectionIndex) {
          return section;
        }

        const lastPoint = section.points[section.points.length - 1];
        const nextNominalValue = lastPoint
          ? numberToInputValue(toNumber(lastPoint.nominalValue) + 10)
          : "";

        return {
          ...section,
          points: [...section.points, emptyPoint(nextNominalValue)],
        };
      })
    );
  }

  function removePoint(sectionIndex: number, pointId: string) {
    resetSaveState();

    setSections((current) =>
      current.map((section, index) =>
        index !== sectionIndex
          ? section
          : { ...section, points: section.points.filter((point) => point.id !== pointId) }
      )
    );
  }

  function validate() {
    if (!referenceInstrumentId) {
      throw new Error("Seleziona il campione di riferimento usato.");
    }

    if (!selectedReferenceInstrument) {
      throw new Error("Campione di riferimento usato non trovato.");
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error("Il campione di riferimento usato è scaduto o fuori servizio.");
    }

    const allPoints = sections.flatMap((section) => section.points);

    if (allPoints.length === 0) {
      throw new Error("Inserisci almeno un punto di verifica.");
    }

    const invalidPoint = allPoints.find((point) => {
      return (
        point.nominalValue.trim() === "" ||
        point.reading1.trim() === "" ||
        point.reading2.trim() === "" ||
        point.reading3.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error(
        "Compila valore nominale e i tre scostamenti per tutti i punti."
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

      if (!selectedReferenceInstrument) {
        throw new Error("Campione di riferimento usato non selezionato.");
      }

      const updatedSections: DimensionalScaleSection[] = [];

      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
        const section = sections[sectionIndex];
        const calculatedPoints = calculatedSections[sectionIndex];

        const { error: scaleError } = await supabase
          .from("calibration_record_scales")
          .update({
            reference_instrument_id: selectedReferenceInstrument.id,
            reference_instrument_snapshot: buildReferenceInstrumentSnapshot(
              selectedReferenceInstrument
            ),
            notes: scaleNotes.trim() || null,
          })
          .eq("id", section.scaleId);

        if (scaleError) {
          throw new Error(scaleError.message);
        }

        const keepMeasurementIds = section.points
          .map((point) => point.measurementId)
          .filter((id): id is string => Boolean(id));

        if (keepMeasurementIds.length > 0) {
          const { error: deleteMissingError } = await supabase
            .from("calibration_measurements")
            .delete()
            .eq("calibration_record_id", recordId)
            .eq("scale_id", section.scaleId)
            .not("id", "in", "(" + keepMeasurementIds.join(",") + ")");

          if (deleteMissingError) {
            throw new Error(deleteMissingError.message);
          }
        } else {
          const { error: deleteAllError } = await supabase
            .from("calibration_measurements")
            .delete()
            .eq("calibration_record_id", recordId)
            .eq("scale_id", section.scaleId);

          if (deleteAllError) {
            throw new Error(deleteAllError.message);
          }
        }

        const updatedPoints: EditableDimensionalPoint[] = [...section.points];

        for (let pointIndex = 0; pointIndex < calculatedPoints.length; pointIndex += 1) {
          const calculatedPoint = calculatedPoints[pointIndex];
          const editablePoint = section.points[pointIndex];

          const payload = {
            calibration_record_id: recordId,
            scale_id: section.scaleId,
            section: section.scaleName,
            point_order: pointIndex + 1,
            nominal_value: calculatedPoint.nominalValue,
            applied_value: calculatedPoint.nominalValue,
            cycle_1: calculatedPoint.reading1,
            cycle_2: calculatedPoint.reading2,
            cycle_3: calculatedPoint.reading3,
            max_value: calculatedPoint.max,
            min_value: calculatedPoint.min,
            average_value: calculatedPoint.average,
            mean_error: calculatedPoint.error,
            accuracy_error_percent: calculatedPoint.errorPercent,
            repeatability_error_percent: calculatedPoint.repeatabilityPercent,
            instrumental_uncertainty: calculatedPoint.instrumentalUncertainty,
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

        updatedSections.push({ ...section, points: updatedPoints });
      }

      setSections(updatedSections);

      await supabase
        .from("calibration_records")
        .update({ report_status: "draft" })
        .eq("id", recordId)
        .neq("report_status", "issued");

      setSaveMessage("Misure dimensionali aggiornate correttamente.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure dimensionali.";

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
              Dati tecnici dimensionale
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
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Campione di riferimento usato
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Campione di riferimento usato *
              </span>
              <select
                value={referenceInstrumentId}
                onChange={(event) => {
                  resetSaveState();
                  setReferenceInstrumentId(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleziona campione di riferimento</option>

                {referenceInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name || "Campione di riferimento"}
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

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Note (comuni ai blocchi)
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
          </div>

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
                    {formatItalianDate(selectedReferenceInstrument.certificate_expiry)}
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
                  Blocco: il campione di riferimento è scaduto o fuori servizio.
                </p>
              )}
            </div>
          )}
        </section>

        {sections.map((section, sectionIndex) => (
          <section
            key={section.scaleId}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {section.scaleName}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Punto</th>
                    <th className="px-4 py-3">Valore nominale (mm)</th>
                    <th className="bg-amber-100 px-4 py-3 text-amber-900">
                      Scostamento 1
                    </th>
                    <th className="bg-amber-100 px-4 py-3 text-amber-900">
                      Scostamento 2
                    </th>
                    <th className="bg-amber-100 px-4 py-3 text-amber-900">
                      Scostamento 3
                    </th>
                    <th className="px-4 py-3">Media</th>
                    <th className="px-4 py-3">Errore</th>
                    <th className="px-4 py-3">Errore %</th>
                    <th className="px-4 py-3">Ripetibilità %</th>
                    <th className="px-4 py-3">Incertezza (mm)</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {section.points.map((point, pointIndex) => {
                    const calculatedPoint = calculatedSections[sectionIndex][pointIndex];

                    return (
                      <tr key={point.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {pointIndex + 1}
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={point.nominalValue}
                            onChange={(event) =>
                              updatePoint(
                                sectionIndex,
                                point.id,
                                "nominalValue",
                                event.target.value
                              )
                            }
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1"
                          />
                        </td>

                        <td className="bg-amber-50 px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={point.reading1}
                            onChange={(event) =>
                              updatePoint(
                                sectionIndex,
                                point.id,
                                "reading1",
                                event.target.value
                              )
                            }
                            className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                        </td>

                        <td className="bg-amber-50 px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={point.reading2}
                            onChange={(event) =>
                              updatePoint(
                                sectionIndex,
                                point.id,
                                "reading2",
                                event.target.value
                              )
                            }
                            className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                        </td>

                        <td className="bg-amber-50 px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={point.reading3}
                            onChange={(event) =>
                              updatePoint(
                                sectionIndex,
                                point.id,
                                "reading3",
                                event.target.value
                              )
                            }
                            className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                        </td>

                        <td className="px-4 py-3">
                          {formatItalianNumber(calculatedPoint.average)}
                        </td>
                        <td className="px-4 py-3">
                          {formatItalianNumber(calculatedPoint.error)}
                        </td>
                        <td className="px-4 py-3">
                          {formatItalianNumber(calculatedPoint.errorPercent)}
                        </td>
                        <td className="px-4 py-3">
                          {formatItalianNumber(calculatedPoint.repeatabilityPercent)}
                        </td>
                        <td className="px-4 py-3">
                          {formatItalianNumber(calculatedPoint.instrumentalUncertainty)}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removePoint(sectionIndex, point.id)}
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
                  onClick={() => addPoint(sectionIndex)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Aggiungi punto
                </button>
              </div>
            </div>
          </section>
        ))}
      </fieldset>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salva misure dimensionali
          </h2>
          <p className="text-sm text-slate-500">
            Salva insieme tutti i blocchi di misura di questa verifica.
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
