"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  calculatePressurePoints,
  type PressurePhase,
  type PressurePointInput,
} from "@/lib/calculations/pressure";
import { supabase } from "@/lib/supabase";
import PressureErrorChart from "./PressureErrorChart";

type Customer = {
  id: string;
  customer_number: string | null;
  business_name: string;
};

type CustomerSite = {
  id: string;
  customer_id: string;
  name: string;
  city: string | null;
  province: string | null;
};

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
  certificate_file_url: string | null;
  certificate_file_name: string | null;
  status: string;
};

type CustomerInstrument = {
  id: string;
  customer_id: string | null;
  site_id: string | null;
  customer_name: string | null;
  site: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  resolution: string | null;
  acceptance_class: string | null;
};

type CalibrationProcedure = {
  id: string;
  code: string;
  name: string;
  revision: string;
  revision_date: string | null;
  normative_reference: string | null;
  calculation_engine_version: string;
};

type EditablePressurePoint = {
  id: string;
  phase: PressurePhase;
  verificationPoint: string;
  appliedValue: string;
  reading1: string;
  reading2: string;
  reading3: string;
};

const defaultPressurePoints: EditablePressurePoint[] = [
  { id: "carico-1", phase: "carico", verificationPoint: "0", appliedValue: "0", reading1: "0", reading2: "0", reading3: "0" },
  { id: "carico-2", phase: "carico", verificationPoint: "1", appliedValue: "1", reading1: "", reading2: "", reading3: "" },
  { id: "carico-3", phase: "carico", verificationPoint: "2", appliedValue: "2", reading1: "", reading2: "", reading3: "" },
  { id: "carico-4", phase: "carico", verificationPoint: "4", appliedValue: "4", reading1: "", reading2: "", reading3: "" },
  { id: "carico-5", phase: "carico", verificationPoint: "6", appliedValue: "6", reading1: "", reading2: "", reading3: "" },
  { id: "carico-6", phase: "carico", verificationPoint: "8", appliedValue: "8", reading1: "", reading2: "", reading3: "" },
  { id: "carico-7", phase: "carico", verificationPoint: "10", appliedValue: "10", reading1: "", reading2: "", reading3: "" },
  { id: "scarico-1", phase: "scarico", verificationPoint: "8", appliedValue: "8", reading1: "", reading2: "", reading3: "" },
  { id: "scarico-2", phase: "scarico", verificationPoint: "6", appliedValue: "6", reading1: "", reading2: "", reading3: "" },
  { id: "scarico-3", phase: "scarico", verificationPoint: "4", appliedValue: "4", reading1: "", reading2: "", reading3: "" },
  { id: "scarico-4", phase: "scarico", verificationPoint: "2", appliedValue: "2", reading1: "", reading2: "", reading3: "" },
  { id: "scarico-5", phase: "scarico", verificationPoint: "1", appliedValue: "1", reading1: "", reading2: "", reading3: "" },
  { id: "scarico-6", phase: "scarico", verificationPoint: "0", appliedValue: "0", reading1: "0", reading2: "0", reading3: "0" },
];

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

function editablePointToPressurePoint(
  point: EditablePressurePoint
): PressurePointInput {
  return {
    id: point.id,
    phase: point.phase,
    verificationPoint: toNumber(point.verificationPoint),
    appliedValue: toNumber(point.appliedValue),
    reading1: toNumber(point.reading1),
    reading2: toNumber(point.reading2),
    reading3: toNumber(point.reading3),
  };
}

function formatItalianNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 4,
  }).format(value);
}

function todayItalianDateLabel() {
  return new Intl.DateTimeFormat("it-IT").format(new Date());
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

function getEffectiveReferenceInstrumentStatus(
  status: string,
  certificateExpiry: string | null
) {
  if (status === "out_of_service") {
    return "out_of_service";
  }

  if (!certificateExpiry) {
    return status;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(certificateExpiry);
  expiry.setHours(0, 0, 0, 0);

  if (expiry.getTime() < today.getTime()) {
    return "expired";
  }

  const differenceDays = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (differenceDays <= 30) {
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
    certificate_file_url: instrument.certificate_file_url,
    certificate_file_name: instrument.certificate_file_name,
    status: getEffectiveReferenceInstrumentStatus(
      instrument.status,
      instrument.certificate_expiry
    ),
  };
}

export default function PressureCalibrationTable() {
  const [operatorName, setOperatorName] = useState("");
  const [location, setLocation] = useState("");
  const [environmentalConditions, setEnvironmentalConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [scaleName, setScaleName] = useState("Scala pressione");
  const [scaleRange, setScaleRange] = useState("");
  const [scaleNotes, setScaleNotes] = useState("");
  const [points, setPoints] =
    useState<EditablePressurePoint[]>(defaultPressurePoints);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [customerInstruments, setCustomerInstruments] = useState<
    CustomerInstrument[]
  >([]);
  const [referenceInstruments, setReferenceInstruments] = useState<
    ReferenceInstrument[]
  >([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedCustomerInstrumentId, setSelectedCustomerInstrumentId] =
    useState("");
  const [selectedReferenceInstrumentId, setSelectedReferenceInstrumentId] =
    useState("");

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [savedRecordNumber, setSavedRecordNumber] = useState<string | null>(
    null
  );

  const calculatedPoints = useMemo(() => {
    return calculatePressurePoints(
      points.map((point) => editablePointToPressurePoint(point))
    );
  }, [points]);

  const loadPoints = useMemo(
    () => calculatedPoints.filter((point) => point.phase === "carico"),
    [calculatedPoints]
  );

  const unloadPoints = useMemo(
    () => calculatedPoints.filter((point) => point.phase === "scarico"),
    [calculatedPoints]
  );

  const filteredSites = useMemo(() => {
    return sites.filter((site) => site.customer_id === selectedCustomerId);
  }, [sites, selectedCustomerId]);

  const filteredCustomerInstruments = useMemo(() => {
    return customerInstruments.filter((instrument) => {
      if (!selectedCustomerId || !selectedSiteId) {
        return false;
      }

      return (
        instrument.customer_id === selectedCustomerId &&
        instrument.site_id === selectedSiteId
      );
    });
  }, [customerInstruments, selectedCustomerId, selectedSiteId]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  const selectedSite = sites.find((site) => site.id === selectedSiteId);

  const selectedCustomerInstrument = customerInstruments.find(
    (instrument) => instrument.id === selectedCustomerInstrumentId
  );

  const selectedReferenceInstrument = referenceInstruments.find(
    (instrument) => instrument.id === selectedReferenceInstrumentId
  );

  const hasBlockedReferenceInstrument =
    selectedReferenceInstrument &&
    isReferenceInstrumentBlocked(
      getEffectiveReferenceInstrumentStatus(
        selectedReferenceInstrument.status,
        selectedReferenceInstrument.certificate_expiry
      )
    );

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      setLoadError("");

      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, customer_number, business_name")
        .eq("is_active", true)
        .order("business_name", { ascending: true });

      if (customersError) {
        setLoadError(customersError.message);
        setIsLoadingData(false);
        return;
      }

      const { data: sitesData, error: sitesError } = await supabase
        .from("customer_sites")
        .select("id, customer_id, name, city, province")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (sitesError) {
        setLoadError(sitesError.message);
        setIsLoadingData(false);
        return;
      }

      const { data: customerInstrumentsData, error: customerInstrumentsError } =
        await supabase
          .from("customer_instruments")
          .select(
            `
            id,
            customer_id,
            site_id,
            customer_name,
            site,
            name,
            manufacturer,
            model,
            serial_number,
            internal_code,
            measurement_quantity,
            unit,
            measurement_range,
            resolution,
            acceptance_class
          `
          )
          .order("name", { ascending: true });

      if (customerInstrumentsError) {
        setLoadError(customerInstrumentsError.message);
        setIsLoadingData(false);
        return;
      }

      const { data: referenceInstrumentsData, error: referenceInstrumentsError } =
        await supabase
          .from("reference_instruments")
          .select(
            `
            id,
            name,
            manufacturer,
            model,
            serial_number,
            internal_code,
            measurement_quantity,
            unit,
            measurement_range,
            certificate_number,
            certificate_expiry,
            certificate_file_url,
            certificate_file_name,
            status
          `
          )
          .order("name", { ascending: true });

      if (referenceInstrumentsError) {
        setLoadError(referenceInstrumentsError.message);
        setIsLoadingData(false);
        return;
      }

      setCustomers((customersData ?? []) as Customer[]);
      setSites((sitesData ?? []) as CustomerSite[]);
      setCustomerInstruments(
        (customerInstrumentsData ?? []) as CustomerInstrument[]
      );
      setReferenceInstruments(
        (referenceInstrumentsData ?? []) as ReferenceInstrument[]
      );

      setIsLoadingData(false);
    }

    loadData();
  }, []);

  function resetSaveState() {
    setSavedRecordId(null);
    setSavedRecordNumber(null);
    setSaveMessage("");
    setSaveError("");
  }

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    setSelectedSiteId("");
    setSelectedCustomerInstrumentId("");
    resetSaveState();
  }

  function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    setSelectedCustomerInstrumentId("");
    resetSaveState();
  }

  function updatePoint(
    pointId: string,
    field: keyof Omit<EditablePressurePoint, "id">,
    value: string
  ) {
    const normalizedValue = normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setPoints((currentPoints) =>
      currentPoints.map((point) =>
        point.id === pointId ? { ...point, [field]: normalizedValue } : point
      )
    );
  }

  function addPoint(phase: PressurePhase) {
    resetSaveState();

    setPoints((currentPoints) => {
      const phasePoints = currentPoints.filter((point) => point.phase === phase);
      const lastPoint = phasePoints[phasePoints.length - 1];
      const nextAppliedValue = lastPoint
        ? toNumber(lastPoint.appliedValue) + (phase === "carico" ? 1 : -1)
        : phase === "carico"
          ? 1
          : 0;

      return [
        ...currentPoints,
        {
          id: crypto.randomUUID(),
          phase,
          verificationPoint: numberToInputValue(nextAppliedValue),
          appliedValue: numberToInputValue(nextAppliedValue),
          reading1: "",
          reading2: "",
          reading3: "",
        },
      ];
    });
  }

  function removePoint(pointId: string) {
    resetSaveState();

    setPoints((currentPoints) =>
      currentPoints.filter((point) => point.id !== pointId)
    );
  }

  function validate() {
    if (!selectedCustomer) {
      throw new Error("Seleziona il cliente.");
    }

    if (!selectedSite) {
      throw new Error("Seleziona la sede del cliente.");
    }

    if (!selectedCustomerInstrument) {
      throw new Error("Seleziona lo strumento cliente da verificare.");
    }

    if (!selectedReferenceInstrument) {
      throw new Error("Seleziona lo strumento campione usato.");
    }

    if (isReferenceInstrumentBlocked(selectedReferenceInstrument.status)) {
      throw new Error(
        "Lo strumento campione usato è scaduto o fuori servizio."
      );
    }

    if (!scaleName.trim()) {
      throw new Error("Inserisci il nome della scala.");
    }

    if (points.length === 0) {
      throw new Error("Inserisci almeno un punto di misura.");
    }

    const invalidPoint = points.find((point) => {
      return (
        point.verificationPoint.trim() === "" ||
        point.appliedValue.trim() === "" ||
        point.reading1.trim() === "" ||
        point.reading2.trim() === "" ||
        point.reading3.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error(
        "Compila punti di verifica, carico applicato e le tre letture per tutti i punti."
      );
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

      if (!selectedCustomer || !selectedSite || !selectedCustomerInstrument) {
        throw new Error("Dati cliente/strumento incompleti.");
      }

      if (!selectedReferenceInstrument) {
        throw new Error("Strumento campione usato non selezionato.");
      }

      const { data: calibrationType, error: typeError } = await supabase
        .from("calibration_types")
        .select("id")
        .eq("code", "PRESSURE")
        .single();

      if (typeError || !calibrationType) {
        throw new Error(
          "Tipo verifica PRESSURE non trovato. Esegui prima lo SQL del modulo pressione."
        );
      }

      const { data: procedure, error: procedureError } = await supabase
        .from("calibration_procedures")
        .select(
          `
          id,
          code,
          name,
          revision,
          revision_date,
          normative_reference,
          calculation_engine_version
        `
        )
        .eq("code", "PROC_PRESSURE")
        .eq("is_active", true)
        .order("revision_date", { ascending: false })
        .limit(1)
        .single();

      if (procedureError || !procedure) {
        throw new Error(
          "Procedura PRESSURE attiva non trovata. Controlla calibration_procedures."
        );
      }

      const activeProcedure = procedure as CalibrationProcedure;

      const customerInstrumentSnapshot = {
        customer_id: selectedCustomer.id,
        customer_number: selectedCustomer.customer_number,
        customer_name: selectedCustomer.business_name,
        site_id: selectedSite.id,
        site_name: selectedSite.name,
        site_city: selectedSite.city,
        site_province: selectedSite.province,
        instrument_id: selectedCustomerInstrument.id,
        instrument_name: selectedCustomerInstrument.name,
        manufacturer: selectedCustomerInstrument.manufacturer,
        model: selectedCustomerInstrument.model,
        serial_number: selectedCustomerInstrument.serial_number,
        internal_code: selectedCustomerInstrument.internal_code,
        measurement_quantity: selectedCustomerInstrument.measurement_quantity,
        unit: selectedCustomerInstrument.unit,
        measurement_range: selectedCustomerInstrument.measurement_range,
        resolution: selectedCustomerInstrument.resolution,
        acceptance_class: selectedCustomerInstrument.acceptance_class,
      };

      const referenceInstrumentSnapshot = buildReferenceInstrumentSnapshot(
        selectedReferenceInstrument
      );

      const procedureSnapshot = {
        procedure_id: activeProcedure.id,
        code: activeProcedure.code,
        name: activeProcedure.name,
        revision: activeProcedure.revision,
        revision_date: activeProcedure.revision_date,
        normative_reference: activeProcedure.normative_reference,
        calculation_engine_version: activeProcedure.calculation_engine_version,
      };

      const recordNumber =
        "PR-" + String(new Date().getFullYear()) + "-" + String(Date.now());

      const { data: record, error: recordError } = await supabase
        .from("calibration_records")
        .insert({
          record_number: recordNumber,
          calibration_type_id: calibrationType.id,
          procedure_id: activeProcedure.id,
          customer_instrument_id: selectedCustomerInstrument.id,
          reference_instrument_id: selectedReferenceInstrument.id,
          customer_instrument_snapshot: customerInstrumentSnapshot,
          reference_instrument_snapshot: referenceInstrumentSnapshot,
          procedure_snapshot: procedureSnapshot,
          verification_module: "PRESSURE",
          mode: "pressione",
          verification_date: new Date().toISOString().slice(0, 10),
          operator_name: operatorName || null,
          location: location || null,
          environmental_conditions: environmentalConditions || null,
          status: "draft",
          report_status: "draft",
          final_result: null,
          notes: notes || null,
        })
        .select("id")
        .single();

      if (recordError || !record) {
        throw new Error(
          recordError?.message || "Errore durante il salvataggio della verifica."
        );
      }

      const { data: insertedScale, error: scaleError } = await supabase
        .from("calibration_record_scales")
        .insert({
          calibration_record_id: record.id,
          scale_order: 1,
          scale_name: scaleName.trim(),
          scale_range: scaleRange.trim() || null,
          reference_instrument_id: selectedReferenceInstrument.id,
          reference_instrument_snapshot: referenceInstrumentSnapshot,
          notes: scaleNotes.trim() || null,
        })
        .select("id")
        .single();

      if (scaleError || !insertedScale) {
        throw new Error(
          scaleError?.message ||
            "Verifica creata, ma errore nel salvataggio della scala."
        );
      }

      const measurementRows = calculatedPoints.map((point, pointIndex) => ({
        calibration_record_id: record.id,
        scale_id: insertedScale.id,
        section: point.phase === "scarico" ? "Scarico" : "Carico",
        point_order: pointIndex + 1,
        nominal_value: point.verificationPoint,
        applied_value: point.appliedValue,
        cycle_1: point.reading1,
        cycle_2: point.reading2,
        cycle_3: point.reading3,
        max_value: point.maxReading,
        min_value: point.minReading,
        average_value: point.averageReading,
        mean_error: point.meanError,
        accuracy_error_percent: point.accuracyErrorPercent,
        repeatability_error_percent: point.repeatabilityErrorPercent,
        result: null,
        notes: null,
      }));

      const { error: measurementError } = await supabase
        .from("calibration_measurements")
        .insert(measurementRows);

      if (measurementError) {
        throw new Error(
          measurementError.message ||
            "Verifica creata, ma errore nel salvataggio delle misure."
        );
      }

      setSavedRecordId(record.id);
      setSavedRecordNumber(recordNumber);
      setSaveMessage(
        "Verifica pressione salvata correttamente con numero " +
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

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          Errore caricamento dati: {loadError}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati generali verifica pressione
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Operatore</span>
            <input
              value={operatorName}
              onChange={(event) => {
                setOperatorName(event.target.value);
                resetSaveState();
              }}
              placeholder="Nome operatore"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Luogo</span>
            <input
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                resetSaveState();
              }}
              placeholder="Sede / laboratorio / cantiere"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Condizioni ambientali
            </span>
            <input
              value={environmentalConditions}
              onChange={(event) => {
                setEnvironmentalConditions(event.target.value);
                resetSaveState();
              }}
              placeholder="Es. 20 °C - 55% U.R."
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
            placeholder="Eventuali note operative"
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Strumento cliente verificato
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Cliente *
            </span>
            <select
              value={selectedCustomerId}
              onChange={(event) => handleCustomerChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">
                {isLoadingData ? "Caricamento..." : "Seleziona cliente"}
              </option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_number
                    ? customer.customer_number + " - "
                    : ""}
                  {customer.business_name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Sede *</span>
            <select
              value={selectedSiteId}
              onChange={(event) => handleSiteChange(event.target.value)}
              disabled={!selectedCustomerId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">
                {!selectedCustomerId
                  ? "Seleziona prima il cliente"
                  : "Seleziona sede"}
              </option>

              {filteredSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                  {site.city ? " - " + site.city : ""}
                  {site.province ? " (" + site.province + ")" : ""}
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
              disabled={!selectedSiteId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">
                {!selectedSiteId
                  ? "Seleziona prima la sede"
                  : "Seleziona strumento"}
              </option>

              {filteredCustomerInstruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name}
                  {instrument.internal_code
                    ? " - " + instrument.internal_code
                    : ""}
                  {instrument.serial_number
                    ? " - Mat. " + instrument.serial_number
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedCustomerInstrument && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-semibold">Strumento</p>
                <p>{selectedCustomerInstrument.name}</p>
              </div>

              <div>
                <p className="font-semibold">Costruttore / modello</p>
                <p>
                  {[
                    selectedCustomerInstrument.manufacturer,
                    selectedCustomerInstrument.model,
                  ]
                    .filter(Boolean)
                    .join(" - ") || "-"}
                </p>
              </div>

              <div>
                <p className="font-semibold">Campo / fondo scala</p>
                <p>{selectedCustomerInstrument.measurement_range ?? "-"}</p>
              </div>

              <div>
                <p className="font-semibold">Risoluzione</p>
                <p>{selectedCustomerInstrument.resolution ?? "-"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Prova di misurazione della pressione
            </h2>
            <p className="text-sm text-slate-500">
              Tabella conforme al modello VI: punti di verifica, carico
              applicato, tre letture, max, min, media, errore medio,
              accuratezza e ripetibilità.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Nome scala *
              </span>
              <input
                value={scaleName}
                onChange={(event) => {
                  setScaleName(event.target.value);
                  resetSaveState();
                }}
                placeholder="Es. Scala 0-10 bar"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Campo / fondo scala
              </span>
              <input
                value={scaleRange}
                onChange={(event) => {
                  setScaleRange(event.target.value);
                  resetSaveState();
                }}
                placeholder="Es. 0 - 10 bar"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Strumento campione usato *
              </span>
              <select
                value={selectedReferenceInstrumentId}
                onChange={(event) => {
                  setSelectedReferenceInstrumentId(event.target.value);
                  resetSaveState();
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  {isLoadingData
                    ? "Caricamento strumenti campione..."
                    : "Seleziona strumento campione"}
                </option>

                {referenceInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}
                    {instrument.internal_code
                      ? " - " + instrument.internal_code
                      : ""}
                    {instrument.measurement_range
                      ? " - " + instrument.measurement_range
                      : ""}
                    {instrument.serial_number
                      ? " - Mat. " + instrument.serial_number
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Note scala
            </span>
            <input
              value={scaleNotes}
              onChange={(event) => {
                setScaleNotes(event.target.value);
                resetSaveState();
              }}
              placeholder="Eventuali note sulla scala"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {selectedReferenceInstrument && (
            <div
              className={
                "mt-5 rounded-xl border p-4 text-sm " +
                statusClass(selectedReferenceInstrument.status)
              }
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="font-semibold">Stato campione</p>
                  <p>{statusLabel(selectedReferenceInstrument.status)}</p>
                </div>

                <div>
                  <p className="font-semibold">Certificato</p>
                  <p>{selectedReferenceInstrument.certificate_number ?? "-"}</p>
                </div>

                <div>
                  <p className="font-semibold">Scadenza</p>
                  <p>
                    {formatItalianDate(
                      selectedReferenceInstrument.certificate_expiry
                    )}
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Campo</p>
                  <p>{selectedReferenceInstrument.measurement_range ?? "-"}</p>
                </div>
              </div>

              {hasBlockedReferenceInstrument && (
                <p className="mt-3 font-medium">
                  Blocco: lo strumento campione è scaduto o fuori servizio.
                </p>
              )}
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
              <table className="w-full min-w-[1180px] text-sm">
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
                    <th className="bg-sky-200 px-3 py-3 text-sky-950">
                      Lettura III° ciclo
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
                    const editablePoint = points.find((item) => item.id === point.id);

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

                        <td className="bg-sky-50 px-3 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editablePoint?.reading3 ?? ""}
                            onChange={(event) =>
                              updatePoint(point.id, "reading3", event.target.value)
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
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salvataggio verifica pressione
          </h2>
          <p className="text-sm text-slate-500">
            La verifica viene salvata come bozza. Dopo il salvataggio potrai
            compilare i dati rapporto.
          </p>
        </div>

        <button
          type="button"
          onClick={saveCalibration}
          disabled={isSaving || Boolean(hasBlockedReferenceInstrument)}
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
                href={"/verifiche/" + savedRecordId + "/rapporto"}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                Vai ai dati rapporto
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
        <strong>Nota tecnica:</strong> formule e intestazioni sono state
        allineate al modello VI-001A-26 caricato. Prima dell’uso reale dovremo
        comunque confermare criteri di accettabilità e testi tecnici.
      </div>
    </div>
  );
}