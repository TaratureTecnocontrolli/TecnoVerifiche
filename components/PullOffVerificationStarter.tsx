"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CustomerVerificationSection, {
  buildVerificationSiteDescription,
  type VerificationCustomerSite,
} from "@/components/CustomerVerificationSection";
import { canonicalMeasurementUnit } from "@/lib/measurement-units";
import {
  combineReferenceInstrumentNames,
  getPullOffReportDefaults,
} from "@/lib/report-defaults";
import ReferenceInstrumentMultiSelect, {
  getEffectiveReferenceInstrumentStatus,
  getInstrumentRange,
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

type EditablePullOffPoint = {
  id: string;
  nominalLoad: string;
  reading1: string;
  reading2: string;
  reading3: string;
  tolerancePercent: string;
  notes: string;
};

type CalculatedPullOffPoint = {
  id: string;
  nominalLoad: number;
  reading1: number;
  reading2: number;
  reading3: number;
  average: number;
  min: number;
  max: number;
  error: number;
  errorPercent: number;
  repeatabilityPercent: number;
  tolerancePercent: number | null;
  result: string | null;
};

type PullOffVerificationStarterProps = {
  verificationScope: VerificationScope;
  customers: Customer[];
  customerInstruments: CustomerInstrument[];
  internalInstruments: InternalInstrument[];
  referenceInstruments: ReferenceInstrument[];
};

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
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

function nullableNumberFromInput(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  return toNumber(value);
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

function numberToInputValue(value: number) {
  return String(value).replace(".", ",");
}

function formatItalianNumber(value: number | null | undefined, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function emptyPullOffPoint(index: number): EditablePullOffPoint {
  return {
    id: crypto.randomUUID(),
    nominalLoad: numberToInputValue((index + 1) * 10),
    reading1: "",
    reading2: "",
    reading3: "",
    tolerancePercent: "",
    notes: "",
  };
}

function calculatePullOffPoint(point: EditablePullOffPoint): CalculatedPullOffPoint {
  const nominalLoad = toNumber(point.nominalLoad);
  const reading1 = toNumber(point.reading1);
  const reading2 = toNumber(point.reading2);
  const reading3 = toNumber(point.reading3);
  const values = [reading1, reading2, reading3];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const error = nominalLoad - average;
  const errorPercent = nominalLoad !== 0 ? (error / nominalLoad) * 100 : 0;
  const repeatabilityPercent = average !== 0 ? ((max - min) / average) * 100 : 0;
  const tolerancePercent = nullableNumberFromInput(point.tolerancePercent);
  const result = tolerancePercent === null
    ? null
    : Math.abs(errorPercent) <= tolerancePercent
      ? "CONFORME"
      : "NON CONFORME";

  return {
    id: point.id,
    nominalLoad,
    reading1,
    reading2,
    reading3,
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

function buildFinalResult(points: CalculatedPullOffPoint[]) {
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
  customer: Customer,
  site: VerificationCustomerSite | null
) {
  return {
    customer_id: customer.id,
    customer_number: customer.customer_number ?? null,
    customer_name: getCustomerName(customer),
    site_id: site?.id ?? null,
    site_name: site?.name ?? null,
    site_address: site?.address ?? null,
    site_city: site?.city ?? null,
    site_province: site?.province ?? null,
    site_postal_code: site?.postal_code ?? null,
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
    code: "PROC_PULLOFF",
    name: "Procedura verifica strumentazione pull-off",
    revision: "0",
    calculation_engine_version: "pulloff-v1",
  };
}

export default function PullOffVerificationStarter({
  verificationScope,
  customers,
  customerInstruments,
  internalInstruments,
  referenceInstruments,
}: PullOffVerificationStarterProps) {
  const router = useRouter();
  const isInternalVerification = verificationScope === "VI";

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedSite, setSelectedSite] = useState<VerificationCustomerSite | null>(null);
  const [selectedCustomerInstrumentId, setSelectedCustomerInstrumentId] =
    useState("");
  const [selectedInternalInstrumentId, setSelectedInternalInstrumentId] =
    useState("");
  const [selectedReferenceInstrumentIds, setSelectedReferenceInstrumentIds] =
    useState<string[]>([]);
  const [verificationDate] = useState(todayInputDate());
  const location = isInternalVerification ? "" : buildVerificationSiteDescription(selectedSite);
  const [operatorName, setOperatorName] = useState("");
  const [ambientTemperature, setAmbientTemperature] = useState("");
  const [ambientHumidity, setAmbientHumidity] = useState("");
  const [notes, setNotes] = useState("");
  const [scaleName, setScaleName] = useState("Prova a trazione");
  const [scaleRange, setScaleRange] = useState("");
  const [scaleNotes, setScaleNotes] = useState("");
  const [points, setPoints] = useState<EditablePullOffPoint[]>(() =>
    Array.from({ length: 5 }, (_, index) => emptyPullOffPoint(index))
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);


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

      return (text.includes("pull-off") || text.includes("pulloff") || text.includes("trazione") || text.includes("cella di carico") || text.includes(" kn"));
    });

    return filtered.length > 0 ? filtered : internalInstruments;
  }, [internalInstruments]);

  const pullOffReferenceInstruments = useMemo(() => {
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
        text.includes("cella di carico") ||
        text.includes("pull-off") ||
        text.includes("pulloff") ||
        text.includes("trazione") ||
        text.includes(" kn")
      );
    });
  }, [referenceInstruments]);

  const availableReferenceInstruments =
    pullOffReferenceInstruments.length > 0
      ? pullOffReferenceInstruments
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

  const pullOffUnit = canonicalMeasurementUnit(
    selectedCustomerInstrument?.unit ||
    selectedInternalInstrument?.unit ||
    selectedReferenceInstruments[0]?.unit ||
    "kN"
  );

  const calculatedPoints = useMemo(() => {
    return points.map(calculatePullOffPoint);
  }, [points]);

  function resetSaveState() {
    setSaveError("");
    setSaveMessage("");
    setSavedRecordId(null);
  }

  function updatePoint(
    pointId: string,
    field: keyof EditablePullOffPoint,
    value: string
  ) {
    const normalizedValue = field === "notes" ? value : normalizeEuropeanDecimalInput(value);

    resetSaveState();
    setPoints((current) =>
      current.map((point) =>
        point.id === pointId ? { ...point, [field]: normalizedValue } : point
      )
    );
  }

  function addPoint() {
    resetSaveState();
    setPoints((current) => [...current, emptyPullOffPoint(current.length)]);
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

      if (!scaleName.trim()) {
        throw new Error("Inserisci il nome della scala/prova.");
      }

      if (points.length === 0) {
        throw new Error("Inserisci almeno un punto di carico.");
      }

      const invalidPoint = points.find((point) => {
        return (
          point.nominalLoad.trim() === "" ||
          point.reading1.trim() === "" ||
          point.reading2.trim() === "" ||
          point.reading3.trim() === ""
        );
      });

      if (invalidPoint) {
        throw new Error("Compila carico applicato e le tre letture per tutti i punti.");
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
          selectedCustomer,
          selectedSite
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
        .eq("code", "PULLOFF")
        .maybeSingle();

      const { data: insertedRecord, error: insertError } = await supabase
        .from("calibration_records")
        .insert({
          record_number: null,
          calibration_type_id: calibrationType?.id ?? null,
          mode: "pulloff",
          verification_module: "PULLOFF",
          verification_date: verificationDate,
          operator_name: operatorName.trim() || null,
          location: location || null,
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
          : primaryReference.name || "Cella di carico";

      const reportDefaults = getPullOffReportDefaults({
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
        location,
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
          site_description: location || null,
          work_object: isInternalVerification
            ? "Verifica interna di " + instrumentName
            : reportDefaults.work_object,
          requested_tests: isInternalVerification
            ? "Verifica interna pull-off."
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

      const { data: insertedScale, error: scaleError } = await supabase
        .from("calibration_record_scales")
        .insert({
          calibration_record_id: insertedRecord.id,
          scale_order: 1,
          scale_name: scaleName.trim(),
          scale_range: scaleRange.trim() || instrumentRange || getRange(primaryReference) || null,
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

      const measurementRows = calculatedPoints.map((point, pointIndex) => {
        const editablePoint = points[pointIndex];

        return {
          calibration_record_id: insertedRecord.id,
          scale_id: insertedScale.id,
          section: scaleName.trim(),
          point_order: pointIndex + 1,
          nominal_value: point.nominalLoad,
          applied_value: point.nominalLoad,
          cycle_1: point.reading1,
          cycle_2: point.reading2,
          cycle_3: point.reading3,
          max_value: point.max,
          min_value: point.min,
          average_value: point.average,
          mean_error: point.error,
          accuracy_error_percent: point.errorPercent,
          repeatability_error_percent: point.repeatabilityPercent,
          result: point.result,
          notes:
            editablePoint.notes.trim() ||
            (point.tolerancePercent !== null
              ? "Tolleranza errore: ±" + String(point.tolerancePercent).replace(".", ",") + "%"
              : null),
        };
      });

      const { error: measurementError } = await supabase
        .from("calibration_measurements")
        .insert(measurementRows);

      if (measurementError) {
        throw new Error(measurementError.message || "Errore durante il salvataggio delle misure.");
      }

      const finalResult = buildFinalResult(calculatedPoints);

      await supabase
        .from("calibration_records")
        .update({ final_result: finalResult })
        .eq("id", insertedRecord.id);

      setSavedRecordId(insertedRecord.id);
      setSaveMessage("Verifica pull-off salvata correttamente. Risultato finale: " + finalResult + ".");
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
          Dati generali verifica pull-off
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

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
            <span className="text-sm font-medium text-slate-700">Temperatura ambiente °C</span>
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
            <span className="text-sm font-medium text-slate-700">Umidità ambiente %</span>
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

      {!isInternalVerification ? (
        <CustomerVerificationSection
          customers={customers}
          customerInstruments={customerInstruments}
          selectedCustomerId={selectedCustomerId}
          selectedSiteId={selectedSiteId}
          selectedInstrumentId={selectedCustomerInstrumentId}
          onCustomerChange={(customerId) => {
            setSelectedCustomerId(customerId);
            setSelectedCustomerInstrumentId("");
            resetSaveState();
          }}
          onSiteChange={(siteId, site) => {
            setSelectedSiteId(siteId);
            setSelectedSite(site);
            resetSaveState();
          }}
          onInstrumentChange={(instrumentId) => {
            setSelectedCustomerInstrumentId(instrumentId);
            resetSaveState();
          }}
        />
      ) : (
        <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Strumento interno verificato</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">Strumento interno *</span>
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
                    {instrument.internal_code ? instrument.internal_code + " - " : ""}
                    {instrument.name}
                    {instrument.model ? " - " + instrument.model : ""}
                    {instrument.serial_number ? " - Matr. " + instrument.serial_number : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedInternalInstrument && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div><p className="font-semibold">Strumento</p><p>{selectedInternalInstrument.name}</p></div>
                <div><p className="font-semibold">Costruttore / modello</p><p>{[selectedInternalInstrument.manufacturer, selectedInternalInstrument.model].filter(Boolean).join(" - ") || "-"}</p></div>
                <div><p className="font-semibold">Matricola</p><p>{selectedInternalInstrument.serial_number ?? "-"}</p></div>
                <div><p className="font-semibold">Codice interno</p><p>{selectedInternalInstrument.internal_code ?? "-"}</p></div>
                <div><p className="font-semibold">Grandezza / unità</p><p>{[selectedInternalInstrument.measurement_quantity, selectedInternalInstrument.unit].filter(Boolean).join(" / ") || "-"}</p></div>
                <div><p className="font-semibold">Fondo scala</p><p>{selectedInternalInstrument.measurement_range ?? "-"}</p></div>
                <div><p className="font-semibold">Reparto</p><p>{selectedInternalInstrument.department ?? "-"}</p></div>
                <div><p className="font-semibold">Ubicazione</p><p>{selectedInternalInstrument.location ?? "-"}</p></div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Strumenti campione</h2>
        <div className="mt-5">
          <ReferenceInstrumentMultiSelect
            instruments={availableReferenceInstruments}
            selectedIds={selectedReferenceInstrumentIds}
            onToggle={toggleReferenceInstrument}
            label="Strumenti campione usati *"
            emptyLabel="Nessuno strumento campione disponibile."
          />
        </div>
      </section>

      {selectedReferenceInstruments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Anteprima celle di carico selezionate
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
                      {instrument.name || "Cella di carico"}
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
                        {getInstrumentRange(instrument) ?? "-"}
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
                      Questa cella di carico non è utilizzabile perché risulta
                      scaduta o fuori servizio.
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
            Dati tecnici pull-off
          </h2>
          <p className="text-sm text-slate-500">
            Inserisci subito i punti di carico e le letture, come nelle altre tipologie di verifica.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nome scala/prova *</span>
              <input
                value={scaleName}
                onChange={(event) => {
                  setScaleName(event.target.value);
                  resetSaveState();
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Campo scala</span>
              <input
                value={scaleRange}
                onChange={(event) => {
                  setScaleRange(event.target.value);
                  resetSaveState();
                }}
                placeholder={"Es. 0 - 50 " + pullOffUnit}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Note scala</span>
              <input
                value={scaleNotes}
                onChange={(event) => {
                  setScaleNotes(event.target.value);
                  resetSaveState();
                }}
                placeholder="Eventuali note tecniche"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Punto</th>
                <th className="px-4 py-3">Carico applicato ({pullOffUnit})</th>
                <th className="bg-red-100 px-4 py-3 text-red-900">Lettura 1 ({pullOffUnit})</th>
                <th className="bg-slate-100 px-4 py-3 text-slate-900">Lettura 2 ({pullOffUnit})</th>
                <th className="bg-red-100 px-4 py-3 text-red-900">Lettura 3 ({pullOffUnit})</th>
                <th className="px-4 py-3">Media ({pullOffUnit})</th>
                <th className="px-4 py-3">Errore ({pullOffUnit})</th>
                <th className="px-4 py-3">Errore %</th>
                <th className="px-4 py-3">Ripetibilità %</th>
                <th className="px-4 py-3">Toll. %</th>
                <th className="px-4 py-3">Esito</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {calculatedPoints.map((point, pointIndex) => {
                const editablePoint = points[pointIndex];

                return (
                  <tr key={point.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{pointIndex + 1}</td>
                    <td className="px-4 py-3">
                      <input type="text" inputMode="decimal" value={editablePoint?.nominalLoad ?? ""} onChange={(event) => updatePoint(point.id, "nominalLoad", event.target.value)} className="w-28 rounded-lg border border-slate-300 px-2 py-1" />
                    </td>
                    <td className="bg-white px-4 py-3">
                      <input type="text" inputMode="decimal" value={editablePoint?.reading1 ?? ""} onChange={(event) => updatePoint(point.id, "reading1", event.target.value)} className="w-24 rounded-lg border border-red-300 bg-white px-2 py-1 font-semibold text-red-950" />
                    </td>
                    <td className="bg-slate-50 px-4 py-3">
                      <input type="text" inputMode="decimal" value={editablePoint?.reading2 ?? ""} onChange={(event) => updatePoint(point.id, "reading2", event.target.value)} className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-950" />
                    </td>
                    <td className="bg-white px-4 py-3">
                      <input type="text" inputMode="decimal" value={editablePoint?.reading3 ?? ""} onChange={(event) => updatePoint(point.id, "reading3", event.target.value)} className="w-24 rounded-lg border border-red-300 bg-white px-2 py-1 font-semibold text-red-950" />
                    </td>
                    <td className="px-4 py-3">{formatItalianNumber(point.average)}</td>
                    <td className="px-4 py-3">{formatItalianNumber(point.error)}</td>
                    <td className="px-4 py-3">{formatItalianNumber(point.errorPercent)}</td>
                    <td className="px-4 py-3">{formatItalianNumber(point.repeatabilityPercent)}</td>
                    <td className="px-4 py-3">
                      <input type="text" inputMode="decimal" value={editablePoint?.tolerancePercent ?? ""} onChange={(event) => updatePoint(point.id, "tolerancePercent", event.target.value)} placeholder="es. 4" className="w-20 rounded-lg border border-slate-300 px-2 py-1" />
                    </td>
                    <td className="px-4 py-3">
                      {point.result ? (
                        <span className={point.result === "CONFORME" ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"}>{point.result}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
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
            <button type="button" onClick={addPoint} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Aggiungi punto</button>
          </div>
        </div>
      </section>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <div className="font-semibold">{saveMessage}</div>
          {savedRecordId && (
            <button
              type="button"
              onClick={() => router.push(`/verifiche/${savedRecordId}/misure-pulloff`)}
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
          {isSaving ? "Salvataggio..." : "Salva verifica pull-off"}
        </button>
      </div>
    </form>
  );
}
