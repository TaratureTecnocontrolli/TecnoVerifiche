"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  type PressurePhase,
  type PressurePointInput,
} from "@/lib/calculations/pressure";
import { supabase } from "@/lib/supabase";
import PressureErrorChart from "./PressureErrorChart";
import ReferenceInstrumentMultiSelect from "./ReferenceInstrumentMultiSelect";

type VerificationScope = "VT" | "VI";

type PressureCalibrationTableProps = {
  verificationScope?: VerificationScope;
};

type Customer = {
  id: string;
  customer_number: string | null;
  business_name: string;
};

type CustomerSite = {
  id: string;
  customer_id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
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
  };

type CalculatedPressurePoint = PressurePointInput & {
  maxReading: number;
  minReading: number;
  averageReading: number;
  meanError: number;
  accuracyErrorPercent: number;
  repeatabilityErrorPercent: number;
};

const defaultPressurePoints: EditablePressurePoint[] = [
  { id: "carico-1", phase: "carico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "carico-2", phase: "carico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "carico-3", phase: "carico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "carico-4", phase: "carico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "carico-5", phase: "carico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "carico-6", phase: "carico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "carico-7", phase: "carico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "scarico-1", phase: "scarico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "scarico-2", phase: "scarico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "scarico-3", phase: "scarico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "scarico-4", phase: "scarico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "scarico-5", phase: "scarico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" },
  { id: "scarico-6", phase: "scarico", verificationPoint: "", appliedValue: "", reading1: "", reading2: "" }
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
    };
}

function calculatePressurePointsTwoCycles(
  pressurePoints: PressurePointInput[]
): CalculatedPressurePoint[] {
  return pressurePoints.map((point) => {
    const values = [point.reading1, point.reading2];
    const maxReading = Math.max(...values);
    const minReading = Math.min(...values);
    const averageReading =
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanError = averageReading - point.appliedValue;
    const accuracyErrorPercent =
      point.appliedValue !== 0 ? (meanError / point.appliedValue) * 100 : 0;
    const repeatabilityErrorPercent =
      averageReading !== 0
        ? ((maxReading - minReading) / averageReading) * 100
        : 0;

    return {
      ...point,
      maxReading,
      minReading,
      averageReading,
      meanError,
      accuracyErrorPercent,
      repeatabilityErrorPercent,
    };
  });
}

function formatItalianNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
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

function buildInternalInstrumentSnapshot(instrument: InternalInstrument) {
  return {
    internal_instrument_id: instrument.id,
    instrument_id: instrument.id,
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
  };
}

function buildSiteOptionLabel(site: CustomerSite) {
  return [
    site.name,
    site.address,
    site.city,
    site.province ? "(" + site.province + ")" : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function buildSiteDescription(site: CustomerSite | undefined) {
  if (!site) {
    return "";
  }

  return [
    site.name,
    site.address,
    site.postal_code,
    site.city,
    site.province ? "(" + site.province + ")" : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

export default function PressureCalibrationTable({
  verificationScope = "VT",
}: PressureCalibrationTableProps) {
  const isInternalVerification = verificationScope === "VI";
  const [operatorName, setOperatorName] = useState("");
  const [ambientTemperature, setAmbientTemperature] = useState("");
  const [ambientHumidity, setAmbientHumidity] = useState("");
  const [internalVerificationLocation, setInternalVerificationLocation] = useState("");
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [newSiteProvince, setNewSiteProvince] = useState("");
  const [newSitePostalCode, setNewSitePostalCode] = useState("");
  const [siteSaveError, setSiteSaveError] = useState("");
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
  const [internalInstruments, setInternalInstruments] = useState<
    InternalInstrument[]
  >([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedCustomerInstrumentId, setSelectedCustomerInstrumentId] =
    useState("");
  const [selectedInternalInstrumentId, setSelectedInternalInstrumentId] =
    useState("");
  const [selectedReferenceInstrumentIds, setSelectedReferenceInstrumentIds] =
    useState<string[]>([]);

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
    return calculatePressurePointsTwoCycles(
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
    if (!selectedCustomerId) {
      return [];
    }

    return customerInstruments.filter(
      (instrument) => instrument.customer_id === selectedCustomerId
    );
  }, [customerInstruments, selectedCustomerId]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const selectedSiteDescription = buildSiteDescription(selectedSite);

  const selectedCustomerInstrument = customerInstruments.find(
    (instrument) => instrument.id === selectedCustomerInstrumentId
  );

  const selectedInternalInstrument = internalInstruments.find(
    (instrument) => instrument.id === selectedInternalInstrumentId
  );

  const selectedReferenceInstruments = selectedReferenceInstrumentIds
    .map((instrumentId) =>
      referenceInstruments.find((instrument) => instrument.id === instrumentId)
    )
    .filter(Boolean) as ReferenceInstrument[];

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    (instrument) =>
      isReferenceInstrumentBlocked(
        getEffectiveReferenceInstrumentStatus(
          instrument.status,
          instrument.certificate_expiry
        )
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
        .select("id, customer_id, name, address, city, province, postal_code")
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

      const { data: internalInstrumentsData, error: internalInstrumentsError } =
        await supabase
          .from("internal_instruments")
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
            location,
            department,
            status
          `
          )
          .in("status", ["active", "out_of_service"])
          .order("name", { ascending: true });

      if (internalInstrumentsError) {
        setLoadError(internalInstrumentsError.message);
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
      setInternalInstruments(
        (internalInstrumentsData ?? []) as InternalInstrument[]
      );

      setIsLoadingData(false);
    }

    loadData();
  }, []);

  
  function handleCycleTab(
    event: KeyboardEvent<HTMLInputElement>,
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
        'input[data-cycle-field="' + field + '"]'
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
    setIsAddingSite(false);
    setSiteSaveError("");
    resetSaveState();
  }

  function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    setSelectedCustomerInstrumentId("");
    setSiteSaveError("");
    resetSaveState();
  }

  async function saveNewSite() {
    setSiteSaveError("");

    if (!selectedCustomerId) {
      setSiteSaveError("Seleziona prima il cliente.");
      return;
    }

    if (!newSiteName.trim()) {
      setSiteSaveError("Inserisci almeno il nome del luogo prove.");
      return;
    }

    const { data: createdSite, error } = await supabase
      .from("customer_sites")
      .insert({
        customer_id: selectedCustomerId,
        name: newSiteName.trim(),
        address: newSiteAddress.trim() || null,
        city: newSiteCity.trim() || null,
        province: newSiteProvince.trim().toUpperCase() || null,
        postal_code: newSitePostalCode.trim() || null,
        is_active: true,
      })
      .select("id, customer_id, name, address, city, province, postal_code")
      .single();

    if (error || !createdSite) {
      setSiteSaveError(
        error?.message || "Errore durante il salvataggio del luogo prove."
      );
      return;
    }

    const site = createdSite as CustomerSite;

    setSites((currentSites) => [...currentSites, site]);
    setSelectedSiteId(site.id);
    setSelectedCustomerInstrumentId("");
    setNewSiteName("");
    setNewSiteAddress("");
    setNewSiteCity("");
    setNewSiteProvince("");
    setNewSitePostalCode("");
    setIsAddingSite(false);
    resetSaveState();
  }

  function handleInternalInstrumentChange(instrumentId: string) {
    setSelectedInternalInstrumentId(instrumentId);
    resetSaveState();
  }

  function toggleReferenceInstrument(instrumentId: string) {
    resetSaveState();

    setSelectedReferenceInstrumentIds((currentIds) =>
      currentIds.includes(instrumentId)
        ? currentIds.filter((id) => id !== instrumentId)
        : [...currentIds, instrumentId]
    );
  }

  function updatePoint(
    pointId: string,
    field: keyof Omit<EditablePressurePoint, "id">,
    value: string
  ) {
    const normalizedValue = normalizeEuropeanDecimalInput(value);

    resetSaveState();

    setPoints((currentPoints) =>
      currentPoints.map((point) => {
        if (point.id !== pointId) {
          return point;
        }

        if (field === "verificationPoint") {
          return {
            ...point,
            verificationPoint: normalizedValue,
            appliedValue: normalizedValue,
          };
        }

        return { ...point, [field]: normalizedValue };
      })
    );
  }

  function addPoint(phase: PressurePhase) {
    resetSaveState();

    setPoints((currentPoints) => {
      const phasePoints = currentPoints.filter((point) => point.phase === phase);
      const lastPoint = phasePoints[phasePoints.length - 1];
      const nextAppliedValue = "";

      return [
        ...currentPoints,
        {
          id: crypto.randomUUID(),
          phase,
          verificationPoint: "",
          appliedValue: "",
          reading1: "",
          reading2: "",
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
    if (isInternalVerification) {
      if (!selectedInternalInstrument) {
        throw new Error("Seleziona lo strumento interno da verificare.");
      }

      if (!internalVerificationLocation.trim()) {
        throw new Error("Inserisci il luogo della verifica interna.");
      }
    } else {
      if (!selectedCustomer) {
        throw new Error("Seleziona il cliente.");
      }

      if (!selectedSite) {
        throw new Error("Seleziona il luogo prove del cliente.");
      }

      if (!selectedCustomerInstrument) {
        throw new Error("Seleziona lo strumento cliente da verificare.");
      }
    }

    if (selectedReferenceInstruments.length === 0) {
      throw new Error("Seleziona almeno uno strumento campione usato.");
    }

    if (
      selectedReferenceInstruments.some((instrument) =>
        isReferenceInstrumentBlocked(
          getEffectiveReferenceInstrumentStatus(
            instrument.status,
            instrument.certificate_expiry
          )
        )
      )
    ) {
      throw new Error(
        "Uno strumento campione usato è scaduto o fuori servizio."
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
        point.reading2.trim() === ""
      );
    });

    if (invalidPoint) {
      throw new Error(
        "Compila punti di verifica, carico applicato e le due letture per tutti i punti."
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

      if (!isInternalVerification && (!selectedCustomer || !selectedSite || !selectedCustomerInstrument)) {
        throw new Error("Dati cliente/strumento incompleti.");
      }

      if (isInternalVerification && !selectedInternalInstrument) {
        throw new Error("Dati strumento interno incompleti.");
      }

      const primaryReferenceInstrument = selectedReferenceInstruments[0];

      if (!primaryReferenceInstrument) {
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

      const verifiedInstrumentSnapshot = isInternalVerification
        ? buildInternalInstrumentSnapshot(selectedInternalInstrument as InternalInstrument)
        : {
            customer_id: selectedCustomer?.id ?? null,
            customer_number: selectedCustomer?.customer_number ?? null,
            customer_name: selectedCustomer?.business_name ?? null,
            site_id: selectedSite?.id ?? null,
            site_name: selectedSite?.name ?? null,
            site_address: selectedSite?.address ?? null,
            site_city: selectedSite?.city ?? null,
            site_province: selectedSite?.province ?? null,
            site_postal_code: selectedSite?.postal_code ?? null,
            instrument_id: selectedCustomerInstrument?.id ?? null,
            instrument_name: selectedCustomerInstrument?.name ?? null,
            manufacturer: selectedCustomerInstrument?.manufacturer ?? null,
            model: selectedCustomerInstrument?.model ?? null,
            serial_number: selectedCustomerInstrument?.serial_number ?? null,
            internal_code: selectedCustomerInstrument?.internal_code ?? null,
            measurement_quantity: selectedCustomerInstrument?.measurement_quantity ?? null,
            unit: selectedCustomerInstrument?.unit ?? null,
            measurement_range: selectedCustomerInstrument?.measurement_range ?? null,
            resolution: selectedCustomerInstrument?.resolution ?? null,
            acceptance_class: selectedCustomerInstrument?.acceptance_class ?? null,
          };

      const referenceInstrumentSnapshot = buildReferenceInstrumentSnapshot(
        primaryReferenceInstrument
      );
      const referenceInstrumentsSnapshot = selectedReferenceInstruments.map(
        (instrument) => buildReferenceInstrumentSnapshot(instrument)
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
          verification_scope: verificationScope,
          verified_instrument_type: isInternalVerification ? "internal" : "customer",
          internal_instrument_id: isInternalVerification
            ? selectedInternalInstrument?.id ?? null
            : null,
          output_type: isInternalVerification ? "technical_report" : "final_report",
          acquisition_mode: "manual",
          source_device: null,
          customer_instrument_id: isInternalVerification
            ? null
            : selectedCustomerInstrument?.id ?? null,
          reference_instrument_id: primaryReferenceInstrument.id,
          customer_instrument_snapshot: verifiedInstrumentSnapshot,
          reference_instrument_snapshot: referenceInstrumentSnapshot,
          procedure_snapshot: procedureSnapshot,
          verification_module: "PRESSURE",
          mode: "pressione",
          verification_date: new Date().toISOString().slice(0, 10),
          operator_name: operatorName || null,
          location: isInternalVerification
            ? internalVerificationLocation.trim()
            : selectedSiteDescription || null,
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
          reference_instrument_id: primaryReferenceInstrument.id,
          reference_instrument_snapshot: referenceInstrumentSnapshot,
          reference_instrument_ids: selectedReferenceInstruments.map(
            (instrument) => instrument.id
          ),
          reference_instruments_snapshot: referenceInstrumentsSnapshot,
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
        cycle_3: null,
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

      const reportCustomerName = isInternalVerification
        ? "Tecnocontrolli S.r.l."
        : selectedCustomer?.business_name ?? null;
      const reportLocation = isInternalVerification
        ? internalVerificationLocation.trim()
        : selectedSiteDescription || selectedSite?.name || null;
      const verifiedInstrumentName = isInternalVerification
        ? selectedInternalInstrument?.name ?? null
        : selectedCustomerInstrument?.name ?? null;

      const { error: reportDetailsError } = await supabase
        .from("calibration_report_details")
        .insert({
          calibration_record_id: record.id,
          main_report_number: null,
          report_date: null,
          test_date: new Date().toISOString().slice(0, 10),
          customer_name: reportCustomerName,
          site_description: reportLocation,
          work_object: verifiedInstrumentName
            ? "Verifica di taratura pressione - " + verifiedInstrumentName
            : "Verifica di taratura pressione",
          requested_tests: "Verifica di taratura pressione",
          premise_text: null,
          scope_text: null,
          apparatus_description: null,
          execution_method: null,
          results_text: null,
          temperature: ambientTemperature.trim() || null,
          humidity: ambientHumidity.trim() || null,
          technician_name: operatorName || null,
          reviewer_name: null,
          director_name: null,
          notes: null,
        });

      if (reportDetailsError) {
        throw new Error(
          reportDetailsError.message ||
            "Verifica creata, ma errore nel salvataggio dei dati rapporto."
        );
      }


      setSavedRecordId(record.id);
      setSavedRecordNumber(recordNumber);
      setSaveMessage(
        (isInternalVerification
          ? "Verifica interna pressione salvata correttamente con numero "
          : "Verifica pressione salvata correttamente con numero ") +
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
          Dati generali verifica pressione {isInternalVerification ? "VI" : "VT"}
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
            placeholder="Eventuali note operative"
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {isInternalVerification ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Strumento interno verificato
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Strumento interno *
              </span>
              <select
                value={selectedInternalInstrumentId}
                onChange={(event) => handleInternalInstrumentChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  {isLoadingData ? "Caricamento..." : "Seleziona strumento interno"}
                </option>

                {internalInstruments.map((instrument) => (
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

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Luogo verifica *
              </span>
              <input
                value={internalVerificationLocation}
                onChange={(event) => {
                  setInternalVerificationLocation(event.target.value);
                  resetSaveState();
                }}
                placeholder="Es. Laboratorio Bologna"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          {internalInstruments.length === 0 && !isLoadingData && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Nessuno strumento interno attivo o fuori servizio presente in
              anagrafica. Aggiungilo da “Strumenti interni” prima di creare la VI.
            </div>
          )}

          {selectedInternalInstrument && (
            <div className="mt-5 rounded-xl border border-sky-200 bg-white p-4 text-sm text-slate-800">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="font-semibold">Strumento</p>
                  <p>{selectedInternalInstrument.name}</p>
                </div>

                <div>
                  <p className="font-semibold">Costruttore / modello</p>
                  <p>
                    {[
                      selectedInternalInstrument.manufacturer,
                      selectedInternalInstrument.model,
                    ]
                      .filter(Boolean)
                      .join(" - ") || "-"}
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Matricola</p>
                  <p>{selectedInternalInstrument.serial_number ?? "-"}</p>
                </div>

                <div>
                  <p className="font-semibold">Codice interno</p>
                  <p>{selectedInternalInstrument.internal_code ?? "-"}</p>
                </div>

                <div>
                  <p className="font-semibold">Grandezza / unità</p>
                  <p>
                    {[
                      selectedInternalInstrument.measurement_quantity,
                      selectedInternalInstrument.unit,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Fondo scala</p>
                  <p>{selectedInternalInstrument.measurement_range ?? "-"}</p>
                </div>

                <div>
                  <p className="font-semibold">Reparto</p>
                  <p>{selectedInternalInstrument.department ?? "-"}</p>
                </div>

                <div>
                  <p className="font-semibold">Ubicazione</p>
                  <p>{selectedInternalInstrument.location ?? "-"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
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
            <span className="text-sm font-medium text-slate-700">Luogo prove *</span>
            <select
              value={selectedSiteId}
              onChange={(event) => handleSiteChange(event.target.value)}
              disabled={!selectedCustomerId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">
                {!selectedCustomerId
                  ? "Seleziona prima il cliente"
                  : "Seleziona luogo prove"}
              </option>

              {filteredSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {buildSiteOptionLabel(site)}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 md:col-span-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!selectedCustomerId}
                onClick={() => {
                  setIsAddingSite((current) => !current);
                  setSiteSaveError("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isAddingSite ? "Chiudi nuovo luogo" : "Aggiungi nuovo luogo prove"}
              </button>

              {selectedCustomerId && filteredSites.length === 0 && (
                <span className="text-sm text-amber-700">
                  Nessun luogo prove salvato per questo cliente. Aggiungine uno.
                </span>
              )}
            </div>

            {isAddingSite && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Nome luogo *</span>
                    <input value={newSiteName} onChange={(event) => setNewSiteName(event.target.value)} placeholder="Es. Sede principale / Cantiere" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 lg:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Indirizzo</span>
                    <input value={newSiteAddress} onChange={(event) => setNewSiteAddress(event.target.value)} placeholder="Via / località" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">CAP</span>
                    <input value={newSitePostalCode} onChange={(event) => setNewSitePostalCode(event.target.value)} placeholder="CAP" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Città</span>
                    <input value={newSiteCity} onChange={(event) => setNewSiteCity(event.target.value)} placeholder="Città" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Provincia</span>
                    <input value={newSiteProvince} onChange={(event) => setNewSiteProvince(event.target.value)} placeholder="BO" maxLength={2} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase" />
                  </label>
                </div>
                {siteSaveError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{siteSaveError}</div>}
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={saveNewSite} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Salva luogo prove</button>
                </div>
              </div>
            )}
          </div>

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
                {!selectedCustomerId
                  ? "Seleziona prima il cliente"
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
                <p className="font-semibold">Fondo scala</p>
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


      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Prova di misurazione della pressione
            </h2>
            <p className="text-sm text-slate-500">
              Tabella conforme al modello VI: punti di verifica, carico
              applicato, due letture, max, min, media, errore medio,
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
                Fondo scala
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

            <div className="lg:col-span-2">
              <ReferenceInstrumentMultiSelect
                instruments={referenceInstruments}
                selectedIds={selectedReferenceInstrumentIds}
                onToggle={toggleReferenceInstrument}
                label="Strumenti campione usati *"
                emptyLabel={
                  isLoadingData
                    ? "Caricamento strumenti campione..."
                    : undefined
                }
              />
            </div>
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

          {selectedReferenceInstruments.length > 0 && (
            <div className="mt-5 space-y-3">
              {selectedReferenceInstruments.map((instrument) => {
                const effectiveStatus = getEffectiveReferenceInstrumentStatus(
                  instrument.status,
                  instrument.certificate_expiry
                );
                const instrumentBlocked =
                  isReferenceInstrumentBlocked(effectiveStatus);

                return (
                  <div
                    key={instrument.id}
                    className={
                      "rounded-xl border p-4 text-sm " +
                      statusClass(effectiveStatus)
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <p className="font-semibold">Strumento</p>
                        <p>{instrument.name}</p>
                      </div>

                      <div>
                        <p className="font-semibold">Stato campione</p>
                        <p>{statusLabel(effectiveStatus)}</p>
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
                        <p className="font-semibold">Fondo scala</p>
                        <p>{instrument.measurement_range ?? "-"}</p>
                      </div>
                    </div>

                    {instrumentBlocked && (
                      <p className="mt-3 font-medium">
                        Blocco: il campione è scaduto o fuori servizio.
                      </p>
                    )}
                  </div>
                );
              })}
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
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="text-center text-xs uppercase tracking-wide text-slate-700">
                  <tr className="border-y border-slate-300">
                    <th className="bg-orange-200 px-3 py-3 text-orange-950">
                      Punto di applicazione
                      <br />
                      <span className="font-normal lowercase">bar</span>
                    </th>
                    <th className="bg-sky-200 px-3 py-3 text-sky-950">
                      Ciclo 1
                      <br />
                      <span className="font-normal lowercase">bar</span>
                    </th>
                    <th className="bg-sky-200 px-3 py-3 text-sky-950">
                      Ciclo 2
                      <br />
                      <span className="font-normal lowercase">bar</span>
                    </th>
                    <th className="px-3 py-3">
                      Max
                      <br />
                      <span className="font-normal lowercase">bar</span>
                    </th>
                    <th className="px-3 py-3">
                      Min
                      <br />
                      <span className="font-normal lowercase">bar</span>
                    </th>
                    <th className="px-3 py-3">
                      Media
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

                        <td className="bg-white px-3 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editablePoint?.reading1 ?? ""}
                            data-cycle-field="reading1"
                            onKeyDown={(event) => handleCycleTab(event, "reading1")}
                            onChange={(event) =>
                              updatePoint(point.id, "reading1", event.target.value)
                            }
                            className="w-24 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-center font-semibold text-sky-950"
                          />
                        </td>

                        <td className="bg-slate-50 px-3 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editablePoint?.reading2 ?? ""}
                            data-cycle-field="reading2"
                            onKeyDown={(event) => handleCycleTab(event, "reading2")}
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

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => addPoint(phaseBlock.phase)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Aggiungi punto
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Grafici errore accuratezza
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          I grafici vengono mostrati dopo la sezione di carico e la sezione di scarico.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <PressureErrorChart
              points={loadPoints}
              title="Grafico errore accuratezza % - Prova in carico"
              lineColor="#ea580c"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <PressureErrorChart
              points={unloadPoints}
              title="Grafico errore accuratezza % - Prova in scarico"
              lineColor="#0284c7"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salvataggio verifica pressione
          </h2>
          <p className="text-sm text-slate-500">
            La verifica viene salvata come bozza. Per VT compilerai i dati rapporto;
            per VI aprirai direttamente il rapportino interno.
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
        <strong>Nota tecnica:</strong> formule e intestazioni sono state
        allineate al modello VI-001A-26 caricato. Prima dell’uso reale dovremo
        comunque confermare criteri di accettabilità e testi tecnici.
      </div>
    </div>
  );
}
