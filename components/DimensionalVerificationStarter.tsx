"use client";

import Link from "next/link";
import SimpleAccuracyChart from "@/components/SimpleAccuracyChart";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  combineReferenceInstrumentNames,
  getDimensionalReportDefaults,
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
  site_id?: string | null;
  site?: string | null;
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

type DimensionalSubtype = "caliper" | "sieve_sphere";

type EditableDimensionalPoint = {
  id: string;
  applicationPoint: string;
  cycle1: string;
  cycle2: string;
  cycle3: string;
  notes: string;
};

type EditableDimensionalScale = {
  id: string;
  scaleName: string;
  scaleRange: string;
  notes: string;
  points: EditableDimensionalPoint[];
};

type CalculatedDimensionalPoint = {
  id: string;
  applicationPoint: number;
  cycle1: number;
  cycle2: number;
  cycle3: number;
  average: number;
  min: number;
  max: number;
  error: number;
  errorPercent: number;
  repeatabilityPercent: number;
};

type DimensionalVerificationStarterProps = {
  verificationScope: VerificationScope;
  customers: Customer[];
  customerInstruments: CustomerInstrument[];
  internalInstruments: InternalInstrument[];
  referenceInstruments: ReferenceInstrument[];
};

const SUBTYPE_SCALES: Record<DimensionalSubtype, string[]> = {
  caliper: ["Misure di esterni", "Misure di interni"],
  sieve_sphere: ["Misure di interni Asse X", "Misure di interni Asse Y"],
};

const SUBTYPE_PROCEDURE: Record<DimensionalSubtype, { code: string; name: string }> = {
  caliper: {
    code: "PROC_DIMENSIONAL_CALIPER",
    name: "Procedura verifica dimensionale - calibri",
  },
  sieve_sphere: {
    code: "PROC_DIMENSIONAL_SIEVE_SPHERE",
    name: "Procedura verifica dimensionale - setacci / sfere",
  },
};

function makeEmptyPoint(index: number): EditableDimensionalPoint {
  return {
    id: String(index + 1),
    applicationPoint: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
    notes: "",
  };
}

function makeScales(subtype: DimensionalSubtype): EditableDimensionalScale[] {
  return SUBTYPE_SCALES[subtype].map((scaleName, index) => ({
    id: subtype + "-" + String(index + 1),
    scaleName,
    scaleRange: "",
    notes: "",
    points: [makeEmptyPoint(0), makeEmptyPoint(1), makeEmptyPoint(2)],
  }));
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function todayItalianDateLabel() {
  return new Intl.DateTimeFormat("it-IT").format(new Date());
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

function unitSuffix(unit: string) {
  const normalized = unit.trim();

  return normalized ? " (" + normalized + ")" : "";
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

function internalStatusLabel(status: string) {
  if (status === "active") return "Attivo";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";

  return status;
}

function internalStatusClass(status: string) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (status === "out_of_service") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (status === "dismissed") {
    return "border-slate-300 bg-slate-100 text-slate-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
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
    instrument_id: instrument.id,
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
    instrument_id: instrument.id,
    internal_instrument_id: instrument.id,
    instrument_name: instrument.name,
    name: instrument.name,
    manufacturer: instrument.manufacturer,
    model: instrument.model,
    serial_number: instrument.serial_number,
    internal_code: instrument.internal_code,
    measurement_quantity: instrument.measurement_quantity,
    unit: instrument.unit,
    measurement_range: instrument.measurement_range,
    location: instrument.location,
    department: instrument.department,
    status: instrument.status,
    notes: instrument.notes,
  };
}

function buildReferenceInstrumentSnapshot(instrument: ReferenceInstrument) {
  return {
    instrument_id: instrument.id,
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

function calculateDimensionalPoint(
  point: EditableDimensionalPoint
): CalculatedDimensionalPoint {
  const applicationPoint = toNumber(point.applicationPoint);
  const cycle1 = toNumber(point.cycle1);
  const cycle2 = toNumber(point.cycle2);
  const cycle3 = toNumber(point.cycle3);
  const values = [cycle1, cycle2, cycle3];

  const average =
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;

  const min = Math.min(...values);
  const max = Math.max(...values);

  const error = average - applicationPoint;
  const errorPercent =
    applicationPoint !== 0 ? (error / applicationPoint) * 100 : 0;
  const repeatabilityPercent =
    average !== 0 ? ((max - min) / average) * 100 : 0;

  return {
    id: point.id,
    applicationPoint,
    cycle1,
    cycle2,
    cycle3,
    average,
    min,
    max,
    error,
    errorPercent,
    repeatabilityPercent,
  };
}

function DataPreview({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-slate-600">{value || "-"}</p>
    </div>
  );
}

export default function DimensionalVerificationStarter({
  verificationScope,
  customers,
  customerInstruments,
  internalInstruments,
  referenceInstruments,
}: DimensionalVerificationStarterProps) {
  const isInternalVerification = verificationScope === "VI";

  const [subtype, setSubtype] = useState<DimensionalSubtype>("caliper");
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
  const [ambientTemperature, setAmbientTemperature] = useState("");
  const [ambientHumidity, setAmbientHumidity] = useState("");
  const [notes, setNotes] = useState("");
  const [scales, setScales] = useState<EditableDimensionalScale[]>(() =>
    makeScales("caliper")
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [savedRecordNumber, setSavedRecordNumber] = useState<string | null>(
    null
  );

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
    const dimensionalOnly = internalInstruments.filter((instrument) => {
      const text = [
        instrument.name,
        instrument.measurement_quantity,
        instrument.unit,
        instrument.measurement_range,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        text.includes("calibro") ||
        text.includes("blocchetti") ||
        text.includes("dimensionale") ||
        text.includes("setacci") ||
        text.includes("sfere") ||
        text.includes(" mm")
      );
    });

    return dimensionalOnly.length > 0
      ? dimensionalOnly
      : internalInstruments;
  }, [internalInstruments]);

  const dimensionalReferenceInstruments = useMemo(() => {
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
        text.includes("calibro") ||
        text.includes("blocchetti") ||
        text.includes("dimensionale") ||
        text.includes("setacci") ||
        text.includes("sfere") ||
        text.includes(" mm")
      );
    });
  }, [referenceInstruments]);

  const availableReferenceInstruments =
    dimensionalReferenceInstruments.length > 0
      ? dimensionalReferenceInstruments
      : referenceInstruments;

  const selectedReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) =>
      selectedReferenceInstrumentIds.includes(instrument.id)
    );
  }, [referenceInstruments, selectedReferenceInstrumentIds]);

  const dimensionalUnit =
    selectedCustomerInstrument?.unit ||
    selectedInternalInstrument?.unit ||
    selectedReferenceInstruments[0]?.unit ||
    "mm";

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
    setSavedRecordId(null);
    setSavedRecordNumber(null);
    setSaveMessage("");
    setSaveError("");
  }

  function handleSubtypeChange(nextSubtype: DimensionalSubtype) {
    setSubtype(nextSubtype);
    setScales(makeScales(nextSubtype));
    resetSaveState();
  }

  function toggleReferenceInstrument(instrumentId: string) {
    setSelectedReferenceInstrumentIds((current) =>
      current.includes(instrumentId)
        ? current.filter((id) => id !== instrumentId)
        : [...current, instrumentId]
    );
    resetSaveState();
  }

  function updateScaleField(
    scaleId: string,
    field: keyof Omit<EditableDimensionalScale, "id" | "points">,
    value: string
  ) {
    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) =>
        scale.id === scaleId ? { ...scale, [field]: value } : scale
      )
    );
  }

  function updatePoint(
    scaleId: string,
    pointId: string,
    field: keyof Omit<EditableDimensionalPoint, "id">,
    value: string
  ) {
    const normalizedValue =
      field === "notes" ? value : normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) =>
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

    setScales((currentScales) =>
      currentScales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              points: [
                ...scale.points,
                {
                  id: crypto.randomUUID(),
                  applicationPoint: "",
                  cycle1: "",
                  cycle2: "",
                  cycle3: "",
                  notes: "",
                },
              ],
            }
          : scale
      )
    );
  }

  function removePoint(scaleId: string, pointId: string) {
    resetSaveState();

    setScales((currentScales) =>
      currentScales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              points: scale.points.filter((point) => point.id !== pointId),
            }
          : scale
      )
    );
  }

  function validate() {
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
      throw new Error(
        "Seleziona almeno un campione di riferimento da utilizzare."
      );
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error(
        "Uno dei campioni di riferimento selezionati è scaduto o fuori servizio. Seleziona solo campioni validi."
      );
    }

    if (!verificationDate) {
      throw new Error("Inserisci la data della verifica.");
    }

    for (const scale of scales) {
      if (!scale.scaleName.trim()) {
        throw new Error("Inserisci il nome di tutte le scale.");
      }

      if (scale.points.length === 0) {
        throw new Error("Inserisci almeno un punto per ogni scala.");
      }

      const invalidPoint = scale.points.find((point) => {
        return (
          point.applicationPoint.trim() === "" ||
          point.cycle1.trim() === "" ||
          point.cycle2.trim() === "" ||
          point.cycle3.trim() === ""
        );
      });

      if (invalidPoint) {
        throw new Error(
          "Compila punto di applicazione e i tre cicli per tutti i punti."
        );
      }
    }
  }

  async function saveCalibration() {
    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");
    setSavedRecordId(null);
    setSavedRecordNumber(null);

    try {
      validate();

      let instrumentSnapshot:
        | ReturnType<typeof buildCustomerInstrumentSnapshot>
        | ReturnType<typeof buildInternalInstrumentSnapshot>;
      let instrumentName = "";
      let customerName: string | null = null;
      let customerNumber: string | null | undefined = null;
      let instrumentManufacturer: string | null | undefined = null;
      let instrumentModel: string | null | undefined = null;
      let instrumentSerial: string | null | undefined = null;
      let instrumentRange: string | null | undefined = null;

      if (isInternalVerification) {
        if (!selectedInternalInstrument) {
          throw new Error("Seleziona lo strumento interno da verificare.");
        }

        instrumentSnapshot = buildInternalInstrumentSnapshot(
          selectedInternalInstrument
        );
        instrumentName = selectedInternalInstrument.name;
        customerName = "Verifica interna";
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
        instrumentName = getCustomerInstrumentName(selectedCustomerInstrument);
        customerName = getCustomerName(selectedCustomer);
        customerNumber = selectedCustomer.customer_number;
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

      const procedureSnapshot = {
        ...SUBTYPE_PROCEDURE[subtype],
        revision: "0",
        calculation_engine_version: "dimensional-v1",
      };

      const { data: calibrationType } = await supabase
        .from("calibration_types")
        .select("id")
        .eq("code", "DIMENSIONAL")
        .maybeSingle();

      const recordNumber =
        "DIM-" + String(new Date().getFullYear()) + "-" + String(Date.now());

      const { data: insertedRecord, error: insertError } = await supabase
        .from("calibration_records")
        .insert({
          record_number: recordNumber,
          calibration_type_id: calibrationType?.id ?? null,
          mode: "dimensionale",
          verification_module: "DIMENSIONAL",
          verification_date: verificationDate,
          operator_name: operatorName.trim() || null,
          location: null,
          environmental_conditions:
            ambientTemperature.trim() || ambientHumidity.trim()
              ? [
                  ambientTemperature.trim()
                    ? "Temperatura: " + ambientTemperature.trim() + " °C"
                    : null,
                  ambientHumidity.trim()
                    ? "Umidità: " + ambientHumidity.trim() + " %"
                    : null,
                ]
                  .filter(Boolean)
                  .join("; ")
              : null,
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
          verified_instrument_type: isInternalVerification
            ? "internal"
            : "customer",
          output_type: isInternalVerification ? "technical_report" : "final_report",
          acquisition_mode: "manual",
          source_device: null,
        })
        .select("id")
        .single();

      if (insertError || !insertedRecord) {
        throw new Error(
          insertError?.message || "Errore durante il salvataggio della verifica."
        );
      }

      const referenceName =
        selectedReferenceInstruments.length > 1
          ? combineReferenceInstrumentNames(selectedReferenceInstruments)
          : primaryReference.name || "Campione di riferimento";

      const reportDefaults = getDimensionalReportDefaults({
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
            ? "Verifica interna dimensionale."
            : reportDefaults.requested_tests,
          premise_text: reportDefaults.premise_text,
          scope_text: reportDefaults.scope_text,
          apparatus_description: reportDefaults.apparatus_description,
          execution_method: reportDefaults.execution_method,
          results_text: reportDefaults.results_text,
          temperature: ambientTemperature.trim() || null,
          humidity: ambientHumidity.trim() || null,
          technician_name: operatorName.trim() || null,
          reviewer_name: null,
          director_name: null,
          instrument_photo_url: null,
          notes: null,
        });

      if (reportDetailsError) {
        throw new Error(reportDetailsError.message);
      }

      const scaleRows = scales.map((scale, index) => ({
        calibration_record_id: insertedRecord.id,
        scale_order: index + 1,
        scale_name: scale.scaleName.trim(),
        scale_range: scale.scaleRange.trim()
          ? scale.scaleRange.trim().toLowerCase().includes(dimensionalUnit.toLowerCase())
            ? scale.scaleRange.trim()
            : scale.scaleRange.trim() + " " + dimensionalUnit
          : null,
        reference_instrument_id: primaryReference.id,
        reference_instrument_snapshot: primaryReferenceSnapshot,
        reference_instrument_ids: selectedReferenceInstruments.map(
          (instrument) => instrument.id
        ),
        reference_instruments_snapshot: referenceSnapshots,
        notes: scale.notes.trim() || null,
      }));

      const { data: insertedScales, error: scaleError } = await supabase
        .from("calibration_record_scales")
        .insert(scaleRows)
        .select("id, scale_order");

      if (scaleError || !insertedScales) {
        throw new Error(
          scaleError?.message ||
            "Verifica creata, ma errore nel salvataggio delle scale."
        );
      }

      const scaleIdByOrder = new Map(
        insertedScales.map((scale) => [scale.scale_order as number, scale.id as string])
      );

      const measurementRows = scales.flatMap((scale, scaleIndex) => {
        const scaleId = scaleIdByOrder.get(scaleIndex + 1);

        if (!scaleId) {
          return [];
        }

        return scale.points.map((editablePoint, pointIndex) => {
          const calculatedPoint = calculateDimensionalPoint(editablePoint);

          return {
            calibration_record_id: insertedRecord.id,
            scale_id: scaleId,
            section: scale.scaleName.trim(),
            point_order: pointIndex + 1,
            nominal_value: calculatedPoint.applicationPoint,
            applied_value: calculatedPoint.applicationPoint,
            cycle_1: calculatedPoint.cycle1,
            cycle_2: calculatedPoint.cycle2,
            cycle_3: calculatedPoint.cycle3,
            max_value: calculatedPoint.max,
            min_value: calculatedPoint.min,
            average_value: calculatedPoint.average,
            mean_error: calculatedPoint.error,
            accuracy_error_percent: calculatedPoint.errorPercent,
            repeatability_error_percent: calculatedPoint.repeatabilityPercent,
            result: null,
            notes: editablePoint.notes.trim() || null,
          };
        });
      });

      const { error: measurementError } = await supabase
        .from("calibration_measurements")
        .insert(measurementRows);

      if (measurementError) {
        throw new Error(
          measurementError.message ||
            "Verifica creata, ma errore nel salvataggio delle misure."
        );
      }

      setSavedRecordId(insertedRecord.id);
      setSavedRecordNumber(recordNumber);
      setSaveMessage(
        "Verifica dimensionale salvata correttamente con numero " +
          recordNumber +
          ". Data " +
          todayItalianDateLabel() +
          "."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il salvataggio.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  function renderScale(scale: EditableDimensionalScale, scaleIndex: number) {
    const calculatedPoints = scale.points.map(calculateDimensionalPoint);
    const pointCount = scale.points.length;
    const scaleUnit = dimensionalUnit;

    return (
      <section
        key={scale.id}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {scale.scaleName}
              </h2>
              <p className="text-sm text-slate-500">
                Scala {scaleIndex + 1}: inserisci punto di applicazione e tre
                cicli. I calcoli vengono aggiornati in tempo reale.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Nome scala *
              </span>
              <input
                value={scale.scaleName}
                onChange={(event) =>
                  updateScaleField(scale.id, "scaleName", event.target.value)
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
                  updateScaleField(scale.id, "scaleRange", event.target.value)
                }
                placeholder={"Es. 0 - 150 " + scaleUnit}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Note scala
            </span>
            <input
              value={scale.notes}
              onChange={(event) =>
                updateScaleField(scale.id, "notes", event.target.value)
              }
              placeholder="Eventuali note sulla scala"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Punto</th>
                <th className="px-4 py-3">Punto di applicazione{unitSuffix(scaleUnit)}</th>
                <th className="bg-violet-100 px-4 py-3 text-violet-900">
                  Ciclo 1{unitSuffix(scaleUnit)}
                </th>
                <th className="bg-violet-100 px-4 py-3 text-violet-900">
                  Ciclo 2{unitSuffix(scaleUnit)}
                </th>
                <th className="bg-violet-100 px-4 py-3 text-violet-900">
                  Ciclo 3{unitSuffix(scaleUnit)}
                </th>
                <th className="px-4 py-3">Max{unitSuffix(scaleUnit)}</th>
                <th className="px-4 py-3">Min{unitSuffix(scaleUnit)}</th>
                <th className="px-4 py-3">Media{unitSuffix(scaleUnit)}</th>
                <th className="px-4 py-3">Errore medio{unitSuffix(scaleUnit)}</th>
                <th className="px-4 py-3">Errore %</th>
                <th className="px-4 py-3">Ripetibilità %</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {calculatedPoints.map((point, pointIndex) => {
                const editablePoint = scale.points[pointIndex];
                const applicationTabIndex =
                  scaleIndex * 1000 + pointIndex + 1;
                const cycle1TabIndex =
                  scaleIndex * 1000 + pointCount + pointIndex + 1;
                const cycle2TabIndex =
                  scaleIndex * 1000 + pointCount * 2 + pointIndex + 1;
                const cycle3TabIndex =
                  scaleIndex * 1000 + pointCount * 3 + pointIndex + 1;

                return (
                  <tr key={point.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {pointIndex + 1}
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        tabIndex={applicationTabIndex}
                        value={editablePoint?.applicationPoint ?? ""}
                        onChange={(event) =>
                          updatePoint(
                            scale.id,
                            point.id,
                            "applicationPoint",
                            event.target.value
                          )
                        }
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>

                    <td className="bg-white px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        tabIndex={cycle1TabIndex}
                        value={editablePoint?.cycle1 ?? ""}
                        onChange={(event) =>
                          updatePoint(scale.id, point.id, "cycle1", event.target.value)
                        }
                        className="w-24 rounded-lg border border-violet-300 bg-white px-2 py-1 font-semibold text-violet-950 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </td>

                    <td className="bg-slate-50 px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        tabIndex={cycle2TabIndex}
                        value={editablePoint?.cycle2 ?? ""}
                        onChange={(event) =>
                          updatePoint(scale.id, point.id, "cycle2", event.target.value)
                        }
                        className="w-24 rounded-lg border border-violet-300 bg-slate-50 px-2 py-1 font-semibold text-violet-950 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </td>

                    <td className="bg-white px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        tabIndex={cycle3TabIndex}
                        value={editablePoint?.cycle3 ?? ""}
                        onChange={(event) =>
                          updatePoint(scale.id, point.id, "cycle3", event.target.value)
                        }
                        className="w-24 rounded-lg border border-violet-300 bg-white px-2 py-1 font-semibold text-violet-950 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </td>

                    <td className="px-4 py-3">
                      {formatItalianNumber(point.max)}
                    </td>

                    <td className="px-4 py-3">
                      {formatItalianNumber(point.min)}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatItalianNumber(point.average)}
                    </td>

                    <td className="px-4 py-3">
                      {formatItalianNumber(point.error)}
                    </td>

                    <td className="px-4 py-3">
                      {formatItalianNumber(point.errorPercent)}
                    </td>

                    <td className="px-4 py-3">
                      {formatItalianNumber(point.repeatabilityPercent)}
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

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => addPoint(scale.id)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Aggiungi punto
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200 p-5">
          <SimpleAccuracyChart
            title={"Grafico errore accuratezza % - " + scale.scaleName}
            lineColor="#7c3aed"
            points={calculatedPoints.map((point, index) => ({
              label:
                point.applicationPoint !== 0
                  ? formatItalianNumber(point.applicationPoint, 2)
                  : "Punto " + String(index + 1),
              value: point.errorPercent,
            }))}
          />
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati generali verifica dimensionale
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 lg:col-span-3">
            <span className="text-sm font-medium text-slate-700">
              Tipo di controllo dimensionale *
            </span>
            <select
              value={subtype}
              onChange={(event) =>
                handleSubtypeChange(event.target.value as DimensionalSubtype)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="caliper">
                Calibri (misure di esterni + misure di interni)
              </option>
              <option value="sieve_sphere">
                Setacci / sfere (misure di interni asse X + asse Y)
              </option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Data verifica *
            </span>
            <input
              type="date"
              value={verificationDate}
              onChange={(event) => {
                setVerificationDate(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Tecnico
            </span>
            <input
              value={operatorName}
              onChange={(event) => {
                setOperatorName(event.target.value);
                resetSaveState();
              }}
              placeholder="Nome tecnico"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Temperatura ambiente °C
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={ambientTemperature}
              onChange={(event) => {
                setAmbientTemperature(event.target.value.replace(",", "."));
                resetSaveState();
              }}
              placeholder="Es. 20"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Umidità ambiente %
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={ambientHumidity}
              onChange={(event) => {
                setAmbientHumidity(event.target.value.replace(",", "."));
                resetSaveState();
              }}
              placeholder="Es. 50"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              resetSaveState();
            }}
            rows={3}
            placeholder="Eventuali note operative"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {!isInternalVerification && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Strumento cliente verificato
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Cliente *
              </span>
              <select
                value={selectedCustomerId}
                onChange={(event) => {
                  setSelectedCustomerId(event.target.value);
                  setSelectedCustomerInstrumentId("");
                  resetSaveState();
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleziona cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_number
                      ? customer.customer_number + " - "
                      : ""}
                    {getCustomerName(customer)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Strumento *
              </span>
              <select
                value={selectedCustomerInstrumentId}
                onChange={(event) => {
                  setSelectedCustomerInstrumentId(event.target.value);
                  resetSaveState();
                }}
                disabled={!selectedCustomerId}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">
                  {selectedCustomerId
                    ? "Seleziona strumento"
                    : "Seleziona prima il cliente"}
                </option>

                {filteredCustomerInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.internal_code
                      ? instrument.internal_code + " - "
                      : ""}
                    {getCustomerInstrumentName(instrument)}
                    {instrument.model ? " - " + instrument.model : ""}
                    {instrument.serial_number
                      ? " - Matr. " + instrument.serial_number
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedCustomerInstrument && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <DataPreview
                  label="Strumento"
                  value={getCustomerInstrumentName(selectedCustomerInstrument)}
                />
                <DataPreview
                  label="Costruttore / modello"
                  value={
                    [
                      selectedCustomerInstrument.manufacturer,
                      selectedCustomerInstrument.model,
                    ]
                      .filter(Boolean)
                      .join(" - ") || "-"
                  }
                />
                <DataPreview
                  label="Matricola"
                  value={selectedCustomerInstrument.serial_number}
                />
                <DataPreview
                  label="Grandezza / unità"
                  value={
                    [
                      selectedCustomerInstrument.measurement_quantity,
                      selectedCustomerInstrument.unit,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "-"
                  }
                />
                <DataPreview
                  label="Fondo scala"
                  value={getRange(selectedCustomerInstrument)}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {isInternalVerification && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Strumento interno verificato
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 lg:col-span-3">
              <span className="text-sm font-medium text-slate-700">
                Strumento interno *
              </span>
              <select
                value={selectedInternalInstrumentId}
                onChange={(event) => {
                  setSelectedInternalInstrumentId(event.target.value);
                  resetSaveState();
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleziona strumento interno</option>

                {availableInternalInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.internal_code
                      ? instrument.internal_code + " - "
                      : ""}
                    {instrument.name}
                    {instrument.model ? " - " + instrument.model : ""}
                    {instrument.serial_number
                      ? " - Matr. " + instrument.serial_number
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedInternalInstrument && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <p className="font-semibold text-slate-900">
                    {selectedInternalInstrument.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[
                      selectedInternalInstrument.manufacturer,
                      selectedInternalInstrument.model,
                    ]
                      .filter(Boolean)
                      .join(" - ") || "-"}
                  </p>
                </div>

                <span
                  className={
                    "w-fit rounded-full border px-3 py-1 text-xs font-semibold " +
                    internalStatusClass(selectedInternalInstrument.status)
                  }
                >
                  {internalStatusLabel(selectedInternalInstrument.status)}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <DataPreview
                  label="Codice interno"
                  value={selectedInternalInstrument.internal_code}
                />
                <DataPreview
                  label="Matricola"
                  value={selectedInternalInstrument.serial_number}
                />
                <DataPreview
                  label="Grandezza / unità"
                  value={
                    [
                      selectedInternalInstrument.measurement_quantity,
                      selectedInternalInstrument.unit,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "-"
                  }
                />
                <DataPreview
                  label="Fondo scala"
                  value={selectedInternalInstrument.measurement_range}
                />
                <DataPreview
                  label="Reparto"
                  value={selectedInternalInstrument.department}
                />
                <DataPreview
                  label="Ubicazione"
                  value={selectedInternalInstrument.location}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Campioni di riferimento
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Seleziona i campioni utilizzati per la verifica dimensionale.
        </p>

        <div className="mt-5">
          <ReferenceInstrumentMultiSelect
            instruments={availableReferenceInstruments}
            selectedIds={selectedReferenceInstrumentIds}
            onToggle={toggleReferenceInstrument}
            label="Campioni di riferimento usati *"
          />
        </div>

        {selectedReferenceInstruments.length > 0 && (
          <div className="mt-5 space-y-3">
            {selectedReferenceInstruments.map((instrument) => {
              const status = getEffectiveReferenceInstrumentStatus(
                instrument.status,
                instrument.certificate_expiry
              );
              const blocked = isReferenceInstrumentBlocked(status);

              return (
                <div
                  key={instrument.id}
                  className={"rounded-xl border p-4 text-sm " + statusClass(status)}
                >
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <DataPreview
                      label="Campione"
                      value={instrument.name || "Campione di riferimento"}
                    />
                    <DataPreview
                      label="Codice"
                      value={instrument.internal_code}
                    />
                    <DataPreview
                      label="Fondo scala"
                      value={getRange(instrument)}
                    />
                    <DataPreview
                      label="Certificato"
                      value={instrument.certificate_number}
                    />
                    <DataPreview
                      label="Scadenza"
                      value={formatItalianDate(instrument.certificate_expiry)}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold">
                      Stato campione: {statusLabel(status)}
                    </span>

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
                      <span className="text-xs font-semibold text-amber-700">
                        File certificato mancante
                      </span>
                    )}
                  </div>

                  {blocked && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      Questo campione di riferimento non è utilizzabile perché
                      risulta scaduto o fuori servizio.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {scales.map((scale, index) => renderScale(scale, index))}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salvataggio verifica dimensionale
          </h2>
          <p className="text-sm text-slate-500">
            La verifica viene salvata completa di dati iniziali, scale,
            campioni di riferimento e misure.
          </p>
        </div>

        <button
          type="button"
          onClick={saveCalibration}
          disabled={isSaving || hasBlockedReferenceInstrument}
          className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Salvataggio..." : "Salva verifica"}
        </button>
      </div>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">{saveMessage}</p>

              {savedRecordNumber && (
                <p className="mt-1 text-sm">
                  Numero verifica: <strong>{savedRecordNumber}</strong>
                </p>
              )}
            </div>

            {savedRecordId && (
              <Link
                href={
                  isInternalVerification
                    ? "/verifiche/" + savedRecordId + "/rapportino-interno"
                    : "/verifiche/" + savedRecordId + "/rapporto"
                }
                className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                {isInternalVerification
                  ? "Vai al rapportino interno"
                  : "Vai ai dati rapporto"}
              </Link>
            )}
          </div>
        </div>
      )}

      {saveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {saveError}
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <strong>Nota tecnica:</strong> formule dimensionali: media dei tre
        cicli; errore medio = media cicli - punto di applicazione; errore % =
        errore / punto di applicazione × 100; ripetibilità % = (max - min) /
        media cicli × 100.
      </div>
    </div>
  );
}
