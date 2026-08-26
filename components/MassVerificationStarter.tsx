"use client";

import Link from "next/link";
import { type KeyboardEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  combineReferenceInstrumentNames,
  getMassReportDefaults,
} from "@/lib/report-defaults";
import ReferenceInstrumentMultiSelect, {
  getEffectiveReferenceInstrumentStatus,
  isReferenceInstrumentBlocked,
} from "@/components/ReferenceInstrumentMultiSelect";
import SimpleAccuracyChart from "@/components/SimpleAccuracyChart";

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

type MassSectionKey = "repeatability" | "eccentricity" | "linearity";

type EditableWeightPoint = {
  id: string;
  nominalWeight: string;
  referenceWeight: string;
  reading1: string;
  reading2: string;
  reading3: string;
  notes: string;
};

type MassSection = {
  key: MassSectionKey;
  title: string;
  description: string;
  scaleName: string;
  scaleRange: string;
  unit: "kg" | "g";
  notes: string;
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

type MassVerificationStarterProps = {
  verificationScope: VerificationScope;
  customers: Customer[];
  customerInstruments: CustomerInstrument[];
  internalInstruments: InternalInstrument[];
  referenceInstruments: ReferenceInstrument[];
};

const ECCENTRICITY_ZONE_LABELS = [
  "Zona C",
  "Zona 3",
  "Zona 4",
  "Zona 1",
  "Zona 2",
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

function buildProcedureSnapshot() {
  return {
    code: "PROC_MASS",
    name: "Procedura verifica bilance / misura della massa",
    revision: "0",
    calculation_engine_version: "mass-v1",
  };
}

function emptyPoint(): EditableWeightPoint {
  return {
    id: crypto.randomUUID(),
    nominalWeight: "",
    referenceWeight: "",
    reading1: "",
    reading2: "",
    reading3: "",
    notes: "",
  };
}

function makeSection(
  key: MassSectionKey,
  title: string,
  description: string,
  defaultPointCount: number
): MassSection {
  return {
    key,
    title,
    description,
    scaleName: title,
    scaleRange: "",
    unit: "kg",
    notes: "",
    points: Array.from({ length: defaultPointCount }, emptyPoint),
  };
}

function buildInitialSections(): Record<MassSectionKey, MassSection> {
  return {
    repeatability: makeSection(
      "repeatability",
      "Ripetibilità",
      "Prova su uno o più punti di carico con tre letture ripetute.",
      1
    ),
    eccentricity: makeSection(
      "eccentricity",
      "Eccentricità",
      "Zona centrale e zone periferiche del piatto di pesata.",
      5
    ),
    linearity: makeSection(
      "linearity",
      "Linearità",
      "Punti distribuiti sull’intero campo di pesata dello strumento.",
      5
    ),
  };
}

function scaleRangeWithUnit(section: MassSection) {
  const range = section.scaleRange.trim();

  if (!range) {
    return null;
  }

  const rangeWithoutMassUnit = range.replace(/\s*(?:kg|g)\s*$/i, "").trim();

  return rangeWithoutMassUnit + " " + section.unit;
}

function calculateWeightPoint(
  point: EditableWeightPoint,
  hasErrorPercent: boolean
): CalculatedWeightPoint {
  const nominalWeight = toNumber(point.nominalWeight);
  const referenceWeight = nominalWeight;
  const reading1 = toNumber(point.reading1);
  const reading2 = toNumber(point.reading2);
  const reading3 = toNumber(point.reading3);
  const values = [reading1, reading2, reading3];

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
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


function massPointLabel(sectionKey: MassSectionKey, index: number) {
  if (sectionKey === "eccentricity") {
    return ECCENTRICITY_ZONE_LABELS[index] || "Zona " + String(index + 1);
  }

  if (sectionKey === "repeatability" || sectionKey === "linearity") {
    return "Zona C";
  }

  return "Punto " + String(index + 1);
}

export default function MassVerificationStarter({
  verificationScope,
  customers = [],
  customerInstruments = [],
  internalInstruments = [],
  referenceInstruments = [],
}: MassVerificationStarterProps) {
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
  const [ambientTemperature, setAmbientTemperature] = useState("");
  const [ambientHumidity, setAmbientHumidity] = useState("");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<Record<MassSectionKey, MassSection>>(
    () => buildInitialSections()
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
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
    const massOnly = internalInstruments.filter((instrument) => {
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
        text.includes("massa") ||
        text.includes("bilancia") ||
        text.includes("peso") ||
        text.includes(" kg") ||
        text.includes("grammi") ||
        text.includes(" g ")
      );
    });

    return massOnly.length > 0 ? massOnly : internalInstruments;
  }, [internalInstruments]);

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
        text.includes("bilancia") ||
        text.includes("peso") ||
        text.includes(" kg") ||
        text.includes("grammi") ||
        text.includes(" g ")
      );
    });

    return massOnly.length > 0 ? massOnly : referenceInstruments;
  }, [referenceInstruments]);

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

  const calculatedRepeatability = useMemo(
    () =>
      sections.repeatability.points.map((point) =>
        calculateWeightPoint(point, false)
      ),
    [sections.repeatability.points]
  );

  const calculatedEccentricity = useMemo(
    () =>
      sections.eccentricity.points.map((point) =>
        calculateWeightPoint(point, false)
      ),
    [sections.eccentricity.points]
  );

  const calculatedLinearity = useMemo(
    () =>
      sections.linearity.points.map((point) =>
        calculateWeightPoint(point, true)
      ),
    [sections.linearity.points]
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

  function handleCycleTab(
    event: KeyboardEvent<HTMLInputElement>,
    sectionKey: MassSectionKey,
    field: string
  ) {
    if (event.key !== "Tab" || event.shiftKey) {
      return;
    }

    const currentInput = event.currentTarget;
    const currentRow = currentInput.closest("tr");
    let nextRow = currentRow?.nextElementSibling;

    while (nextRow) {
      const nextInput = nextRow.querySelector<HTMLInputElement>(
        'input[data-mass-section="' +
          sectionKey +
          '"][data-cycle-field="' +
          field +
          '"]'
      );

      if (nextInput) {
        event.preventDefault();
        nextInput.focus();
        nextInput.select();
        return;
      }

      nextRow = nextRow.nextElementSibling;
    }
  }

  function updateSectionField(
    sectionKey: MassSectionKey,
    field: "scaleName" | "scaleRange" | "unit" | "notes",
    value: string
  ) {
    resetSaveState();

    setSections((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [field]: field === "unit" ? (value === "g" ? "g" : "kg") : value,
      },
    }));
  }

  function updatePoint(
    sectionKey: MassSectionKey,
    pointId: string,
    field: keyof Omit<EditableWeightPoint, "id">,
    value: string
  ) {
    const normalizedValue =
      field === "notes" ? value : normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setSections((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        points: current[sectionKey].points.map((point) => {
          if (point.id !== pointId) {
            return point;
          }

          if (field === "nominalWeight") {
            return {
              ...point,
              nominalWeight: normalizedValue,
              referenceWeight: normalizedValue,
            };
          }

          return { ...point, [field]: normalizedValue };
        }),
      },
    }));
  }

  function addPoint(sectionKey: MassSectionKey) {
    resetSaveState();

    setSections((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        points: [...current[sectionKey].points, emptyPoint()],
      },
    }));
  }

  function removePoint(sectionKey: MassSectionKey, pointId: string) {
    resetSaveState();

    setSections((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        points: current[sectionKey].points.filter((point) => point.id !== pointId),
      },
    }));
  }

  function getCalculatedPoints(sectionKey: MassSectionKey) {
    if (sectionKey === "repeatability") {
      return calculatedRepeatability;
    }

    if (sectionKey === "eccentricity") {
      return calculatedEccentricity;
    }

    return calculatedLinearity;
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

    if (!verificationDate) {
      throw new Error("Inserisci la data della verifica.");
    }

    if (selectedReferenceInstruments.length === 0) {
      throw new Error("Seleziona almeno una massa campione da utilizzare.");
    }

    if (hasBlockedReferenceInstrument) {
      throw new Error(
        "Una delle masse campione selezionate è scaduta o fuori servizio. Seleziona solo campioni validi."
      );
    }

    const allSections = Object.values(sections);

    for (const section of allSections) {
      if (!section.scaleName.trim()) {
        throw new Error("Inserisci il nome di tutte le prove.");
      }

      if (section.points.length === 0) {
        throw new Error("Inserisci almeno un punto per ogni prova.");
      }

      const invalidPoint = section.points.find((point) => {
        return (
          point.nominalWeight.trim() === "" ||
          point.reading1.trim() === "" ||
          point.reading2.trim() === "" ||
          point.reading3.trim() === ""
        );
      });

      if (invalidPoint) {
        throw new Error(
          "Compila peso nominale e i tre cicli per tutti i punti delle tre prove."
        );
      }
    }
  }

  async function saveCalibration() {
    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");
    setSavedRecordId(null);

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

      const procedureSnapshot = buildProcedureSnapshot();

      const { data: calibrationType } = await supabase
        .from("calibration_types")
        .select("id")
        .eq("code", "MASS")
        .maybeSingle();

      const { data: insertedRecord, error: insertError } = await supabase
        .from("calibration_records")
        .insert({
          record_number: null,
          calibration_type_id: calibrationType?.id ?? null,
          mode: "massa",
          verification_module: "MASS",
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
          : primaryReference.name || "Massa campione";

      const reportDefaults = getMassReportDefaults({
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
            ? "Verifica interna di bilancia / strumento di misura della massa."
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

      const sectionList = [
        sections.repeatability,
        sections.eccentricity,
        sections.linearity,
      ];

      const scaleRows = sectionList.map((section, index) => ({
        calibration_record_id: insertedRecord.id,
        scale_order: index + 1,
        scale_name: section.scaleName.trim(),
        scale_range: scaleRangeWithUnit(section),
        reference_instrument_id: primaryReference.id,
        reference_instrument_snapshot: primaryReferenceSnapshot,
        reference_instrument_ids: selectedReferenceInstruments.map(
          (instrument) => instrument.id
        ),
        reference_instruments_snapshot: referenceSnapshots,
        notes: section.notes.trim() || null,
      }));

      const { data: insertedScales, error: scaleError } = await supabase
        .from("calibration_record_scales")
        .insert(scaleRows)
        .select("id, scale_order");

      if (scaleError || !insertedScales) {
        throw new Error(
          scaleError?.message ||
            "Verifica creata, ma errore nel salvataggio delle prove."
        );
      }

      const scaleIdByOrder = new Map(
        insertedScales.map((scale) => [scale.scale_order as number, scale.id as string])
      );

      const measurementRows = sectionList.flatMap((section, sectionIndex) => {
        const scaleId = scaleIdByOrder.get(sectionIndex + 1);

        if (!scaleId) {
          return [];
        }

        const calculatedPoints = getCalculatedPoints(section.key);

        return section.points.map((editablePoint, pointIndex) => {
          const calculatedPoint = calculatedPoints[pointIndex];

          return {
            calibration_record_id: insertedRecord.id,
            scale_id: scaleId,
            section: section.scaleName.trim(),
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
      setSaveMessage(
        "Verifica massa salvata correttamente. Data " +
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

  function renderSection(section: MassSection) {
    const calculatedPoints = getCalculatedPoints(section.key);

    return (
      <section
        key={section.key}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {section.title}
              </h2>
              <p className="text-sm text-slate-500">{section.description}</p>

              {section.key === "eccentricity" && eccentricityValue !== null && (
                <p className="mt-2 text-sm text-slate-700">
                  Eccentricità media calcolata:{" "}
                  <strong>{formatItalianNumber(eccentricityValue)} %</strong>
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Nome prova *
              </span>
              <input
                value={section.scaleName}
                onChange={(event) =>
                  updateSectionField(section.key, "scaleName", event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Fondo scala
              </span>
              <input
                value={section.scaleRange}
                onChange={(event) =>
                  updateSectionField(section.key, "scaleRange", event.target.value)
                }
                placeholder={"Es. 0 - 30 " + section.unit}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Unità scala
              </span>
              <select
                value={section.unit}
                onChange={(event) =>
                  updateSectionField(section.key, "unit", event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">Note prova</span>
            <input
              value={section.notes}
              onChange={(event) =>
                updateSectionField(section.key, "notes", event.target.value)
              }
              placeholder="Eventuali note sulla prova"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {section.key === "eccentricity" && (
            <div className="mt-5 grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 lg:grid-cols-[220px_1fr] lg:items-center">
              <div className="flex justify-center">
                <img
                  src="/eccentricita.png"
                  alt="Schema posizioni prova di eccentricità: zona centrale C e zone 1, 2, 3, 4"
                  className="max-h-44 rounded-xl border border-amber-200 bg-white p-2"
                />
              </div>

              <div>
                <p className="font-semibold">Schema prova di eccentricità</p>
                <p className="mt-1">
                  Inserisci le letture seguendo le zone indicate nello schema:
                  centro <strong>C</strong> e punti periferici <strong>1</strong>,{" "}
                  <strong>2</strong>, <strong>3</strong>, <strong>4</strong>.
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  La tabella usa le etichette Zona C, Zona 3, Zona 4, Zona 1 e Zona 2
                  secondo l’ordine operativo già impostato nel modulo.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  {section.key === "eccentricity" || section.key === "repeatability" || section.key === "linearity" ? "Zona" : "Punto"}
                </th>
                <th className="px-4 py-3">Peso nominale ({section.unit})</th>
                <th className="bg-amber-100 px-4 py-3 text-amber-900">
                  Ciclo 1 ({section.unit})
                </th>
                <th className="bg-slate-100 px-4 py-3 text-slate-900">
                  Ciclo 2 ({section.unit})
                </th>
                <th className="bg-amber-100 px-4 py-3 text-amber-900">
                  Ciclo 3 ({section.unit})
                </th>
                <th className="px-4 py-3">Media ({section.unit})</th>
                <th className="px-4 py-3">Errore ({section.unit})</th>
                {section.key === "linearity" && (
                  <th className="px-4 py-3">Errore %</th>
                )}
                <th className="px-4 py-3">Ripetibilità %</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {section.points.map((point, index) => {
                const calculatedPoint = calculatedPoints[index];
                const label = massPointLabel(section.key, index);

                return (
                  <tr key={point.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {label}
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={point.nominalWeight}
                        onChange={(event) =>
                          updatePoint(
                            section.key,
                            point.id,
                            "nominalWeight",
                            event.target.value
                          )
                        }
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>

                    <td className="bg-white px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={point.reading1}
                        data-mass-section={section.key}
                        data-cycle-field="reading1"
                        onKeyDown={(event) =>
                          handleCycleTab(event, section.key, "reading1")
                        }
                        onChange={(event) =>
                          updatePoint(section.key, point.id, "reading1", event.target.value)
                        }
                        className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </td>

                    <td className="bg-slate-50 px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={point.reading2}
                        data-mass-section={section.key}
                        data-cycle-field="reading2"
                        onKeyDown={(event) =>
                          handleCycleTab(event, section.key, "reading2")
                        }
                        onChange={(event) =>
                          updatePoint(section.key, point.id, "reading2", event.target.value)
                        }
                        className="w-20 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-950 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </td>

                    <td className="bg-white px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={point.reading3}
                        data-mass-section={section.key}
                        data-cycle-field="reading3"
                        onKeyDown={(event) =>
                          handleCycleTab(event, section.key, "reading3")
                        }
                        onChange={(event) =>
                          updatePoint(section.key, point.id, "reading3", event.target.value)
                        }
                        className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </td>

                    <td className="px-4 py-3">
                      {formatItalianNumber(calculatedPoint.average)}
                    </td>
                    <td className="px-4 py-3">
                      {formatItalianNumber(calculatedPoint.error)}
                    </td>

                    {section.key === "linearity" && (
                      <td className="px-4 py-3">
                        {formatItalianNumber(calculatedPoint.errorPercent)}
                      </td>
                    )}

                    <td className="px-4 py-3">
                      {formatItalianNumber(calculatedPoint.repeatabilityPercent)}
                    </td>

                    <td className="px-4 py-3">
                      {section.points.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePoint(section.key, point.id)}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Elimina
                        </button>
                      )}
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
              onClick={() => addPoint(section.key)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Aggiungi punto
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200 p-5">
          <SimpleAccuracyChart
            title={"Grafico errore % - " + section.scaleName}
            lineColor="#d97706"
            points={calculatedPoints.map((point, index) => ({
              label:
                point.nominalWeight !== 0
                  ? formatItalianNumber(point.nominalWeight, 2)
                  : section.key === "eccentricity"
                    ? ECCENTRICITY_ZONE_LABELS[index] ||
                      "Zona " + String(index + 1)
                    : massPointLabel(section.key, index),
              value:
                section.key === "linearity"
                  ? point.errorPercent
                  : point.repeatabilityPercent,
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
          Dati generali verifica massa
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <span className="text-sm font-medium text-slate-700">Tecnico</span>
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

          <label className="mt-5 block space-y-1">
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
          Masse campione usate
        </h2>

        <div className="mt-5">
          <ReferenceInstrumentMultiSelect
            instruments={availableReferenceInstruments}
            selectedIds={selectedReferenceInstrumentIds}
            onToggle={toggleReferenceInstrument}
            label="Masse campione usate *"
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
                      label="Massa"
                      value={instrument.name || "Massa campione"}
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

                  {blocked && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      Questa massa campione non è utilizzabile perché risulta
                      scaduta o fuori servizio.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {renderSection(sections.repeatability)}
      {renderSection(sections.eccentricity)}
      {renderSection(sections.linearity)}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salvataggio verifica massa
          </h2>
          <p className="text-sm text-slate-500">
            La verifica viene salvata completa di dati iniziali, masse campione,
            ripetibilità, eccentricità, linearità e misure.
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
            <p className="font-semibold">{saveMessage}</p>

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
        <strong>Nota tecnica:</strong> ripetibilità ed eccentricità riportano il
        grafico della ripetibilità percentuale; linearità riporta il grafico
        dell’errore percentuale. Il peso campione viene assunto uguale al peso
        nominale inserito, evitando una doppia compilazione. Le letture sono su
        tre cicli.
      </div>
    </div>
  );
}