"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  combineReferenceInstrumentNames,
  getTemperatureReportDefaults,
} from "@/lib/report-defaults";
import ReferenceInstrumentMultiSelect, {
  getEffectiveReferenceInstrumentStatus,
  isReferenceInstrumentBlocked,
} from "@/components/ReferenceInstrumentMultiSelect";

type VerificationScope = "VT" | "VI";

type Customer = {
  id: string;
  customer_number?: string | null;
  business_name?: string | null;
  name?: string | null;
};

type CustomerInstrument = {
  id: string;
  customer_id?: string | null;
  name?: string | null;
  description?: string | null;
  instrument_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  range?: string | null;
  resolution?: string | null;
  notes?: string | null;
};

type InternalInstrument = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  location: string | null;
  department: string | null;
  status: string;
  notes: string | null;
  is_active: boolean;
};

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
  resolution?: string | null;
  certificate_number?: string | null;
  certificate_expiry?: string | null;
  certificate_file_url?: string | null;
  certificate_file_name?: string | null;
  status?: string | null;
};

type EditableTemperaturePoint = {
  id: string;
  date: string;
  time: string;
  measuredTemp: string;
  referenceTemp: string;
  notes: string;
};

type TemperatureVerificationStarterProps = {
  verificationScope: VerificationScope;
  customers: Customer[];
  customerInstruments: CustomerInstrument[];
  internalInstruments: InternalInstrument[];
  referenceInstruments: ReferenceInstrument[];
};

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

  return Number.isFinite(parsed) ? parsed : 0;
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

  const result = parts[0] + "," + parts.slice(1).join("");

  return hasMinus ? "-" + result : result;
}

function formatItalianNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function emptyTemperaturePoint(): EditableTemperaturePoint {
  return {
    id: crypto.randomUUID(),
    date: todayInputDate(),
    time: nowInputTime(),
    measuredTemp: "",
    referenceTemp: "",
    notes: "",
  };
}

function joinTemperatureNotes(point: EditableTemperaturePoint): string | null {
  const notes = point.notes.trim();
  return "[" + point.date + " " + point.time + "]" + (notes ? " " + notes : "");
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

function statusLabel(status: string) {
  if (status === "valid") return "Valido";
  if (status === "expiring") return "In scadenza";
  if (status === "expired") return "Scaduto";
  if (status === "out_of_service") return "Fuori servizio";

  return status;
}

function statusClass(status: string) {
  if (status === "valid") return "bg-emerald-100 text-emerald-800";
  if (status === "expiring") return "bg-amber-100 text-amber-800";
  if (status === "expired") return "bg-red-100 text-red-800";
  if (status === "out_of_service") return "bg-slate-200 text-slate-700";

  return "bg-slate-100 text-slate-700";
}

function getCustomerName(customer: Customer) {
  return customer.business_name || customer.name || "Cliente senza nome";
}

function getCustomerInstrumentName(instrument: CustomerInstrument) {
  return (
    instrument.name ||
    instrument.instrument_name ||
    instrument.description ||
    "Strumento senza nome"
  );
}

function getRange(instrument: {
  measurement_range?: string | null;
  range?: string | null;
}) {
  return instrument.measurement_range || instrument.range || null;
}

function buildCustomerInstrumentSnapshot(
  instrument: CustomerInstrument,
  customer: Customer
) {
  return {
    customer_id: customer.id,
    customer_number: customer.customer_number ?? null,
    customer_name: getCustomerName(customer),
    customer_instrument_id: instrument.id,
    instrument_name: getCustomerInstrumentName(instrument),
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    serial_number: instrument.serial_number ?? null,
    internal_code: instrument.internal_code ?? null,
    measurement_quantity: instrument.measurement_quantity ?? null,
    unit: instrument.unit ?? null,
    measurement_range: getRange(instrument),
    resolution: instrument.resolution ?? null,
    notes: instrument.notes ?? null,
  };
}

function buildInternalInstrumentSnapshot(instrument: InternalInstrument) {
  return {
    internal_instrument_id: instrument.id,
    instrument_name: instrument.name,
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    serial_number: instrument.serial_number ?? null,
    internal_code: instrument.internal_code ?? null,
    measurement_quantity: instrument.measurement_quantity ?? null,
    unit: instrument.unit ?? null,
    measurement_range: instrument.measurement_range ?? null,
    location: instrument.location ?? null,
    department: instrument.department ?? null,
    notes: instrument.notes ?? null,
  };
}

function buildReferenceInstrumentSnapshot(instrument: ReferenceInstrument) {
  return {
    id: instrument.id,
    name: instrument.name ?? null,
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    serial_number: instrument.serial_number ?? null,
    internal_code: instrument.internal_code ?? null,
    measurement_quantity: instrument.measurement_quantity ?? null,
    unit: instrument.unit ?? null,
    measurement_range: getRange(instrument),
    resolution: instrument.resolution ?? null,
    certificate_number: instrument.certificate_number ?? null,
    certificate_expiry: instrument.certificate_expiry ?? null,
    certificate_file_url: instrument.certificate_file_url ?? null,
    certificate_file_name: instrument.certificate_file_name ?? null,
    status: getEffectiveReferenceInstrumentStatus(
      instrument.status,
      instrument.certificate_expiry
    ),
  };
}

function buildProcedureSnapshot() {
  return {
    code: "PROC_TEMPERATURE",
    name: "Procedura verifica temperatura",
    revision: "0",
    calculation_engine_version: "temperature-v1",
  };
}

export default function TemperatureVerificationStarter({
  verificationScope,
  customers,
  customerInstruments,
  internalInstruments,
  referenceInstruments,
}: TemperatureVerificationStarterProps) {
  const router = useRouter();
  const isInternalVerification = verificationScope === "VI";

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerInstrumentId, setSelectedCustomerInstrumentId] =
    useState("");
  const [selectedInternalInstrumentId, setSelectedInternalInstrumentId] =
    useState("");
  const [selectedReferenceInstrumentIds, setSelectedReferenceInstrumentIds] =
    useState<string[]>([]);
  const [verificationDate, setVerificationDate] = useState(todayInputDate());
  const location = "";
  const [operatorName, setOperatorName] = useState("");
  const [notes, setNotes] = useState("");
  const [scaleNotes, setScaleNotes] = useState("");
  const [points, setPoints] = useState<EditableTemperaturePoint[]>(() => [emptyTemperaturePoint()]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  const filteredCustomerInstruments = useMemo(() => {
    if (!selectedCustomerId) {
      return [];
    }

    return customerInstruments.filter(
      (instrument) => instrument.customer_id === selectedCustomerId
    );
  }, [customerInstruments, selectedCustomerId]);

  const selectedCustomerInstrument = useMemo(() => {
    return (
      customerInstruments.find(
        (instrument) => instrument.id === selectedCustomerInstrumentId
      ) ?? null
    );
  }, [customerInstruments, selectedCustomerInstrumentId]);

  const selectedInternalInstrument = useMemo(() => {
    return (
      internalInstruments.find(
        (instrument) => instrument.id === selectedInternalInstrumentId
      ) ?? null
    );
  }, [internalInstruments, selectedInternalInstrumentId]);

  const availableInternalInstruments = useMemo(() => {
    const filtered = internalInstruments.filter((instrument) => {
      const text = [
        instrument.name,
        instrument.measurement_quantity,
        instrument.unit,
        instrument.measurement_range,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (text.includes("temperatura") || text.includes("termometro") || text.includes("termostato") || text.includes("sonda") || text.includes("°c"));
    });

    return filtered.length > 0 ? filtered : internalInstruments;
  }, [internalInstruments]);

  const temperatureReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) => {
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
        text.includes("temperatura") ||
        text.includes("termometro") ||
        text.includes("termostato") ||
        text.includes("sonda") ||
        text.includes("°c")
      );
    });
  }, [referenceInstruments]);

  const availableReferenceInstruments =
    temperatureReferenceInstruments.length > 0
      ? temperatureReferenceInstruments
      : referenceInstruments;

  function toggleReferenceInstrument(instrumentId: string) {
    setSelectedReferenceInstrumentIds((current) =>
      current.includes(instrumentId)
        ? current.filter((id) => id !== instrumentId)
        : [...current, instrumentId]
    );
    setSaveError("");
  }

  const selectedReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) =>
      selectedReferenceInstrumentIds.includes(instrument.id)
    );
  }, [referenceInstruments, selectedReferenceInstrumentIds]);

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    (instrument) =>
      isReferenceInstrumentBlocked(
        getEffectiveReferenceInstrumentStatus(
          instrument.status,
          instrument.certificate_expiry
        )
      )
  );

  function resetSaveState() {
    setSaveError("");
    setSaveMessage("");
    setSavedRecordId(null);
  }

  function updatePoint(
    pointId: string,
    field: keyof EditableTemperaturePoint,
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
    setPoints((current) => [...current, emptyTemperaturePoint()]);
  }

  function removePoint(pointId: string) {
    resetSaveState();
    setPoints((current) => current.filter((point) => point.id !== pointId));
  }

  async function createVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");

    try {
      if (isInternalVerification) {
        if (!selectedInternalInstrument) {
          throw new Error("Seleziona lo strumento interno da verificare.");
        }

        if (selectedInternalInstrument.status !== "active") {
          throw new Error(
            "Lo strumento interno selezionato non è attivo. Seleziona uno strumento attivo."
          );
        }
      } else {
        if (!selectedCustomer) {
          throw new Error("Seleziona il cliente.");
        }

        if (!selectedCustomerInstrument) {
          throw new Error("Seleziona lo strumento cliente da verificare.");
        }
      }

      if (selectedReferenceInstruments.length === 0) {
        throw new Error("Seleziona almeno uno strumento campione da utilizzare.");
      }

      if (hasBlockedReferenceInstrument) {
        throw new Error(
          "Uno degli strumenti campione selezionati è scaduto o fuori servizio. Seleziona solo campioni validi."
        );
      }

      if (!verificationDate) {
        throw new Error("Inserisci la data della verifica.");
      }

      if (points.length === 0) {
        throw new Error("Inserisci almeno una rilevazione di temperatura.");
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
        throw new Error("Compila data, orario, temperatura misurata e temperatura di riferimento per tutte le righe.");
      }

      let instrumentSnapshot:
        | ReturnType<typeof buildCustomerInstrumentSnapshot>
        | ReturnType<typeof buildInternalInstrumentSnapshot>;
      let customerName: string | null = null;
      let customerNumber: string | null | undefined = null;
      let instrumentName = "";
      let instrumentManufacturer: string | null | undefined = null;
      let instrumentModel: string | null | undefined = null;
      let instrumentSerial: string | null | undefined = null;
      let instrumentRange: string | null | undefined = null;

      if (isInternalVerification) {
        if (!selectedInternalInstrument) {
          throw new Error("Seleziona lo strumento interno da verificare.");
        }

        instrumentSnapshot = buildInternalInstrumentSnapshot(selectedInternalInstrument);
        customerName = "Verifica interna";
        instrumentName = selectedInternalInstrument.name;
        instrumentManufacturer = selectedInternalInstrument.manufacturer;
        instrumentModel = selectedInternalInstrument.model;
        instrumentSerial = selectedInternalInstrument.serial_number;
        instrumentRange = selectedInternalInstrument.measurement_range;
      } else {
        if (!selectedCustomer || !selectedCustomerInstrument) {
          throw new Error("Dati cliente/strumento incompleti.");
        }

        instrumentSnapshot = buildCustomerInstrumentSnapshot(
          selectedCustomerInstrument,
          selectedCustomer
        );
        customerName = getCustomerName(selectedCustomer);
        customerNumber = selectedCustomer.customer_number;
        instrumentName = getCustomerInstrumentName(selectedCustomerInstrument);
        instrumentManufacturer = selectedCustomerInstrument.manufacturer;
        instrumentModel = selectedCustomerInstrument.model;
        instrumentSerial = selectedCustomerInstrument.serial_number;
        instrumentRange = getRange(selectedCustomerInstrument);
      }

      const referenceSnapshots = selectedReferenceInstruments.map(
        buildReferenceInstrumentSnapshot
      );
      const primaryReference = selectedReferenceInstruments[0];
      const primaryReferenceSnapshot = referenceSnapshots[0];

      const procedureSnapshot = buildProcedureSnapshot();

      const { data: calibrationType } = await supabase
        .from("calibration_types")
        .select("id")
        .eq("code", "TEMPERATURE")
        .maybeSingle();

      const { data: insertedRecord, error: insertError } = await supabase
        .from("calibration_records")
        .insert({
          record_number: null,
          calibration_type_id: calibrationType?.id ?? null,
          mode: "temperatura",
          verification_module: "TEMPERATURE",
          verification_date: verificationDate,
          operator_name: operatorName.trim() || null,
          location: null,
          environmental_conditions: null,
          status: "draft",
          report_status: "draft",
          final_result: null,
          notes: notes.trim() || null,
          customer_instrument_id: isInternalVerification
            ? null
            : selectedCustomerInstrument?.id ?? null,
          internal_instrument_id: isInternalVerification
            ? selectedInternalInstrument?.id ?? null
            : null,
          reference_instrument_id: primaryReference.id,
          customer_instrument_snapshot: instrumentSnapshot,
          reference_instrument_snapshot: primaryReferenceSnapshot,
          procedure_snapshot: procedureSnapshot,
          verification_scope: verificationScope,
          verified_instrument_type: isInternalVerification ? "internal" : "customer",
          output_type: isInternalVerification ? "technical_report" : "final_report",
          acquisition_mode: "manual",
          source_device: null,
        })
        .select("id")
        .single();

      if (insertError || !insertedRecord) {
        throw new Error(
          insertError?.message || "Errore durante la creazione della verifica."
        );
      }

      const referenceName =
        selectedReferenceInstruments.length > 1
          ? combineReferenceInstrumentNames(selectedReferenceInstruments)
          : primaryReference.name || "Termometro di riferimento";

      const reportDefaults = getTemperatureReportDefaults({
        customerName: customerName || "Verifica interna",
        customerNumber,
        instrumentName,
        instrumentManufacturer,
        instrumentModel,
        instrumentSerial,
        instrumentRange,
        referenceName,
        referenceManufacturer:
          selectedReferenceInstruments.length === 1
            ? primaryReference.manufacturer
            : null,
        referenceModel:
          selectedReferenceInstruments.length === 1 ? primaryReference.model : null,
        referenceSerial:
          selectedReferenceInstruments.length === 1
            ? primaryReference.serial_number
            : null,
        referenceInternalCode:
          selectedReferenceInstruments.length === 1
            ? primaryReference.internal_code
            : null,
        location: "",
        testDate: verificationDate,
      });

      const { error: reportDetailsError } = await supabase
        .from("calibration_report_details")
        .insert({
          calibration_record_id: insertedRecord.id,
          main_report_number: null,
          technical_annex_number: null,
          acceptance_number: null,
          acceptance_date: null,
          report_date: null,
          test_date: verificationDate,
          customer_name: customerName,
          site_description: null,
          work_object: isInternalVerification
            ? "Verifica interna di " + instrumentName
            : reportDefaults.work_object,
          requested_tests: isInternalVerification
            ? "Verifica interna temperatura."
            : reportDefaults.requested_tests,
          premise_text: reportDefaults.premise_text,
          scope_text: reportDefaults.scope_text,
          apparatus_description: reportDefaults.apparatus_description,
          execution_method: reportDefaults.execution_method,
          results_text: reportDefaults.results_text,
          temperature: null,
          humidity: null,
          technician_name: operatorName.trim() || null,
          reviewer_name: null,
          director_name: null,
          instrument_photo_url: null,
          notes: null,
        });

      if (reportDetailsError) {
        throw new Error(reportDetailsError.message);
      }

      const { data: insertedScale, error: scaleError } = await supabase
        .from("calibration_record_scales")
        .insert({
          calibration_record_id: insertedRecord.id,
          scale_order: 1,
          scale_name: "Temperatura",
          scale_range: instrumentRange || getRange(primaryReference) || null,
          reference_instrument_id: primaryReference.id,
          reference_instrument_snapshot: primaryReferenceSnapshot,
          reference_instrument_ids: selectedReferenceInstruments.map(
            (instrument) => instrument.id
          ),
          reference_instruments_snapshot: referenceSnapshots,
          notes: scaleNotes.trim() || null,
        })
        .select("id")
        .single();

      if (scaleError || !insertedScale) {
        throw new Error(scaleError?.message || "Errore durante il salvataggio della scala.");
      }

      const sortedPoints = [...points].sort((a, b) => {
        const aKey = a.date + " " + a.time;
        const bKey = b.date + " " + b.time;
        return aKey.localeCompare(bKey);
      });

      const measurementRows = sortedPoints.map((point, pointIndex) => {
        const measuredTemp = toNumber(point.measuredTemp);
        const referenceTemp = toNumber(point.referenceTemp);

        return {
          calibration_record_id: insertedRecord.id,
          scale_id: insertedScale.id,
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
          notes: joinTemperatureNotes(point),
        };
      });

      const { error: measurementError } = await supabase
        .from("calibration_measurements")
        .insert(measurementRows);

      if (measurementError) {
        throw new Error(measurementError.message || "Errore durante il salvataggio delle rilevazioni.");
      }

      setSavedRecordId(insertedRecord.id);
      setSaveMessage("Verifica temperatura salvata correttamente.");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante la creazione della verifica.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={createVerification} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati iniziali verifica temperatura
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isInternalVerification ? (
            <label className="space-y-1 xl:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Strumento interno da verificare *
              </span>
              <select
                value={selectedInternalInstrumentId}
                onChange={(event) => {
                  setSelectedInternalInstrumentId(event.target.value);
                  setSaveError("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleziona strumento interno</option>
                {availableInternalInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.internal_code ? instrument.internal_code + " - " : ""}
                    {instrument.name}
                    {instrument.model ? " - " + instrument.model : ""}
                    {instrument.serial_number
                      ? " - Matr. " + instrument.serial_number
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Cliente *
                </span>
                <select
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(event.target.value);
                    setSelectedCustomerInstrumentId("");
                    setSaveError("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleziona cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customer_number ? customer.customer_number + " - " : ""}
                      {getCustomerName(customer)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 xl:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Strumento cliente da verificare *
                </span>
                <select
                  value={selectedCustomerInstrumentId}
                  onChange={(event) => {
                    setSelectedCustomerInstrumentId(event.target.value);
                    setSaveError("");
                  }}
                  disabled={!selectedCustomerId}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="">
                    {selectedCustomerId
                      ? "Seleziona strumento cliente"
                      : "Seleziona prima un cliente"}
                  </option>

                  {filteredCustomerInstruments.map((instrument) => (
                    <option key={instrument.id} value={instrument.id}>
                      {instrument.internal_code ? instrument.internal_code + " - " : ""}
                      {getCustomerInstrumentName(instrument)}
                      {instrument.model ? " - " + instrument.model : ""}
                      {instrument.serial_number
                        ? " - Matr. " + instrument.serial_number
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Data verifica *
            </span>
            <input
              type="date"
              value={verificationDate}
              onChange={(event) => setVerificationDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Operatore
            </span>
            <input
              value={operatorName}
              onChange={(event) => {
                setOperatorName(event.target.value);
                resetSaveState();
              }}
              placeholder="Nome tecnico / operatore"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4">
          <ReferenceInstrumentMultiSelect
            instruments={availableReferenceInstruments}
            selectedIds={selectedReferenceInstrumentIds}
            onToggle={toggleReferenceInstrument}
            label="Termometri / termostati di riferimento usati *"
          />
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Note iniziali sulla verifica"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {!isInternalVerification && selectedCustomerInstrument && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Anteprima strumento cliente
          </h2>

          <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-700">Strumento</p>
              <p className="text-slate-600">
                {getCustomerInstrumentName(selectedCustomerInstrument)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Costruttore / modello</p>
              <p className="text-slate-600">
                {[selectedCustomerInstrument.manufacturer, selectedCustomerInstrument.model]
                  .filter(Boolean)
                  .join(" - ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Matricola</p>
              <p className="text-slate-600">
                {selectedCustomerInstrument.serial_number ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Grandezza / unità</p>
              <p className="text-slate-600">
                {[selectedCustomerInstrument.measurement_quantity, selectedCustomerInstrument.unit]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Campo</p>
              <p className="text-slate-600">
                {getRange(selectedCustomerInstrument) ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Risoluzione</p>
              <p className="text-slate-600">
                {selectedCustomerInstrument.resolution ?? "-"}
              </p>
            </div>
          </div>
        </section>
      )}

      {isInternalVerification && selectedInternalInstrument && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Anteprima strumento interno
          </h2>

          <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-700">Strumento</p>
              <p className="text-slate-600">{selectedInternalInstrument.name}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Costruttore / modello</p>
              <p className="text-slate-600">
                {[selectedInternalInstrument.manufacturer, selectedInternalInstrument.model]
                  .filter(Boolean)
                  .join(" - ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Matricola</p>
              <p className="text-slate-600">
                {selectedInternalInstrument.serial_number ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Codice interno</p>
              <p className="text-slate-600">
                {selectedInternalInstrument.internal_code ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Grandezza / unità</p>
              <p className="text-slate-600">
                {[selectedInternalInstrument.measurement_quantity, selectedInternalInstrument.unit]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Campo</p>
              <p className="text-slate-600">
                {selectedInternalInstrument.measurement_range ?? "-"}
              </p>
            </div>
          </div>
        </section>
      )}

      {selectedReferenceInstruments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Anteprima strumenti di riferimento selezionati
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Questi snapshot verranno salvati nella verifica.
          </p>

          <div className="mt-4 space-y-4">
            {selectedReferenceInstruments.map((instrument) => {
              const status = getEffectiveReferenceInstrumentStatus(
                instrument.status,
                instrument.certificate_expiry
              );
              const blocked = isReferenceInstrumentBlocked(status);

              return (
                <div
                  key={instrument.id}
                  className="rounded-xl border border-slate-100 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <p className="font-semibold text-slate-900">
                      {instrument.name || "Strumento di riferimento"}
                    </p>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                        status
                      )}`}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-4 text-sm md:grid-cols-4">
                    <div>
                      <p className="font-semibold text-slate-700">Codice</p>
                      <p className="text-slate-600">
                        {instrument.internal_code ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Campo</p>
                      <p className="text-slate-600">
                        {getRange(instrument) ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Certificato</p>
                      <p className="text-slate-600">
                        {instrument.certificate_number ?? "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Scadenza: {formatItalianDate(instrument.certificate_expiry)}
                      </p>
                    </div>
                    <div>
                      {instrument.certificate_file_url ? (
                        <a
                          href={instrument.certificate_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Apri certificato
                        </a>
                      ) : (
                        <p className="text-xs text-amber-700">
                          File certificato mancante
                        </p>
                      )}
                    </div>
                  </div>

                  {blocked && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      Questo strumento di riferimento non è utilizzabile
                      perché risulta scaduto o fuori servizio.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Dati tecnici temperatura
          </h2>
          <p className="text-sm text-slate-500">
            Inserisci subito le rilevazioni, senza passare da una seconda pagina.
          </p>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">Note tecniche comuni</span>
            <input
              value={scaleNotes}
              onChange={(event) => {
                setScaleNotes(event.target.value);
                resetSaveState();
              }}
              placeholder="Eventuali note"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Orario</th>
                <th className="bg-amber-100 px-4 py-3 text-amber-900">Temperatura misurata (°C)</th>
                <th className="bg-amber-100 px-4 py-3 text-amber-900">Temperatura riferimento (°C)</th>
                <th className="px-4 py-3">Scostamento (°C)</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {points.map((point) => {
                const deviation = point.measuredTemp.trim() !== "" && point.referenceTemp.trim() !== ""
                  ? toNumber(point.measuredTemp) - toNumber(point.referenceTemp)
                  : null;

                return (
                  <tr key={point.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input type="date" value={point.date} onChange={(event) => updatePoint(point.id, "date", event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="time" value={point.time} onChange={(event) => updatePoint(point.id, "time", event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1" />
                    </td>
                    <td className="bg-amber-50 px-4 py-3">
                      <input type="text" inputMode="decimal" value={point.measuredTemp} onChange={(event) => updatePoint(point.id, "measuredTemp", event.target.value)} className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950" />
                    </td>
                    <td className="bg-amber-50 px-4 py-3">
                      <input type="text" inputMode="decimal" value={point.referenceTemp} onChange={(event) => updatePoint(point.id, "referenceTemp", event.target.value)} className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-950" />
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatItalianNumber(deviation)}</td>
                    <td className="px-4 py-3">
                      <input value={point.notes} onChange={(event) => updatePoint(point.id, "notes", event.target.value)} className="w-52 rounded-lg border border-slate-300 px-2 py-1" />
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => removePoint(point.id)} className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Elimina</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 p-5">
          <div className="flex justify-end">
            <button type="button" onClick={addPoint} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Aggiungi rilevazione</button>
          </div>
        </div>
      </section>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <div className="font-semibold">{saveMessage}</div>
          {savedRecordId && (
            <button
              type="button"
              onClick={() => router.push(`/verifiche/${savedRecordId}/misure-temperatura`)}
              className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Apri verifica salvata
            </button>
          )}
        </div>
      )}

      {saveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {saveError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/nuova-verifica")}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Annulla
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Salvataggio..." : "Salva verifica temperatura"}
        </button>
      </div>
    </form>
  );
}
