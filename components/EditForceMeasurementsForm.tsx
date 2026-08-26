"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calculateForcePoints,
  type ForcePointInput,
} from "@/lib/calculations/force";
import { supabase } from "@/lib/supabase";
import ForceErrorChart from "./ForceErrorChart";
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
  appliedValue: string;
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

type CalculatedScale = EditableScale & {
  calculatedPoints: ReturnType<typeof calculateForcePoints>;
};

type EditForceMeasurementsFormProps = {
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
  if (value === null || value === undefined) {
    return "-";
  }

  if (!Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 4,
  }).format(value);
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
    status: instrument.status,
  };
}

function editablePointToForcePoint(point: EditablePoint): ForcePointInput {
  const appliedValue = toNumber(point.appliedValue);

  return {
    id: point.id,
    nominalValue: appliedValue,
    appliedValue,
    cycle1: toNumber(point.cycle1),
    cycle2: toNumber(point.cycle2),
    cycle3: toNumber(point.cycle3),
  };
}

function buildEditableScales(
  scales: InitialScale[],
  measurements: InitialMeasurement[]
): EditableScale[] {
  return scales
    .sort((a, b) => a.scale_order - b.scale_order)
    .map((scale, index) => {
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
        scaleName: scale.scale_name || "Scala " + String(index + 1),
        scaleRange: scale.scale_range || "",
        referenceInstrumentIds,
        notes: scale.notes || "",
        points: scaleMeasurements.map((measurement) => ({
          id: measurement.id || crypto.randomUUID(),
          measurementId: measurement.id,
          appliedValue: numberToInputValue(measurement.applied_value),
          cycle1: numberToInputValue(measurement.cycle_1),
          cycle2: numberToInputValue(measurement.cycle_2),
          cycle3: numberToInputValue(measurement.cycle_3),
        })),
      };
    });
}

export default function EditForceMeasurementsForm({
  recordId,
  recordNumber,
  reportStatus,
  isInternalVerification = false,
  initialScales,
  initialMeasurements,
  referenceInstruments,
}: EditForceMeasurementsFormProps) {
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


  const calculatedScales = useMemo<CalculatedScale[]>(() => {
    return scales.map((scale) => {
      const numericPoints = scale.points.map((point) =>
        editablePointToForcePoint(point)
      );

      return {
        ...scale,
        calculatedPoints: calculateForcePoints(numericPoints),
      };
    });
  }, [scales]);

  const hasBlockedReferenceInstrument = scales.some((scale) =>
    scale.referenceInstrumentIds.some((instrumentId) => {
      const instrument = referenceInstruments.find(
        (item) => item.id === instrumentId
      );

      if (!instrument) {
        return false;
      }

      return isReferenceInstrumentBlocked(instrument.status);
    })
  );

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function getReferenceInstrument(referenceInstrumentId: string) {
    return referenceInstruments.find(
      (instrument) => instrument.id === referenceInstrumentId
    );
  }

  function updateScale(
    scaleId: string,
    field: keyof Omit<
      EditableScale,
      "id" | "scaleId" | "points" | "referenceInstrumentIds"
    >,
    value: string
  ) {
    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) =>
        scale.id === scaleId ? { ...scale, [field]: value } : scale
      )
    );
  }

  function toggleReferenceInstrument(scaleId: string, instrumentId: string) {
    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) => {
        if (scale.id !== scaleId) {
          return scale;
        }

        const isSelected = scale.referenceInstrumentIds.includes(instrumentId);

        return {
          ...scale,
          referenceInstrumentIds: isSelected
            ? scale.referenceInstrumentIds.filter((id) => id !== instrumentId)
            : [...scale.referenceInstrumentIds, instrumentId],
        };
      })
    );
  }

  function updatePoint(
    scaleId: string,
    pointId: string,
    field: keyof Omit<EditablePoint, "id" | "measurementId">,
    value: string
  ) {
    const normalizedValue = normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) => {
        if (scale.id !== scaleId) {
          return scale;
        }

        return {
          ...scale,
          points: scale.points.map((point) =>
            point.id === pointId
              ? { ...point, [field]: normalizedValue }
              : point
          ),
        };
      })
    );
  }

  function addPoint(scaleId: string) {
    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) => {
        if (scale.id !== scaleId) {
          return scale;
        }

        const lastPoint = scale.points[scale.points.length - 1];
        const nextAppliedValue = lastPoint
          ? toNumber(lastPoint.appliedValue) + 50
          : 50;

        return {
          ...scale,
          points: [
            ...scale.points,
            {
              id: crypto.randomUUID(),
              measurementId: null,
              appliedValue: numberToInputValue(nextAppliedValue),
              cycle1: "",
              cycle2: "",
              cycle3: "",
            },
          ],
        };
      })
    );
  }

  function removePoint(scaleId: string, pointId: string) {
    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) => {
        if (scale.id !== scaleId) {
          return scale;
        }

        return {
          ...scale,
          points: scale.points.filter((point) => point.id !== pointId),
        };
      })
    );
  }

  function validateScales() {
    if (scales.length === 0) {
      throw new Error("Deve essere presente almeno una scala.");
    }

    for (let index = 0; index < scales.length; index += 1) {
      const scale = scales[index];
      const scaleLabel = scale.scaleName || "Scala " + String(index + 1);

      if (!scale.scaleName.trim()) {
        throw new Error("Inserisci il nome della scala " + String(index + 1) + ".");
      }

      if (scale.referenceInstrumentIds.length === 0) {
        throw new Error(
          "Seleziona almeno uno strumento campione usato per " + scaleLabel + "."
        );
      }

      const scaleReferenceInstruments = scale.referenceInstrumentIds
        .map((instrumentId) => getReferenceInstrument(instrumentId))
        .filter(Boolean) as ReferenceInstrument[];

      if (scaleReferenceInstruments.length !== scale.referenceInstrumentIds.length) {
        throw new Error("Strumento campione usato non trovato per " + scaleLabel + ".");
      }

      if (
        scaleReferenceInstruments.some((referenceInstrument) =>
          isReferenceInstrumentBlocked(referenceInstrument.status)
        )
      ) {
        throw new Error(
          "Uno strumento campione usato per " +
            scaleLabel +
            " è scaduto o fuori servizio."
        );
      }

      if (scale.points.length === 0) {
        throw new Error("Inserisci almeno un punto di misura per " + scaleLabel + ".");
      }

      const invalidPoint = scale.points.find((point) => {
        return (
          point.appliedValue.trim() === "" ||
          point.cycle1.trim() === "" ||
          point.cycle2.trim() === "" ||
          point.cycle3.trim() === ""
        );
      });

      if (invalidPoint) {
        throw new Error(
          "Compila carico applicato e tutti i cicli di verifica per " +
            scaleLabel +
            "."
        );
      }
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
      validateScales();

      for (let scaleIndex = 0; scaleIndex < calculatedScales.length; scaleIndex += 1) {
        const scale = calculatedScales[scaleIndex];
        const scaleReferenceInstruments = scale.referenceInstrumentIds
          .map((instrumentId) => getReferenceInstrument(instrumentId))
          .filter(Boolean) as ReferenceInstrument[];
        const primaryReferenceInstrument = scaleReferenceInstruments[0];

        const { error: scaleError } = await supabase
          .from("calibration_record_scales")
          .update({
            scale_order: scaleIndex + 1,
            scale_name: scale.scaleName.trim(),
            scale_range: scale.scaleRange.trim() || null,
            reference_instrument_id: primaryReferenceInstrument?.id ?? null,
            reference_instrument_snapshot: buildReferenceInstrumentSnapshot(
              primaryReferenceInstrument
            ),
            reference_instrument_ids: scaleReferenceInstruments.map(
              (instrument) => instrument.id
            ),
            reference_instruments_snapshot: scaleReferenceInstruments.map(
              (instrument) => buildReferenceInstrumentSnapshot(instrument)
            ),
            notes: scale.notes.trim() || null,
          })
          .eq("id", scale.scaleId);

        if (scaleError) {
          throw new Error(scaleError.message);
        }

        await supabase
          .from("calibration_measurements")
          .delete()
          .eq("calibration_record_id", recordId)
          .eq("scale_id", scale.scaleId);

        const measurementRows = scale.calculatedPoints.map((point, pointIndex) => ({
          calibration_record_id: recordId,
          scale_id: scale.scaleId,
          section: scale.scaleName.trim() || "Scala " + String(scaleIndex + 1),
          point_order: pointIndex + 1,
          nominal_value: point.appliedValue,
          applied_value: point.appliedValue,
          cycle_1: point.cycle1,
          cycle_2: point.cycle2,
          cycle_3: point.cycle3,
          max_value: point.maxValue,
          min_value: point.minValue,
          average_value: point.averageValue,
          mean_error: point.meanError,
          accuracy_error_percent: point.accuracyErrorPercent,
          repeatability_error_percent: point.repeatabilityErrorPercent,
          result: null,
          notes: null,
        }));

        const { error: insertError } = await supabase
          .from("calibration_measurements")
          .insert(measurementRows);

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      await supabase
        .from("calibration_records")
        .update({
          report_status: "draft",
        })
        .eq("id", recordId)
        .neq("report_status", "issued");

      setSaveMessage("Misure tecniche aggiornate correttamente.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle misure.";

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
              Dati tecnici verifica
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
        {calculatedScales.map((scale, scaleIndex) => {
          const scaleReferenceInstruments = scale.referenceInstrumentIds
            .map((instrumentId) => getReferenceInstrument(instrumentId))
            .filter(Boolean) as ReferenceInstrument[];

          return (
            <section
              key={scale.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {scale.scaleName || "Scala " + String(scaleIndex + 1)}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Modifica fondo scala, strumento campione usato e punti di
                      misura.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => addPoint(scale.id)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Aggiungi punto
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">
                      Nome scala *
                    </span>
                    <input
                      value={scale.scaleName}
                      onChange={(event) =>
                        updateScale(scale.id, "scaleName", event.target.value)
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
                        updateScale(scale.id, "scaleRange", event.target.value)
                      }
                      placeholder="Es. 0 - 300 kN"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="lg:col-span-2">
                    <ReferenceInstrumentMultiSelect
                      instruments={referenceInstruments}
                      selectedIds={scale.referenceInstrumentIds}
                      onToggle={(instrumentId) =>
                        toggleReferenceInstrument(scale.id, instrumentId)
                      }
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
                      updateScale(scale.id, "notes", event.target.value)
                    }
                    placeholder="Eventuali note sulla scala"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                {scaleReferenceInstruments.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {scaleReferenceInstruments.map((instrument) => (
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
                            <p>
                              {formatItalianDate(instrument.certificate_expiry)}
                            </p>
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

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Punto</th>
                      <th className="px-4 py-3">Carico applicato</th>
                      <th className="bg-amber-100 px-4 py-3 text-amber-900">
                        Ciclo 1
                      </th>
                      <th className="bg-amber-100 px-4 py-3 text-amber-900">
                        Ciclo 2
                      </th>
                      <th className="bg-amber-100 px-4 py-3 text-amber-900">
                        Ciclo 3
                      </th>
                      <th className="px-4 py-3">Max</th>
                      <th className="px-4 py-3">Min</th>
                      <th className="px-4 py-3">Media</th>
                      <th className="px-4 py-3">Errore medio</th>
                      <th className="px-4 py-3">Err. acc. %</th>
                      <th className="px-4 py-3">Ripet. %</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {scale.calculatedPoints.map((point, pointIndex) => {
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
                              value={editablePoint?.appliedValue ?? ""}
                              onChange={(event) =>
                                updatePoint(
                                  scale.id,
                                  point.id,
                                  "appliedValue",
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
                              value={editablePoint?.cycle1 ?? ""}
                              onChange={(event) =>
                                updatePoint(
                                  scale.id,
                                  point.id,
                                  "cycle1",
                                  event.target.value
                                )
                              }
                              className="w-28 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                            />
                          </td>

                          <td className="bg-amber-50 px-4 py-3">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editablePoint?.cycle2 ?? ""}
                              onChange={(event) =>
                                updatePoint(
                                  scale.id,
                                  point.id,
                                  "cycle2",
                                  event.target.value
                                )
                              }
                              className="w-28 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                            />
                          </td>

                          <td className="bg-amber-50 px-4 py-3">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editablePoint?.cycle3 ?? ""}
                              onChange={(event) =>
                                updatePoint(
                                  scale.id,
                                  point.id,
                                  "cycle3",
                                  event.target.value
                                )
                              }
                              className="w-28 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                            />
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {formatItalianNumber(point.maxValue)}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {formatItalianNumber(point.minValue)}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-900">
                            {formatItalianNumber(point.averageValue)}
                          </td>

                          <td className="px-4 py-3">
                            {formatItalianNumber(point.meanError)}
                          </td>

                          <td className="px-4 py-3">
                            {formatItalianNumber(point.accuracyErrorPercent)}
                          </td>

                          <td className="px-4 py-3">
                            {formatItalianNumber(
                              point.repeatabilityErrorPercent
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removePoint(scale.id, point.id)}
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
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Grafico errori -{" "}
                  {scale.scaleName || "Scala " + String(scaleIndex + 1)}
                </h3>
                <ForceErrorChart points={scale.calculatedPoints} />
              </div>
            </section>
          );
        })}
      </fieldset>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salva modifiche misure
          </h2>
          <p className="text-sm text-slate-500">
            Dopo il salvataggio il rapporto torna in bozza, così il controllo
            completezza viene rieseguito prima dell’emissione.
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