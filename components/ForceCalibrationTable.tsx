"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  calculateForcePoints,
  type ForcePointInput,
} from "@/lib/calculations/force";
import { supabase } from "@/lib/supabase";
import {
  getCtForceReportDefaults,
  combineReferenceInstrumentNames,
} from "@/lib/report-defaults";
import ForceErrorChart from "./ForceErrorChart";
import ReferenceInstrumentMultiSelect from "./ReferenceInstrumentMultiSelect";

type VerificationScope = "VT" | "VI";

type ForceCalibrationTableProps = {
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

type EditableForcePoint = {
  id: string;
  appliedValue: string;
  cycle1: string;
  cycle2: string;
  cycle3: string;
};

type EditableScale = {
  id: string;
  scaleName: string;
  scaleRange: string;
  referenceInstrumentIds: string[];
  notes: string;
  points: EditableForcePoint[];
};

type CalculatedScale = EditableScale & {
  calculatedPoints: ReturnType<typeof calculateForcePoints>;
};

const defaultPointsScaleOne: EditableForcePoint[] = [
  {
    id: "1",
    appliedValue: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
  },
  {
    id: "2",
    appliedValue: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
  },
  {
    id: "3",
    appliedValue: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
  },
];

const defaultPointsScaleTwo: EditableForcePoint[] = [
  {
    id: "1",
    appliedValue: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
  },
  {
    id: "2",
    appliedValue: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
  },
  {
    id: "3",
    appliedValue: "",
    cycle1: "",
    cycle2: "",
    cycle3: "",
  },
];

const initialScales: EditableScale[] = [
  {
    id: "scala-1",
    scaleName: "Scala 1",
    scaleRange: "",
    referenceInstrumentIds: [],
    notes: "",
    points: defaultPointsScaleOne,
  },
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

function editablePointToForcePoint(point: EditableForcePoint): ForcePointInput {
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

function numberToInputValue(value: number) {
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

function buildCtPremiseText(input: {
  verificationDate: string;
  customerName: string;
  siteName: string;
  instrumentName: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  measurementRange: string | null;
}) {
  const parts = [
    input.instrumentName,
    input.manufacturer,
    input.model,
    input.serialNumber ? "s/n " + input.serialNumber : null,
  ].filter(Boolean);

  const instrumentDescription = parts.join(" ");

  return [
    "Il giorno " +
      formatItalianDate(input.verificationDate) +
      " tecnici di questo Laboratorio tecnologico hanno sottoposto, per conto di " +
      input.customerName +
      " presso la sede di " +
      input.siteName +
      ", " +
      instrumentDescription +
      " a verifica di taratura.",
    input.measurementRange
      ? "La macchina ha un Fondo Scala di " + input.measurementRange + "."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCtInternalPremiseText(input: {
  verificationDate: string;
  location: string;
  instrumentName: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  measurementRange: string | null;
}) {
  const parts = [
    input.instrumentName,
    input.manufacturer,
    input.model,
    input.serialNumber ? "s/n " + input.serialNumber : null,
  ].filter(Boolean);

  const instrumentDescription = parts.join(" ");

  return [
    "Il giorno " +
      formatItalianDate(input.verificationDate) +
      " tecnici di questo Laboratorio tecnologico hanno sottoposto presso " +
      input.location +
      " lo strumento interno " +
      instrumentDescription +
      " a verifica interna.",
    input.measurementRange
      ? "Lo strumento ha un Fondo Scala di " + input.measurementRange + "."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildInternalInstrumentSnapshot(instrument: InternalInstrument) {
  return {
    internal_instrument_id: instrument.id,
    instrument_name: instrument.name,
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

function clonePoints(points: EditableForcePoint[]) {
  return points.map((point) => ({
    ...point,
    id: crypto.randomUUID(),
  }));
}

export default function ForceCalibrationTable({
  verificationScope = "VT",
}: ForceCalibrationTableProps) {
  const isInternalVerification = verificationScope === "VI";
  const [mode, setMode] = useState<"compressione" | "trazione">("compressione");
  const [operatorName, setOperatorName] = useState("");
  const [ambientTemperature, setAmbientTemperature] = useState("");
  const [ambientHumidity, setAmbientHumidity] = useState("");
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [newSiteProvince, setNewSiteProvince] = useState("");
  const [newSitePostalCode, setNewSitePostalCode] = useState("");
  const [siteSaveError, setSiteSaveError] = useState("");
  const [notes, setNotes] = useState("");
  const [hasDoubleScale, setHasDoubleScale] = useState(false);
  const [scales, setScales] = useState<EditableScale[]>(initialScales);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [customerInstruments, setCustomerInstruments] = useState<
    CustomerInstrument[]
  >([]);
  const [internalInstruments, setInternalInstruments] = useState<
    InternalInstrument[]
  >([]);
  const [referenceInstruments, setReferenceInstruments] = useState<
    ReferenceInstrument[]
  >([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedCustomerInstrumentId, setSelectedCustomerInstrumentId] =
    useState("");
  const [selectedInternalInstrumentId, setSelectedInternalInstrumentId] =
    useState("");
  const [verificationLocation, setVerificationLocation] = useState("");

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [savedRecordNumber, setSavedRecordNumber] = useState<string | null>(
    null
  );

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

  const selectedReferenceInstruments = scales
    .flatMap((scale) =>
      scale.referenceInstrumentIds.map((instrumentId) =>
        referenceInstruments.find(
          (instrument) => instrument.id === instrumentId
        )
      )
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
          .eq("is_active", true)
          .order("name", { ascending: true });

      if (internalInstrumentsError) {
        setLoadError(internalInstrumentsError.message);
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
      setInternalInstruments(
        (internalInstrumentsData ?? []) as InternalInstrument[]
      );
      setReferenceInstruments(
        (referenceInstrumentsData ?? []) as ReferenceInstrument[]
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

  function handleDoubleScaleChange(nextValue: boolean) {
    setHasDoubleScale(nextValue);
    resetSaveState();

    setScales((currentScales) => {
      if (nextValue) {
        if (currentScales.length >= 2) {
          return currentScales;
        }

        return [
          currentScales[0],
          {
            id: "scala-2",
            scaleName: "Scala 2",
            scaleRange: "",
            referenceInstrumentIds: [],
            notes: "",
            points: clonePoints(defaultPointsScaleTwo),
          },
        ];
      }

      return [currentScales[0]];
    });
  }

  function updateScale(
    scaleId: string,
    field: keyof Omit<EditableScale, "id" | "points">,
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
    field: keyof Omit<EditableForcePoint, "id">,
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
        const nextAppliedValue = "";

        return {
          ...scale,
          points: [
            ...scale.points,
            {
              id: crypto.randomUUID(),
              appliedValue: "",
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

  function getReferenceInstrument(referenceInstrumentId: string) {
    return referenceInstruments.find(
      (instrument) => instrument.id === referenceInstrumentId
    );
  }

  function validateScales() {
    if (scales.length === 0) {
      throw new Error("Deve essere presente almeno una scala di verifica.");
    }

    for (let index = 0; index < scales.length; index += 1) {
      const scale = scales[index];
      const scaleLabel = scale.scaleName || "Scala " + String(index + 1);

      if (!scale.scaleName.trim()) {
        throw new Error(
          "Inserisci il nome della scala " + String(index + 1) + "."
        );
      }

      if (scale.referenceInstrumentIds.length === 0) {
        throw new Error(
          "Seleziona almeno uno strumento campione per " + scaleLabel + "."
        );
      }

      const scaleReferenceInstruments = scale.referenceInstrumentIds
        .map((instrumentId) => getReferenceInstrument(instrumentId))
        .filter(Boolean) as ReferenceInstrument[];

      if (scaleReferenceInstruments.length !== scale.referenceInstrumentIds.length) {
        throw new Error(
          "Strumento campione non trovato per " + scaleLabel + "."
        );
      }

      if (
        scaleReferenceInstruments.some((referenceInstrument) =>
          isReferenceInstrumentBlocked(
            getEffectiveReferenceInstrumentStatus(
              referenceInstrument.status,
              referenceInstrument.certificate_expiry
            )
          )
        )
      ) {
        throw new Error(
          "Uno strumento campione selezionato per " +
            scaleLabel +
            " è scaduto o fuori servizio."
        );
      }

      if (scale.points.length === 0) {
        throw new Error(
          "Inserisci almeno un punto di misura per " + scaleLabel + "."
        );
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

  async function saveCalibration() {
    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");
    setSavedRecordId(null);
    setSavedRecordNumber(null);

    try {
      if (isInternalVerification) {
        if (!selectedInternalInstrument) {
          throw new Error("Seleziona lo strumento interno da verificare.");
        }

        if (!verificationLocation.trim()) {
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

      validateScales();

      const firstScaleReferenceInstruments = scales[0].referenceInstrumentIds
        .map((instrumentId) => getReferenceInstrument(instrumentId))
        .filter(Boolean) as ReferenceInstrument[];

      const firstReferenceInstrument = firstScaleReferenceInstruments[0];

      if (!firstReferenceInstrument) {
        throw new Error("Seleziona lo strumento campione della prima scala.");
      }

      const { data: calibrationType, error: typeError } = await supabase
        .from("calibration_types")
        .select("id")
        .eq("code", "CT")
        .single();

      if (typeError || !calibrationType) {
        throw new Error(
          "Tipo verifica CT non trovato. Controlla la tabella calibration_types."
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
        .eq("code", "PROC_CT_FORZA")
        .eq("is_active", true)
        .order("revision_date", { ascending: false })
        .limit(1)
        .single();

      if (procedureError || !procedure) {
        throw new Error(
          "Procedura CT attiva non trovata. Controlla la tabella calibration_procedures."
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
            measurement_quantity:
              selectedCustomerInstrument?.measurement_quantity ?? null,
            unit: selectedCustomerInstrument?.unit ?? null,
            measurement_range: selectedCustomerInstrument?.measurement_range ?? null,
            resolution: null,
            acceptance_class: null,
          };

      const referenceInstrumentSnapshot =
        buildReferenceInstrumentSnapshot(firstReferenceInstrument);

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
        "CT-" + String(new Date().getFullYear()) + "-" + String(Date.now());

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
          reference_instrument_id: firstReferenceInstrument.id,
          customer_instrument_snapshot: verifiedInstrumentSnapshot,
          reference_instrument_snapshot: referenceInstrumentSnapshot,
          procedure_snapshot: procedureSnapshot,
          mode,
          verification_module: "CT_FORCE",
          report_status: "draft",
          verification_date: new Date().toISOString().slice(0, 10),
          operator_name: operatorName || null,
          location: isInternalVerification
            ? verificationLocation.trim()
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

      const verificationDate = new Date().toISOString().slice(0, 10);

      const reportCustomerName = isInternalVerification
        ? "Tecnocontrolli S.r.l."
        : selectedCustomer?.business_name ?? "";
      const reportCustomerNumber = isInternalVerification
        ? null
        : selectedCustomer?.customer_number ?? null;
      const reportLocation = isInternalVerification
        ? verificationLocation.trim()
        : selectedSiteDescription || selectedSite?.name || "";
      const verifiedInstrumentName = isInternalVerification
        ? selectedInternalInstrument?.name ?? ""
        : selectedCustomerInstrument?.name ?? "";
      const verifiedInstrumentManufacturer = isInternalVerification
        ? selectedInternalInstrument?.manufacturer ?? null
        : selectedCustomerInstrument?.manufacturer ?? null;
      const verifiedInstrumentModel = isInternalVerification
        ? selectedInternalInstrument?.model ?? null
        : selectedCustomerInstrument?.model ?? null;
      const verifiedInstrumentSerial = isInternalVerification
        ? selectedInternalInstrument?.serial_number ?? null
        : selectedCustomerInstrument?.serial_number ?? null;
      const verifiedInstrumentRange = isInternalVerification
        ? selectedInternalInstrument?.measurement_range ?? null
        : selectedCustomerInstrument?.measurement_range ?? null;

      const firstScaleReferenceName =
        firstScaleReferenceInstruments.length > 1
          ? combineReferenceInstrumentNames(firstScaleReferenceInstruments)
          : firstReferenceInstrument.name || "Strumento campione";

      const reportDefaults = getCtForceReportDefaults({
        customerName: reportCustomerName,
        customerNumber: reportCustomerNumber,
        instrumentName: verifiedInstrumentName,
        instrumentManufacturer: verifiedInstrumentManufacturer,
        instrumentModel: verifiedInstrumentModel,
        instrumentSerial: verifiedInstrumentSerial,
        instrumentRange: verifiedInstrumentRange,
        referenceName: firstScaleReferenceName,
        referenceManufacturer:
          firstScaleReferenceInstruments.length === 1
            ? firstReferenceInstrument.manufacturer
            : null,
        referenceModel:
          firstScaleReferenceInstruments.length === 1
            ? firstReferenceInstrument.model
            : null,
        referenceSerial:
          firstScaleReferenceInstruments.length === 1
            ? firstReferenceInstrument.serial_number
            : null,
        referenceInternalCode:
          firstScaleReferenceInstruments.length === 1
            ? firstReferenceInstrument.internal_code
            : null,
        location: reportLocation,
      });

      const { error: reportDetailsError } = await supabase
        .from("calibration_report_details")
        .insert({
          calibration_record_id: record.id,
          main_report_number: null,
          technical_annex_number: null,
          acceptance_number: null,
          acceptance_date: null,
          report_date: null,
          test_date: verificationDate,
          customer_name: reportCustomerName,
          site_description: reportLocation,
          work_object: reportDefaults.work_object,
          requested_tests: reportDefaults.requested_tests,
          premise_text: isInternalVerification
            ? buildCtInternalPremiseText({
                verificationDate,
                location: reportLocation,
                instrumentName: verifiedInstrumentName,
                manufacturer: verifiedInstrumentManufacturer,
                model: verifiedInstrumentModel,
                serialNumber: verifiedInstrumentSerial,
                measurementRange: verifiedInstrumentRange,
              })
            : buildCtPremiseText({
                verificationDate,
                customerName: reportCustomerName,
                siteName: reportLocation,
                instrumentName: verifiedInstrumentName,
                manufacturer: verifiedInstrumentManufacturer,
                model: verifiedInstrumentModel,
                serialNumber: verifiedInstrumentSerial,
                measurementRange: verifiedInstrumentRange,
              }),
          scope_text: reportDefaults.scope_text,
          apparatus_description: reportDefaults.apparatus_description,
          execution_method: reportDefaults.execution_method,
          results_text: reportDefaults.results_text,
          temperature: ambientTemperature.trim() || null,
          humidity: ambientHumidity.trim() || null,
          technician_name: operatorName || null,
          reviewer_name: null,
          director_name: null,
          instrument_photo_url: null,
          notes: null,
        });

      if (reportDetailsError) {
        throw new Error(
          reportDetailsError.message ||
            "Verifica creata, ma errore nel salvataggio dei dati rapporto."
        );
      }

      const scaleRows = scales.map((scale, index) => {
        const scaleReferenceInstruments = scale.referenceInstrumentIds
          .map((instrumentId) => getReferenceInstrument(instrumentId))
          .filter(Boolean) as ReferenceInstrument[];
        const primaryScaleReferenceInstrument = scaleReferenceInstruments[0];

        return {
          calibration_record_id: record.id,
          scale_order: index + 1,
          scale_name: scale.scaleName.trim(),
          scale_range: scale.scaleRange.trim() || null,
          reference_instrument_id: primaryScaleReferenceInstrument?.id ?? null,
          reference_instrument_snapshot: buildReferenceInstrumentSnapshot(
            primaryScaleReferenceInstrument
          ),
          reference_instrument_ids: scaleReferenceInstruments.map(
            (instrument) => instrument.id
          ),
          reference_instruments_snapshot: scaleReferenceInstruments.map(
            (instrument) => buildReferenceInstrumentSnapshot(instrument)
          ),
          notes: scale.notes.trim() || null,
        };
      });

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

      const measurementRows = calculatedScales.flatMap((scale, scaleIndex) => {
        const insertedScale = insertedScales.find(
          (item) => item.scale_order === scaleIndex + 1
        );

        if (!insertedScale) {
          throw new Error(
            "Scala " +
              String(scaleIndex + 1) +
              " non trovata dopo il salvataggio."
          );
        }

        return scale.calculatedPoints.map((point, pointIndex) => ({
          calibration_record_id: record.id,
          scale_id: insertedScale.id,
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

      setSavedRecordId(record.id);
      setSavedRecordNumber(recordNumber);
      setSaveMessage(
        "Verifica salvata correttamente con numero " +
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
          Dati generali verifica
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Tipo verifica
            </span>
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as "compressione" | "trazione");
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="compressione">Compressione</option>
              <option value="trazione">Trazione</option>
            </select>
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
            placeholder="Eventuali note operative"
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {isInternalVerification ? (
        <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Strumento interno verificato
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 lg:col-span-2">
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
                <option value="">
                  {isLoadingData
                    ? "Caricamento strumenti interni..."
                    : "Seleziona strumento interno"}
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
                value={verificationLocation}
                onChange={(event) => {
                  setVerificationLocation(event.target.value);
                  resetSaveState();
                }}
                placeholder="Es. Laboratorio Bologna / sede cliente / campo"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {internalInstruments.length === 0 && !isLoadingData && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Nessuno strumento interno registrato. Vai in “Strumenti interni”
              e aggiungi l’attrezzatura prima di creare una VI.
            </div>
          )}

          {selectedInternalInstrument && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
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
                      <span className="text-sm font-medium text-slate-700">
                        Nome luogo *
                      </span>
                      <input
                        value={newSiteName}
                        onChange={(event) => setNewSiteName(event.target.value)}
                        placeholder="Es. Sede principale / Cantiere"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1 lg:col-span-2">
                      <span className="text-sm font-medium text-slate-700">
                        Indirizzo
                      </span>
                      <input
                        value={newSiteAddress}
                        onChange={(event) => setNewSiteAddress(event.target.value)}
                        placeholder="Via / località"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">CAP</span>
                      <input
                        value={newSitePostalCode}
                        onChange={(event) => setNewSitePostalCode(event.target.value)}
                        placeholder="CAP"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">Città</span>
                      <input
                        value={newSiteCity}
                        onChange={(event) => setNewSiteCity(event.target.value)}
                        placeholder="Città"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">Provincia</span>
                      <input
                        value={newSiteProvince}
                        onChange={(event) => setNewSiteProvince(event.target.value)}
                        placeholder="BO"
                        maxLength={2}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                      />
                    </label>
                  </div>

                  {siteSaveError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      {siteSaveError}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={saveNewSite}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                      Salva luogo prove
                    </button>
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

          {selectedCustomer &&
            selectedSite &&
            filteredCustomerInstruments.length === 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Per questo cliente non risultano strumenti cliente registrati. Vai in
                “Strumenti cliente” e aggiungi l’attrezzatura prima di creare la
                verifica.
              </div>
            )}

          {selectedCustomerInstrument && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="font-semibold">Cliente</p>
                  <p>
                    {selectedCustomer?.customer_number
                      ? selectedCustomer.customer_number + " - "
                      : ""}
                    {selectedCustomer?.business_name ?? "-"}
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Luogo prove</p>
                  <p>{selectedSiteDescription || "-"}</p>
                </div>

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
                  <p className="font-semibold">Grandezza / unità</p>
                  <p>
                    {[
                      selectedCustomerInstrument.measurement_quantity,
                      selectedCustomerInstrument.unit,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Fondo scala</p>
                  <p>{selectedCustomerInstrument.measurement_range ?? "-"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Scale di verifica
            </h2>
            <p className="text-sm text-slate-500">
              Usa una seconda scala quando lo stesso strumento deve essere
              verificato con due strumenti campione diversi, ad esempio fondo scala
              300 kN e fondo scala 3000 kN.
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={hasDoubleScale}
              onChange={(event) =>
                handleDoubleScaleChange(event.target.checked)
              }
              className="h-4 w-4"
            />
            Verifica con doppia scala
          </label>
        </div>
      </div>

      {calculatedScales.map((scale, scaleIndex) => {
        const scaleReferenceInstruments = scale.referenceInstrumentIds
          .map((instrumentId) => getReferenceInstrument(instrumentId))
          .filter(Boolean) as ReferenceInstrument[];

        return (
          <div
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
                    Punti di misura, campione e grafico relativi a questa scala.
                  </p>
                </div>
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
                    placeholder="Es. Scala 300 kN"
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
                  value={scale.notes}
                  onChange={(event) =>
                    updateScale(scale.id, "notes", event.target.value)
                  }
                  placeholder="Eventuali note sulla scala/strumento campione utilizzato"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              {scaleReferenceInstruments.length > 0 && (
                <div className="mt-5 space-y-3">
                  {scaleReferenceInstruments.map((instrument) => {
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
                            <p className="font-semibold">File certificato</p>
                            {instrument.certificate_file_url ? (
                              <a
                                href={instrument.certificate_file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-emerald-700 hover:underline"
                              >
                                Apri certificato
                              </a>
                            ) : (
                              <p className="text-amber-700">Mancante</p>
                            )}
                          </div>

                          <div>
                            <p className="font-semibold">Fondo scala</p>
                            <p>{instrument.measurement_range ?? "-"}</p>
                          </div>
                        </div>

                        {effectiveStatus === "expiring" && (
                          <p className="mt-3 font-medium">
                            Attenzione: il campione è in scadenza. La verifica
                            può essere salvata, ma il dato deve essere
                            controllato.
                          </p>
                        )}

                        {instrumentBlocked && (
                          <p className="mt-3 font-medium">
                            Blocco: il campione è scaduto o fuori servizio.
                            Seleziona un altro campione valido.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Punto</th>
                    <th className="px-4 py-3">Punto di applicazione</th>
                    <th className="bg-white text-slate-900 px-4 py-3">
                  Ciclo 1
                </th>
                    <th className="bg-slate-100 text-slate-900 px-4 py-3">
                  Ciclo 2
                </th>
                    <th className="bg-white text-slate-900 px-4 py-3">
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

                        <td className="bg-white px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editablePoint?.cycle1 ?? ""}
                            data-cycle-field="cycle1"
                            onKeyDown={(event) => handleCycleTab(event, "cycle1")}
                            onChange={(event) =>
                              updatePoint(
                                scale.id,
                                point.id,
                                "cycle1",
                                event.target.value
                              )
                            }
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-950 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                          /></td>

                        <td className="bg-slate-50 px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editablePoint?.cycle2 ?? ""}
                            data-cycle-field="cycle2"
                            onKeyDown={(event) => handleCycleTab(event, "cycle2")}
                            onChange={(event) =>
                              updatePoint(
                                scale.id,
                                point.id,
                                "cycle2",
                                event.target.value
                              )
                            }
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-950 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                          /></td>

                        <td className="bg-white px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editablePoint?.cycle3 ?? ""}
                            data-cycle-field="cycle3"
                            onKeyDown={(event) => handleCycleTab(event, "cycle3")}
                            onChange={(event) =>
                              updatePoint(
                                scale.id,
                                point.id,
                                "cycle3",
                                event.target.value
                              )
                            }
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-950 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                          /></td>

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
                          {formatItalianNumber(point.repeatabilityErrorPercent)}
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
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Grafico errori -{" "}
                {scale.scaleName || "Scala " + String(scaleIndex + 1)}
              </h3>
              <ForceErrorChart points={scale.calculatedPoints}
                  lineColor="amber" />
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Salvataggio verifica
          </h2>
          <p className="text-sm text-slate-500">
            La verifica viene salvata come bozza. Per le VT potrai passare ai
            dati rapporto; per le VI verrà generato il rapportino tecnico nello
            step successivo.
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
        <strong>Nota tecnica:</strong> questa è la prima versione del modulo CT.
        Prima dell’uso reale dovremo validare le formule rispetto ai vostri Excel,
        alle procedure interne e ai riferimenti normativi applicabili.
      </div>
    </div>
  );
}
