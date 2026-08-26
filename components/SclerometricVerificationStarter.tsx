"use client";

import Link from "next/link";
import { type KeyboardEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { canonicalMeasurementUnit } from "@/lib/measurement-units";
import {
  combineReferenceInstrumentNames,
  getSclerometricReportDefaults,
} from "@/lib/report-defaults";
import ReferenceInstrumentMultiSelect, {
  getEffectiveReferenceInstrumentStatus,
  isReferenceInstrumentBlocked,
} from "@/components/ReferenceInstrumentMultiSelect";
import SimpleAccuracyChart from "@/components/SimpleAccuracyChart";

type VerificationScope = "VT" | "VI";
type CycleKey = "cycle1" | "cycle2" | "cycle3";

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

type EditableHitRow = {
  id: string;
  hitNumber: number;
  cycle1: string;
  cycle2: string;
  cycle3: string;
};

type IncludedCycleValue = {
  originalHitNumber: number;
  value: number;
};

type ExcludedCycleValue = {
  originalHitNumber: number;
  value: number;
  reason: "Valore minimo escluso" | "Valore massimo escluso";
};

type CycleSummary = {
  cycleKey: CycleKey;
  cycleLabel: string;
  values: number[];
  includedValues: IncludedCycleValue[];
  excludedValues: ExcludedCycleValue[];
  minRaw: number;
  maxRaw: number;
  averageIncluded: number;
  meanError: number;
  accuracyErrorPercent: number;
  repeatabilityErrorPercent: number;
  result: "conforme" | "non_conforme" | "incompleto";
};

type FinalSclerometricRow = {
  rowNumber: number;
  lcLabel: string;
  l1: number;
  l2: number;
  l3: number;
  rowAverage: number;
  meanError: number;
  meanErrorPercent: number;
  result: "POSITIVO" | "NEGATIVO";
  originCycle1: number;
  originCycle2: number;
  originCycle3: number;
};

type SclerometricVerificationStarterProps = {
  verificationScope: VerificationScope;
  customers?: Customer[];
  customerInstruments?: CustomerInstrument[];
  internalInstruments?: InternalInstrument[];
  referenceInstruments?: ReferenceInstrument[];
};

const DEFAULT_HIT_COUNT = 12;
const DEFAULT_VALID_HIT_COUNT = 10;
const DEFAULT_NOMINAL_VALUE = 80;
const DEFAULT_LOWER_LIMIT = 77;
const DEFAULT_UPPER_LIMIT = 83;

const CYCLE_DEFINITIONS: { key: CycleKey; label: string }[] = [
  { key: "cycle1", label: "Ciclo 1" },
  { key: "cycle2", label: "Ciclo 2" },
  { key: "cycle3", label: "Ciclo 3" },
];

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
  if (status === "valid") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "expiring") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "expired") return "border-red-200 bg-red-50 text-red-900";
  if (status === "out_of_service") return "border-slate-300 bg-slate-100 text-slate-800";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function internalStatusLabel(status: string) {
  if (status === "active") return "Attivo";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";

  return status;
}

function internalStatusClass(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "out_of_service") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "dismissed") return "border-slate-300 bg-slate-100 text-slate-800";

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

function getRange(instrument: { measurement_range?: string | null; range?: string | null }) {
  return instrument.measurement_range || instrument.range || null;
}

function buildCustomerInstrumentSnapshot(instrument: CustomerInstrument, customer: Customer) {
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
    nominal_value: DEFAULT_NOMINAL_VALUE,
    lower_limit: DEFAULT_LOWER_LIMIT,
    upper_limit: DEFAULT_UPPER_LIMIT,
    tolerance: "LC ±3",
    status: getEffectiveReferenceInstrumentStatus(instrument.status, instrument.certificate_expiry),
  };
}

function buildProcedureSnapshot() {
  return {
    code: "PROC_SCLEROMETRIC",
    name: "Procedura verifica sclerometri / prova non distruttiva a rimbalzo",
    revision: "0",
    calculation_engine_version: "sclerometric-v2-3-cycles-12-hits",
  };
}

function emptyHitRows() {
  return Array.from({ length: DEFAULT_HIT_COUNT }, (_, index) => ({
    id: crypto.randomUUID(),
    hitNumber: index + 1,
    cycle1: "",
    cycle2: "",
    cycle3: "",
  }));
}

function calculateCycleSummary(
  rows: EditableHitRow[],
  cycleKey: CycleKey,
  cycleLabel: string
): CycleSummary {
  const values = rows.map((row) => toNumber(row[cycleKey]));
  const indexedValues = values.map((value, index) => ({
    originalHitNumber: index + 1,
    value,
  }));

  if (values.length < 3) {
    return {
      cycleKey,
      cycleLabel,
      values,
      includedValues: indexedValues,
      excludedValues: [],
      minRaw: 0,
      maxRaw: 0,
      averageIncluded: 0,
      meanError: 0,
      accuracyErrorPercent: 0,
      repeatabilityErrorPercent: 0,
      result: "incompleto",
    };
  }

  let minIndex = 0;
  let maxIndex = 0;

  values.forEach((value, index) => {
    if (value < values[minIndex]) minIndex = index;
    if (value > values[maxIndex]) maxIndex = index;
  });

  if (minIndex === maxIndex && values.length > 1) {
    maxIndex = minIndex === 0 ? 1 : 0;
  }

  const excludedValues: ExcludedCycleValue[] = [
    {
      originalHitNumber: minIndex + 1,
      value: values[minIndex],
      reason: "Valore minimo escluso" as const,
    },
    {
      originalHitNumber: maxIndex + 1,
      value: values[maxIndex],
      reason: "Valore massimo escluso" as const,
    },
  ];

  excludedValues.sort((a, b) => a.originalHitNumber - b.originalHitNumber);

  const includedValues = indexedValues.filter(
    (_item, index) => index !== minIndex && index !== maxIndex
  );
  const includedNumbers = includedValues.map((item) => item.value);
  const averageIncluded =
    includedNumbers.reduce((sum, value) => sum + value, 0) / includedNumbers.length;
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const meanError = averageIncluded - DEFAULT_NOMINAL_VALUE;
  const accuracyErrorPercent = (meanError / DEFAULT_NOMINAL_VALUE) * 100;
  const repeatabilityErrorPercent =
    averageIncluded !== 0 ? ((maxRaw - minRaw) / averageIncluded) * 100 : 0;
  const result =
    averageIncluded >= DEFAULT_LOWER_LIMIT && averageIncluded <= DEFAULT_UPPER_LIMIT
      ? "conforme"
      : "non_conforme";

  return {
    cycleKey,
    cycleLabel,
    values,
    includedValues,
    excludedValues,
    minRaw,
    maxRaw,
    averageIncluded,
    meanError,
    accuracyErrorPercent,
    repeatabilityErrorPercent,
    result,
  };
}

function calculateFinalSclerometricRows(cycleSummaries: CycleSummary[]): FinalSclerometricRow[] {
  if (cycleSummaries.length < 3) {
    return [];
  }

  if (cycleSummaries.some((summary) => summary.includedValues.length !== DEFAULT_VALID_HIT_COUNT)) {
    return [];
  }

  return Array.from({ length: DEFAULT_VALID_HIT_COUNT }, (_item, index) => {
    const cycle1 = cycleSummaries[0].includedValues[index];
    const cycle2 = cycleSummaries[1].includedValues[index];
    const cycle3 = cycleSummaries[2].includedValues[index];
    const values = [cycle1.value, cycle2.value, cycle3.value];
    const rowAverage = values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanError = rowAverage - DEFAULT_NOMINAL_VALUE;
    const meanErrorPercent = (meanError / DEFAULT_NOMINAL_VALUE) * 100;
    const result =
      rowAverage >= DEFAULT_LOWER_LIMIT && rowAverage <= DEFAULT_UPPER_LIMIT
        ? "POSITIVO"
        : "NEGATIVO";

    return {
      rowNumber: index + 1,
      lcLabel: "77/83",
      l1: cycle1.value,
      l2: cycle2.value,
      l3: cycle3.value,
      rowAverage,
      meanError,
      meanErrorPercent,
      result,
      originCycle1: cycle1.originalHitNumber,
      originCycle2: cycle2.originalHitNumber,
      originCycle3: cycle3.originalHitNumber,
    };
  });
}

function calculateAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function DataPreview({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-slate-600">{value || "-"}</p>
    </div>
  );
}

export default function SclerometricVerificationStarter({
  verificationScope,
  customers = [],
  customerInstruments = [],
  internalInstruments = [],
  referenceInstruments = [],
}: SclerometricVerificationStarterProps) {
  const isInternalVerification = verificationScope === "VI";

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerInstrumentId, setSelectedCustomerInstrumentId] = useState("");
  const [selectedInternalInstrumentId, setSelectedInternalInstrumentId] = useState("");
  const [selectedReferenceInstrumentIds, setSelectedReferenceInstrumentIds] = useState<string[]>([]);
  const [verificationDate, setVerificationDate] = useState(todayInputDate());
  const location = "";
  const [operatorName, setOperatorName] = useState("");
  const [ambientTemperature, setAmbientTemperature] = useState("");
  const [ambientHumidity, setAmbientHumidity] = useState("");
  const [scaleName, setScaleName] = useState("Prova sclerometrica");
  const [scaleRange, setScaleRange] = useState("Incudine nominale 80 - LC ±3 - campo 77/83");
  const [scaleNotes, setScaleNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<EditableHitRow[]>(() => emptyHitRows());

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === selectedCustomerId) ?? null, [customers, selectedCustomerId]);

  const filteredCustomerInstruments = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerInstruments.filter((instrument) => instrument.customer_id === selectedCustomerId);
  }, [customerInstruments, selectedCustomerId]);

  const selectedCustomerInstrument = useMemo(() => customerInstruments.find((instrument) => instrument.id === selectedCustomerInstrumentId) ?? null, [customerInstruments, selectedCustomerInstrumentId]);

  const selectedInternalInstrument = useMemo(() => internalInstruments.find((instrument) => instrument.id === selectedInternalInstrumentId) ?? null, [internalInstruments, selectedInternalInstrumentId]);

  const availableInternalInstruments = useMemo(() => {
    const sclerometricOnly = internalInstruments.filter((instrument) => {
      const text = [instrument.name, instrument.measurement_quantity, instrument.unit, instrument.measurement_range].filter(Boolean).join(" ").toLowerCase();
      return text.includes("sclerometr") || text.includes("incudine") || text.includes("rimbalzo") || text.includes("schmidt") || text.includes("durezza");
    });
    return sclerometricOnly.length > 0 ? sclerometricOnly : internalInstruments;
  }, [internalInstruments]);

  const availableReferenceInstruments = useMemo(() => {
    const sclerometricOnly = referenceInstruments.filter((instrument) => {
      const text = [instrument.name, instrument.measurement_quantity, instrument.unit, getRange(instrument)].filter(Boolean).join(" ").toLowerCase();
      return text.includes("sclerometr") || text.includes("incudine") || text.includes("rimbalzo") || text.includes("schmidt") || text.includes("durezza");
    });
    return sclerometricOnly.length > 0 ? sclerometricOnly : referenceInstruments;
  }, [referenceInstruments]);

  const selectedReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) => selectedReferenceInstrumentIds.includes(instrument.id));
  }, [referenceInstruments, selectedReferenceInstrumentIds]);

  const sclerometricUnit = canonicalMeasurementUnit(
    selectedCustomerInstrument?.unit ||
    selectedInternalInstrument?.unit ||
    selectedReferenceInstruments[0]?.unit ||
    ""
  );
  const sclerometricUnitLabel = sclerometricUnit ? " (" + sclerometricUnit + ")" : "";

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some((instrument) =>
    isReferenceInstrumentBlocked(getEffectiveReferenceInstrumentStatus(instrument.status, instrument.certificate_expiry))
  );

  const cycleSummaries = useMemo(() => {
    return CYCLE_DEFINITIONS.map((cycle) => calculateCycleSummary(rows, cycle.key, cycle.label));
  }, [rows]);

  const finalRows = useMemo(() => {
    return calculateFinalSclerometricRows(cycleSummaries);
  }, [cycleSummaries]);

  const finalAverageL1 = useMemo(() => calculateAverage(finalRows.map((row) => row.l1)), [finalRows]);
  const finalAverageL2 = useMemo(() => calculateAverage(finalRows.map((row) => row.l2)), [finalRows]);
  const finalAverageL3 = useMemo(() => calculateAverage(finalRows.map((row) => row.l3)), [finalRows]);

  const overallAverage = useMemo(() => {
    return calculateAverage(finalRows.map((row) => row.rowAverage));
  }, [finalRows]);

  const overallMeanError = overallAverage - DEFAULT_NOMINAL_VALUE;
  const overallMeanErrorPercent = (overallMeanError / DEFAULT_NOMINAL_VALUE) * 100;

  const overallResult = useMemo(() => {
    return finalRows.length === DEFAULT_VALID_HIT_COUNT &&
      finalRows.every((row) => row.result === "POSITIVO")
      ? "conforme"
      : "non_conforme";
  }, [finalRows]);

  function resetSaveState() {
    setSavedRecordId(null);
    setSaveMessage("");
    setSaveError("");
  }

  function toggleReferenceInstrument(instrumentId: string) {
    setSelectedReferenceInstrumentIds((current) =>
      current.includes(instrumentId)
        ? current.filter((id) => id !== instrumentId)
        : [...current, instrumentId]
    );
    resetSaveState();
  }

  function handleCycleTab(event: KeyboardEvent<HTMLInputElement>, field: CycleKey) {
    if (event.key !== "Tab" || event.shiftKey) return;

    const currentInput = event.currentTarget;
    const currentRow = currentInput.closest("tr");
    let nextRow = currentRow?.nextElementSibling;

    while (nextRow) {
      const nextInput = nextRow.querySelector<HTMLInputElement>('input[data-cycle-field="' + field + '"]');
      if (nextInput) {
        event.preventDefault();
        nextInput.focus();
        nextInput.select();
        return;
      }
      nextRow = nextRow.nextElementSibling;
    }
  }

  function updateRow(rowId: string, field: CycleKey, value: string) {
    const normalizedValue = normalizeEuropeanDecimalInput(value);
    resetSaveState();
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, [field]: normalizedValue } : row)));
  }

  function isExcluded(cycleSummary: CycleSummary, hitNumber: number) {
    return cycleSummary.excludedValues.find((hit) => hit.originalHitNumber === hitNumber) ?? null;
  }

  function validate() {
    if (isInternalVerification) {
      if (!selectedInternalInstrument) throw new Error("Seleziona lo strumento interno da verificare.");
      if (selectedInternalInstrument.status !== "active") throw new Error("Lo strumento interno selezionato non è attivo. Seleziona uno strumento attivo.");
    } else {
      if (!selectedCustomer) throw new Error("Seleziona il cliente.");
      if (!selectedCustomerInstrument) throw new Error("Seleziona lo strumento cliente da verificare.");
    }

    if (!verificationDate) throw new Error("Inserisci la data della verifica.");
    if (selectedReferenceInstruments.length === 0) throw new Error("Seleziona almeno un'incudine di riferimento da utilizzare.");
    if (hasBlockedReferenceInstrument) throw new Error("Una delle incudini di riferimento selezionate è scaduta o fuori servizio. Seleziona solo campioni validi.");
    if (!scaleName.trim()) throw new Error("Inserisci il nome della prova.");

    const invalidRow = rows.find((row) => !row.cycle1.trim() || !row.cycle2.trim() || !row.cycle3.trim());
    if (invalidRow) throw new Error("Compila tutte le 12 battute per i tre cicli.");

    const invalidSummary = cycleSummaries.find((summary) => summary.includedValues.length !== DEFAULT_VALID_HIT_COUNT);
    if (invalidSummary) throw new Error("Ogni ciclo deve avere 12 battute e 10 battute valide dopo esclusione di minimo e massimo.");
  }

  function buildTechnicalNote() {
    const cycleNotes = cycleSummaries
      .map((summary) => {
        const excluded = summary.excludedValues
          .map((hit) => summary.cycleLabel + " battuta " + hit.originalHitNumber + " = " + formatItalianNumber(hit.value, 2) + " (" + hit.reason + ")")
          .join("; ");
        return summary.cycleLabel + ": media su 10 battute = " + formatItalianNumber(summary.averageIncluded, 2) + ", esclusioni: " + excluded;
      })
      .join(". ");

    return (
      "Sclerometrica: 3 cicli da 12 battute. Per ogni ciclo sono esclusi automaticamente il valore più alto e il valore più basso; il calcolo viene eseguito sulle restanti 10 battute. Incudine nominale 80, LC ±3, campo accettazione 77/83. " +
      cycleNotes +
      ". Media generale dei tre cicli: " +
      formatItalianNumber(overallAverage, 2) +
      ". Esito generale: " +
      (overallResult === "conforme" ? "conforme" : "non conforme") +
      "."
    );
  }

  async function saveCalibration() {
    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");
    setSavedRecordId(null);

    try {
      validate();

      let instrumentSnapshot: ReturnType<typeof buildCustomerInstrumentSnapshot> | ReturnType<typeof buildInternalInstrumentSnapshot>;
      let instrumentName = "";
      let customerName: string | null = null;
      let customerNumber: string | null | undefined = null;
      let instrumentManufacturer: string | null | undefined = null;
      let instrumentModel: string | null | undefined = null;
      let instrumentSerial: string | null | undefined = null;
      let instrumentRange: string | null | undefined = null;

      if (isInternalVerification) {
        if (!selectedInternalInstrument) throw new Error("Seleziona lo strumento interno da verificare.");
        instrumentSnapshot = buildInternalInstrumentSnapshot(selectedInternalInstrument);
        instrumentName = selectedInternalInstrument.name;
        customerName = "Verifica interna";
        instrumentManufacturer = selectedInternalInstrument.manufacturer;
        instrumentModel = selectedInternalInstrument.model;
        instrumentSerial = selectedInternalInstrument.serial_number;
        instrumentRange = selectedInternalInstrument.measurement_range;
      } else {
        if (!selectedCustomer || !selectedCustomerInstrument) throw new Error("Dati cliente/strumento incompleti.");
        instrumentSnapshot = buildCustomerInstrumentSnapshot(selectedCustomerInstrument, selectedCustomer);
        instrumentName = getCustomerInstrumentName(selectedCustomerInstrument);
        customerName = getCustomerName(selectedCustomer);
        customerNumber = selectedCustomer.customer_number;
        instrumentManufacturer = selectedCustomerInstrument.manufacturer;
        instrumentModel = selectedCustomerInstrument.model;
        instrumentSerial = selectedCustomerInstrument.serial_number;
        instrumentRange = getRange(selectedCustomerInstrument);
      }

      const referenceSnapshots = selectedReferenceInstruments.map(buildReferenceInstrumentSnapshot);
      const primaryReference = selectedReferenceInstruments[0];
      const primaryReferenceSnapshot = referenceSnapshots[0];
      const procedureSnapshot = buildProcedureSnapshot();
      const technicalNote = buildTechnicalNote();

      const { data: calibrationType } = await supabase
        .from("calibration_types")
        .select("id")
        .eq("code", "SCLEROMETRIC")
        .maybeSingle();

      const { data: insertedRecord, error: insertError } = await supabase
        .from("calibration_records")
        .insert({
          record_number: null,
          calibration_type_id: calibrationType?.id ?? null,
          mode: "sclerometro",
          verification_module: "SCLEROMETRIC",
          verification_date: verificationDate,
          operator_name: operatorName.trim() || null,
          location: null,
          environmental_conditions:
            ambientTemperature.trim() || ambientHumidity.trim()
              ? [
                  ambientTemperature.trim() ? "Temperatura: " + ambientTemperature.trim() + " °C" : null,
                  ambientHumidity.trim() ? "Umidità: " + ambientHumidity.trim() + " %" : null,
                ]
                  .filter(Boolean)
                  .join("; ")
              : null,
          status: "draft",
          report_status: "draft",
          final_result: overallResult === "conforme" ? "conforme" : "non_conforme",
          notes: notes.trim() ? notes.trim() + "\n" + technicalNote : technicalNote,
          customer_instrument_id: isInternalVerification ? null : selectedCustomerInstrument?.id ?? null,
          internal_instrument_id: isInternalVerification ? selectedInternalInstrument?.id ?? null : null,
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

      if (insertError || !insertedRecord) throw new Error(insertError?.message || "Errore durante il salvataggio della verifica.");

      const referenceName = selectedReferenceInstruments.length > 1 ? combineReferenceInstrumentNames(selectedReferenceInstruments) : primaryReference.name || "Incudine di riferimento";

      const reportDefaults = getSclerometricReportDefaults({
        customerName: customerName || "Verifica interna",
        customerNumber,
        instrumentName,
        instrumentManufacturer,
        instrumentModel,
        instrumentSerial,
        instrumentRange,
        referenceName,
        referenceManufacturer: selectedReferenceInstruments.length === 1 ? primaryReference.manufacturer : null,
        referenceModel: selectedReferenceInstruments.length === 1 ? primaryReference.model : null,
        referenceSerial: selectedReferenceInstruments.length === 1 ? primaryReference.serial_number : null,
        referenceInternalCode: selectedReferenceInstruments.length === 1 ? primaryReference.internal_code : null,
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
          work_object: isInternalVerification ? "Verifica interna di " + instrumentName : reportDefaults.work_object,
          requested_tests: isInternalVerification ? "Verifica interna di sclerometro / strumento a rimbalzo." : reportDefaults.requested_tests,
          premise_text: reportDefaults.premise_text,
          scope_text: reportDefaults.scope_text,
          apparatus_description: reportDefaults.apparatus_description + "\nStrumento campione / incudine: valore nominale 80, LC ±3, campo accettazione 77/83.",
          execution_method: reportDefaults.execution_method + "\nSono eseguiti 3 cicli da 12 battute. Per ogni ciclo il valore più alto e il valore più basso sono esclusi automaticamente dal calcolo; il risultato viene calcolato sulle 10 battute valide per ciclo.",
          results_text: "Media generale finale: " + formatItalianNumber(overallAverage, 2) + ". Errore medio rispetto al valore 80: " + formatItalianNumber(overallMeanError, 1) + ". Errore medio in %: " + formatItalianNumber(overallMeanErrorPercent, 1) + "%. Campo accettazione LC ±3: 77/83. Esito: " + (overallResult === "conforme" ? "conforme" : "non conforme") + ".",
          temperature: ambientTemperature.trim() || null,
          humidity: ambientHumidity.trim() || null,
          technician_name: operatorName.trim() || null,
          reviewer_name: null,
          director_name: null,
          instrument_photo_url: null,
          notes: technicalNote,
        });

      if (reportDetailsError) throw new Error(reportDetailsError.message);

      const { data: insertedScale, error: scaleError } = await supabase
        .from("calibration_record_scales")
        .insert({
          calibration_record_id: insertedRecord.id,
          scale_order: 1,
          scale_name: scaleName.trim(),
          scale_range: scaleRange.trim() || instrumentRange || null,
          reference_instrument_id: primaryReference.id,
          reference_instrument_snapshot: primaryReferenceSnapshot,
          reference_instrument_ids: selectedReferenceInstruments.map((instrument) => instrument.id),
          reference_instruments_snapshot: referenceSnapshots,
          notes: scaleNotes.trim() ? scaleNotes.trim() + "\n" + technicalNote : technicalNote,
        })
        .select("id")
        .single();

      if (scaleError || !insertedScale) throw new Error(scaleError?.message || "Verifica creata, ma errore nel salvataggio della scala.");

      const measurementRows = finalRows.map((finalRow) => {
        const rowValues = [finalRow.l1, finalRow.l2, finalRow.l3];
        const rowMax = Math.max(...rowValues);
        const rowMin = Math.min(...rowValues);
        const rowRepeatabilityErrorPercent =
          finalRow.rowAverage !== 0
            ? ((rowMax - rowMin) / finalRow.rowAverage) * 100
            : 0;

        return {
          calibration_record_id: insertedRecord.id,
          scale_id: insertedScale.id,
          section: "10 battute valide per ciclo dopo esclusione massimo/minimo",
          point_order: finalRow.rowNumber,
          nominal_value: DEFAULT_NOMINAL_VALUE,
          applied_value: finalRow.rowAverage,
          cycle_1: finalRow.l1,
          cycle_2: finalRow.l2,
          cycle_3: finalRow.l3,
          max_value: rowMax,
          min_value: rowMin,
          average_value: finalRow.rowAverage,
          mean_error: finalRow.meanError,
          accuracy_error_percent: finalRow.meanErrorPercent,
          repeatability_error_percent: rowRepeatabilityErrorPercent,
          result: finalRow.result,
          notes:
            "LC 77/83. Errore medio = media(L1,L2,L3) - 80. Errore medio % = errore medio / 80 x 100. Origine: Ciclo 1 battuta " +
            finalRow.originCycle1 +
            ", Ciclo 2 battuta " +
            finalRow.originCycle2 +
            ", Ciclo 3 battuta " +
            finalRow.originCycle3 +
            ".",
        };
      });

      const { error: measurementError } = await supabase
        .from("calibration_measurements")
        .insert(measurementRows);

      if (measurementError) throw new Error(measurementError.message || "Verifica creata, ma errore nel salvataggio delle letture.");

      setSavedRecordId(insertedRecord.id);
      setSaveMessage("Verifica sclerometrica salvata correttamente. Salvate 10 battute valide per ciascuno dei 3 cicli. Data " + todayItalianDateLabel() + ".");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore imprevisto durante il salvataggio.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Dati generali verifica sclerometrica</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Data verifica *</span>
            <input type="date" value={verificationDate} onChange={(event) => { setVerificationDate(event.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Tecnico</span>
            <input value={operatorName} onChange={(event) => { setOperatorName(event.target.value); resetSaveState(); }} placeholder="Nome tecnico" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Temperatura ambiente °C</span>
            <input type="text" inputMode="decimal" value={ambientTemperature} onChange={(event) => { setAmbientTemperature(event.target.value.replace(",", ".")); resetSaveState(); }} placeholder="Es. 20" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Umidità ambiente %</span>
            <input type="text" inputMode="decimal" value={ambientHumidity} onChange={(event) => { setAmbientHumidity(event.target.value.replace(",", ".")); resetSaveState(); }} placeholder="Es. 50" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea value={notes} onChange={(event) => { setNotes(event.target.value); resetSaveState(); }} rows={3} placeholder="Eventuali note operative" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </section>

      {!isInternalVerification && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Strumento cliente verificato</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Cliente *</span>
              <select value={selectedCustomerId} onChange={(event) => { setSelectedCustomerId(event.target.value); setSelectedCustomerInstrumentId(""); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">Seleziona cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.customer_number ? customer.customer_number + " - " : ""}{getCustomerName(customer)}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Strumento *</span>
              <select value={selectedCustomerInstrumentId} onChange={(event) => { setSelectedCustomerInstrumentId(event.target.value); resetSaveState(); }} disabled={!selectedCustomerId} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100">
                <option value="">{selectedCustomerId ? "Seleziona strumento" : "Seleziona prima il cliente"}</option>
                {filteredCustomerInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>{instrument.internal_code ? instrument.internal_code + " - " : ""}{getCustomerInstrumentName(instrument)}{instrument.model ? " - " + instrument.model : ""}{instrument.serial_number ? " - Matr. " + instrument.serial_number : ""}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedCustomerInstrument && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <DataPreview label="Strumento" value={getCustomerInstrumentName(selectedCustomerInstrument)} />
                <DataPreview label="Costruttore / modello" value={[selectedCustomerInstrument.manufacturer, selectedCustomerInstrument.model].filter(Boolean).join(" - ") || "-"} />
                <DataPreview label="Matricola" value={selectedCustomerInstrument.serial_number} />
                <DataPreview label="Grandezza / unità" value={[selectedCustomerInstrument.measurement_quantity, selectedCustomerInstrument.unit].filter(Boolean).join(" / ") || "-"} />
                <DataPreview label="Fondo scala" value={getRange(selectedCustomerInstrument)} />
              </div>
            </div>
          )}
        </section>
      )}

      {isInternalVerification && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Strumento interno verificato</h2>
          <label className="mt-5 block space-y-1">
            <span className="text-sm font-medium text-slate-700">Strumento interno *</span>
            <select value={selectedInternalInstrumentId} onChange={(event) => { setSelectedInternalInstrumentId(event.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Seleziona strumento interno</option>
              {availableInternalInstruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>{instrument.internal_code ? instrument.internal_code + " - " : ""}{instrument.name}{instrument.model ? " - " + instrument.model : ""}{instrument.serial_number ? " - Matr. " + instrument.serial_number : ""}</option>
              ))}
            </select>
          </label>

          {selectedInternalInstrument && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <p className="font-semibold text-slate-900">{selectedInternalInstrument.name}</p>
                  <p className="text-xs text-slate-500">{[selectedInternalInstrument.manufacturer, selectedInternalInstrument.model].filter(Boolean).join(" - ") || "-"}</p>
                </div>
                <span className={"w-fit rounded-full border px-3 py-1 text-xs font-semibold " + internalStatusClass(selectedInternalInstrument.status)}>{internalStatusLabel(selectedInternalInstrument.status)}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <DataPreview label="Codice interno" value={selectedInternalInstrument.internal_code} />
                <DataPreview label="Matricola" value={selectedInternalInstrument.serial_number} />
                <DataPreview label="Grandezza / unità" value={[selectedInternalInstrument.measurement_quantity, selectedInternalInstrument.unit].filter(Boolean).join(" / ") || "-"} />
                <DataPreview label="Fondo scala" value={selectedInternalInstrument.measurement_range} />
                <DataPreview label="Reparto" value={selectedInternalInstrument.department} />
                <DataPreview label="Ubicazione" value={selectedInternalInstrument.location} />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Strumento campione / incudine</h2>
        <p className="mt-1 text-sm text-slate-500">Valore nominale preimpostato 80 con LC ±3, quindi campo accettazione 77 / 83.</p>
        <div className="mt-5">
          <ReferenceInstrumentMultiSelect instruments={availableReferenceInstruments} selectedIds={selectedReferenceInstrumentIds} onToggle={toggleReferenceInstrument} label="Incudini di riferimento usate *" />
        </div>
        <div className="mt-5 grid gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950 md:grid-cols-4">
          <DataPreview label="Valore nominale" value="80" />
          <DataPreview label="LC" value="±3" />
          <DataPreview label="Limite inferiore" value="77" />
          <DataPreview label="Limite superiore" value="83" />
        </div>

        {selectedReferenceInstruments.length > 0 && (
          <div className="mt-5 space-y-3">
            {selectedReferenceInstruments.map((instrument) => {
              const status = getEffectiveReferenceInstrumentStatus(instrument.status, instrument.certificate_expiry);
              const blocked = isReferenceInstrumentBlocked(status);
              return (
                <div key={instrument.id} className={"rounded-xl border p-4 text-sm " + statusClass(status)}>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <DataPreview label="Incudine" value={instrument.name || "Incudine di riferimento"} />
                    <DataPreview label="Codice" value={instrument.internal_code} />
                    <DataPreview label="Fondo scala" value={getRange(instrument)} />
                    <DataPreview label="Certificato" value={instrument.certificate_number} />
                    <DataPreview label="Scadenza" value={formatItalianDate(instrument.certificate_expiry)} />
                  </div>
                  {blocked && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Questa incudine di riferimento non è utilizzabile perché risulta scaduta o fuori servizio.</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Letture prova sclerometrica</h2>
          <p className="text-sm text-slate-500">Numero battute default: 12. Per ciascuno dei 3 cicli il sistema elimina automaticamente la battuta più alta e quella più bassa, calcolando sulle 10 battute valide.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nome prova *</span>
              <input value={scaleName} onChange={(event) => { setScaleName(event.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Numero battute</span>
              <input value="12 battute per ciclo" readOnly className="w-full rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-950" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">LC preimpostato</span>
              <input value="80 ±3 — 77 / 83" readOnly className="w-full rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-950" />
            </label>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">Note prova</span>
            <input value={scaleNotes} onChange={(event) => { setScaleNotes(event.target.value); resetSaveState(); }} placeholder="Eventuali note sulla prova" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Numero battuta</th>
                <th className="bg-orange-100 px-4 py-3 text-orange-900">Ciclo 1{sclerometricUnitLabel}</th>
                <th className="bg-slate-100 px-4 py-3 text-slate-900">Ciclo 2{sclerometricUnitLabel}</th>
                <th className="bg-orange-100 px-4 py-3 text-orange-900">Ciclo 3{sclerometricUnitLabel}</th>
                <th className="px-4 py-3">Stato ciclo 1</th>
                <th className="px-4 py-3">Stato ciclo 2</th>
                <th className="px-4 py-3">Stato ciclo 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const excluded1 = isExcluded(cycleSummaries[0], row.hitNumber);
                const excluded2 = isExcluded(cycleSummaries[1], row.hitNumber);
                const excluded3 = isExcluded(cycleSummaries[2], row.hitNumber);
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-700">Battuta {row.hitNumber}</td>
                    <td className="bg-white px-4 py-3">
                      <input type="text" inputMode="decimal" value={row.cycle1} data-cycle-field="cycle1" onKeyDown={(event) => handleCycleTab(event, "cycle1")} onChange={(event) => updateRow(row.id, "cycle1", event.target.value)} className="w-24 rounded-lg border border-orange-300 bg-white px-2 py-1 font-semibold text-orange-950 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />
                    </td>
                    <td className="bg-slate-50 px-4 py-3">
                      <input type="text" inputMode="decimal" value={row.cycle2} data-cycle-field="cycle2" onKeyDown={(event) => handleCycleTab(event, "cycle2")} onChange={(event) => updateRow(row.id, "cycle2", event.target.value)} className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-950 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200" />
                    </td>
                    <td className="bg-white px-4 py-3">
                      <input type="text" inputMode="decimal" value={row.cycle3} data-cycle-field="cycle3" onKeyDown={(event) => handleCycleTab(event, "cycle3")} onChange={(event) => updateRow(row.id, "cycle3", event.target.value)} className="w-24 rounded-lg border border-orange-300 bg-white px-2 py-1 font-semibold text-orange-950 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />
                    </td>
                    {[excluded1, excluded2, excluded3].map((excluded, index) => (
                      <td key={index} className="px-4 py-3">
                        {excluded ? (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">Esclusa</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Inclusa</span>
                        )}
                        {excluded && <p className="mt-1 text-xs text-slate-500">{excluded.reason}</p>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Anteprima tabella finale rapporto/rapportino
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Dopo l’esclusione automatica di minimo e massimo per ciascun ciclo,
            il rapporto mostra 10 battute finali con LC 77/83, L1, L2, L3,
            errore medio rispetto al valore 80, errore medio % ed esito.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Numero battuta</th>
                  <th className="bg-emerald-100 px-3 py-2 text-emerald-900">LC ±3</th>
                  <th className="bg-sky-100 px-3 py-2 text-sky-900">L1{sclerometricUnitLabel}</th>
                  <th className="bg-sky-100 px-3 py-2 text-sky-900">L2{sclerometricUnitLabel}</th>
                  <th className="bg-sky-100 px-3 py-2 text-sky-900">L3{sclerometricUnitLabel}</th>
                  <th className="px-3 py-2">Errore medio{sclerometricUnitLabel}</th>
                  <th className="px-3 py-2">Errore medio %</th>
                  <th className="px-3 py-2">Esito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finalRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {row.rowNumber}
                    </td>
                    <td className="bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">
                      {row.lcLabel}
                    </td>
                    <td className="bg-sky-50 px-3 py-2">
                      {formatItalianNumber(row.l1, 1)}
                    </td>
                    <td className="bg-sky-50 px-3 py-2">
                      {formatItalianNumber(row.l2, 1)}
                    </td>
                    <td className="bg-sky-50 px-3 py-2">
                      {formatItalianNumber(row.l3, 1)}
                    </td>
                    <td className="px-3 py-2">
                      {formatItalianNumber(row.meanError, 1)}
                    </td>
                    <td className="px-3 py-2">
                      {formatItalianNumber(row.meanErrorPercent, 1)}%
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded-full px-3 py-1 text-xs font-semibold " +
                          (row.result === "POSITIVO"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800")
                        }
                      >
                        {row.result}
                      </span>
                    </td>
                  </tr>
                ))}

                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="px-3 py-2">Media</td>
                  <td className="px-3 py-2">77/83</td>
                  <td className="px-3 py-2">{formatItalianNumber(finalAverageL1, 1)}</td>
                  <td className="px-3 py-2">{formatItalianNumber(finalAverageL2, 1)}</td>
                  <td className="px-3 py-2">{formatItalianNumber(finalAverageL3, 1)}</td>
                  <td className="px-3 py-2">{formatItalianNumber(overallMeanError, 1)}</td>
                  <td className="px-3 py-2">{formatItalianNumber(overallMeanErrorPercent, 1)}%</td>
                  <td className="px-3 py-2">
                    {overallResult === "conforme" ? "POSITIVO" : "NEGATIVO"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-5 md:grid-cols-2 lg:grid-cols-7">
          <DataPreview label="Battute per ciclo" value="12" />
          <DataPreview label="Battute valide per ciclo" value="10" />
          <DataPreview label="Media L1" value={formatItalianNumber(finalAverageL1, 1)} />
          <DataPreview label="Media L2" value={formatItalianNumber(finalAverageL2, 1)} />
          <DataPreview label="Media L3" value={formatItalianNumber(finalAverageL3, 1)} />
          <DataPreview label="Errore medio finale" value={formatItalianNumber(overallMeanError, 1)} />
          <DataPreview label="Esito LC 77/83" value={overallResult === "conforme" ? "POSITIVO" : "NEGATIVO"} />
        </div>

        <div className="border-t border-slate-200 p-5">
          <SimpleAccuracyChart
            title="Grafico errore medio % - 10 battute finali"
            lineColor="#ea580c"
            points={finalRows.map((row) => ({
              label: String(row.rowNumber),
              value: row.meanErrorPercent,
            }))}
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Salvataggio verifica sclerometrica</h2>
          <p className="text-sm text-slate-500">La verifica viene salvata con 3 cicli da 12 battute. Nel rapporto saranno riportate 10 battute valide per ciclo.</p>
        </div>
        <button type="button" onClick={saveCalibration} disabled={isSaving || hasBlockedReferenceInstrument} className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400">
          {isSaving ? "Salvataggio..." : "Salva verifica"}
        </button>
      </div>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold">{saveMessage}</p>
            {savedRecordId && (
              <Link href={isInternalVerification ? "/verifiche/" + savedRecordId + "/rapportino-interno" : "/verifiche/" + savedRecordId + "/rapporto"} className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
                {isInternalVerification ? "Vai al rapportino interno" : "Vai ai dati rapporto"}
              </Link>
            )}
          </div>
        </div>
      )}

      {saveError && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">{saveError}</div>}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <strong>Nota tecnica:</strong> rimangono 3 cicli. Ogni ciclo contiene 12 battute; per ogni ciclo il sistema elimina automaticamente la battuta più alta e la più bassa e salva 10 battute valide. Per ogni riga finale: errore medio = media(L1, L2, L3) - 80; errore medio % = errore medio / 80 × 100. Incudine nominale 80, LC ±3, campo 77/83.
      </div>
    </div>
  );
}
