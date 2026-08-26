"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReportDefaultsByModule } from "@/lib/report-defaults";

type ReportDetailsInitialData = {
  id: string | null;
  calibration_record_id: string;
  main_report_number: string | null;
  technical_annex_number: string | null;
  acceptance_number: string | null;
  acceptance_date: string | null;
  report_date: string | null;
  test_date: string | null;
  customer_name: string | null;
  site_description: string | null;
  work_object: string | null;
  requested_tests: string | null;
  premise_text: string | null;
  scope_text: string | null;
  apparatus_description: string | null;
  execution_method: string | null;
  results_text: string | null;
  temperature: string | null;
  humidity: string | null;
  technician_name: string | null;
  reviewer_name: string | null;
  director_name: string | null;
  instrument_photo_url: string | null;
  notes: string | null;
};

type AutoPremiseData = {
  customerName: string;
  siteDescription: string;
  instrumentName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  range: string;
  verificationModule?: string;
  verificationDate?: string;
};

type Technician = {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  signature_url: string | null;
  is_active: boolean;
};

type ReportSignature = {
  id: string;
  calibration_record_id: string;
  signature_role: string;
  technician_id: string | null;
  display_name: string;
  signature_url_snapshot: string | null;
  sort_order: number;
};

type ReportPhotoCategory = "instrument" | "test_phase";

type ReportPhoto = {
  id: string;
  calibration_record_id: string;
  photo_category: ReportPhotoCategory;
  photo_url: string;
  photo_path: string | null;
  file_name?: string | null;
  caption: string | null;
  sort_order: number | null;
  created_at: string | null;
};

type PendingReportPhoto = {
  id: string;
  photo_category: ReportPhotoCategory;
  file: File;
  previewUrl: string;
  caption: string;
};

type TechnicalCompletenessState = {
  isLoading: boolean;
  error: string;
  scaleCount: number;
  measurementCount: number;
  scalesWithoutReferenceCount: number;
  scalesWithoutMeasurementsCount: number;
};

type CompletenessItem = {
  label: string;
  isComplete: boolean;
  warning: string;
};

type CalibrationReportDetailsFormProps = {
  recordId: string;
  initialData?: ReportDetailsInitialData | null;
  autoPremiseData?: AutoPremiseData;
  isReadOnly?: boolean;
  reportStatus?: string | null;
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

function initialMainReportNumber(value: string | null | undefined) {
  const normalizedValue = valueOrEmpty(value).trim();

  if (/^CT-\d{4}-\d+$/.test(normalizedValue)) {
    return "";
  }

  return normalizedValue;
}

function formatItalianDateFromInput(date: string | null | undefined) {
  if (!date) {
    return "____/____/________";
  }

  const parts = date.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return date;
}


function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildEmptyInitialData(recordId: string): ReportDetailsInitialData {
  return {
    id: null,
    calibration_record_id: recordId,
    main_report_number: null,
    technical_annex_number: null,
    acceptance_number: null,
    acceptance_date: null,
    report_date: null,
    test_date: null,
    customer_name: null,
    site_description: null,
    work_object: null,
    requested_tests: null,
    premise_text: null,
    scope_text: null,
    apparatus_description: null,
    execution_method: null,
    results_text: null,
    temperature: null,
    humidity: null,
    technician_name: null,
    reviewer_name: null,
    director_name: null,
    instrument_photo_url: null,
    notes: null,
  };
}

function getFileExtension(file: File) {
  const extensionFromName = file.name.split(".").pop();

  if (extensionFromName) {
    return extensionFromName.toLowerCase();
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}


function buildReportDefaults(params: {
  autoPremiseData?: AutoPremiseData;
  customerName?: string;
  siteDescription?: string;
  testDate?: string;
}) {
  const autoPremiseData = params.autoPremiseData;

  return getReportDefaultsByModule(
    autoPremiseData?.verificationModule,
    null,
    {
      customerName:
        params.customerName ||
        autoPremiseData?.customerName ||
        null,
      instrumentName: autoPremiseData?.instrumentName ?? null,
      instrumentManufacturer: autoPremiseData?.manufacturer ?? null,
      instrumentModel: autoPremiseData?.model ?? null,
      instrumentSerial: autoPremiseData?.serialNumber ?? null,
      instrumentRange: autoPremiseData?.range ?? null,
      location:
        params.siteDescription ||
        autoPremiseData?.siteDescription ||
        null,
      testDate:
        params.testDate ||
        autoPremiseData?.verificationDate ||
        null,
    }
  );
}

function joinTechnicianNames(technicians: Technician[], ids: string[]) {
  return ids
    .map((id) => technicians.find((technician) => technician.id === id))
    .filter((technician): technician is Technician => Boolean(technician))
    .map((technician) => technician.full_name)
    .join(", ");
}

export default function CalibrationReportDetailsForm({
  recordId,
  initialData,
  autoPremiseData,
  isReadOnly = false,
  reportStatus,
}: CalibrationReportDetailsFormProps) {
  const router = useRouter();

  const safeInitialData = initialData ?? buildEmptyInitialData(recordId);
  const currentReportStatus = reportStatus ?? "draft";
  const initialDefaultTexts = buildReportDefaults({
    autoPremiseData,
    customerName:
      valueOrEmpty(safeInitialData.customer_name) ||
      autoPremiseData?.customerName ||
      "",
    siteDescription:
      valueOrEmpty(safeInitialData.site_description) ||
      autoPremiseData?.siteDescription ||
      "",
    testDate:
      valueOrEmpty(safeInitialData.test_date) ||
      autoPremiseData?.verificationDate ||
      "",
  });

  const [mainReportNumber, setMainReportNumber] = useState(
    initialMainReportNumber(safeInitialData.main_report_number)
  );
  const [technicalAnnexNumber, setTechnicalAnnexNumber] = useState(
    valueOrEmpty(safeInitialData.technical_annex_number)
  );
  const [acceptanceNumber, setAcceptanceNumber] = useState(
    valueOrEmpty(safeInitialData.acceptance_number)
  );
  const [acceptanceDate, setAcceptanceDate] = useState(
    valueOrEmpty(safeInitialData.acceptance_date)
  );
  const [reportDate, setReportDate] = useState(
    valueOrEmpty(safeInitialData.report_date) || todayInputDate()
  );
  const [testDate, setTestDate] = useState(
    valueOrEmpty(safeInitialData.test_date) ||
      autoPremiseData?.verificationDate ||
      ""
  );

  const [customerName, setCustomerName] = useState(
    valueOrEmpty(safeInitialData.customer_name) ||
      autoPremiseData?.customerName ||
      ""
  );
  const [siteDescription, setSiteDescription] = useState(
    valueOrEmpty(safeInitialData.site_description) ||
      autoPremiseData?.siteDescription ||
      ""
  );
  const [temperature, setTemperature] = useState(
    valueOrEmpty(safeInitialData.temperature)
  );
  const [humidity, setHumidity] = useState(
    valueOrEmpty(safeInitialData.humidity)
  );
  const [workObject, setWorkObject] = useState(
    valueOrEmpty(safeInitialData.work_object) || initialDefaultTexts.work_object
  );
  const [requestedTests, setRequestedTests] = useState(
    valueOrEmpty(safeInitialData.requested_tests) ||
      initialDefaultTexts.requested_tests
  );
  const [premiseText, setPremiseText] = useState(
    valueOrEmpty(safeInitialData.premise_text) ||
      initialDefaultTexts.premise_text
  );
  const [scopeText, setScopeText] = useState(
    valueOrEmpty(safeInitialData.scope_text) ||
      initialDefaultTexts.scope_text
  );
  const [apparatusDescription, setApparatusDescription] = useState(
    valueOrEmpty(safeInitialData.apparatus_description) ||
      initialDefaultTexts.apparatus_description
  );
  const [executionMethod, setExecutionMethod] = useState(
    valueOrEmpty(safeInitialData.execution_method) ||
      initialDefaultTexts.execution_method
  );
  const [resultsText, setResultsText] = useState(
    valueOrEmpty(safeInitialData.results_text) ||
      initialDefaultTexts.results_text
  );

  useEffect(() => {
    const nextDefaults = buildReportDefaults({
      autoPremiseData,
      customerName,
      siteDescription,
      testDate,
    });

    if (!valueOrEmpty(safeInitialData.work_object)) {
      setWorkObject(nextDefaults.work_object);
    }

    if (!valueOrEmpty(safeInitialData.requested_tests)) {
      setRequestedTests(nextDefaults.requested_tests);
    }

    if (!valueOrEmpty(safeInitialData.premise_text)) {
      setPremiseText(nextDefaults.premise_text);
    }

    if (!valueOrEmpty(safeInitialData.scope_text)) {
      setScopeText(nextDefaults.scope_text);
    }

    if (!valueOrEmpty(safeInitialData.apparatus_description)) {
      setApparatusDescription(nextDefaults.apparatus_description);
    }

    if (!valueOrEmpty(safeInitialData.execution_method)) {
      setExecutionMethod(nextDefaults.execution_method);
    }

    if (!valueOrEmpty(safeInitialData.results_text)) {
      setResultsText(nextDefaults.results_text);
    }
  }, [
    autoPremiseData,
    customerName,
    safeInitialData.apparatus_description,
    safeInitialData.execution_method,
    safeInitialData.premise_text,
    safeInitialData.requested_tests,
    safeInitialData.results_text,
    safeInitialData.scope_text,
    safeInitialData.work_object,
    siteDescription,
    testDate,
  ]);

  const [instrumentPhotoUrl, setInstrumentPhotoUrl] = useState(
    valueOrEmpty(safeInitialData.instrument_photo_url)
  );
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState("");
  const [reportPhotos, setReportPhotos] = useState<ReportPhoto[]>([]);
  const [uploadingReportPhotos, setUploadingReportPhotos] = useState<
    PendingReportPhoto[]
  >([]);
  const [pendingReportPhotos, setPendingReportPhotos] = useState<
    PendingReportPhoto[]
  >([]);
  const [reportPhotoLoadError, setReportPhotoLoadError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [activeCameraCategory, setActiveCameraCategory] =
    useState<ReportPhotoCategory | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const [notes, setNotes] = useState(valueOrEmpty(safeInitialData.notes));

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [testingTechnicianIds, setTestingTechnicianIds] = useState<string[]>(
    []
  );
  const [reviewerTechnicianIds, setReviewerTechnicianIds] = useState<string[]>(
    []
  );
  const [directorTechnicianId, setDirectorTechnicianId] = useState("");
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(true);
  const [signatureLoadError, setSignatureLoadError] = useState("");

  const [technicalCompleteness, setTechnicalCompleteness] =
    useState<TechnicalCompletenessState>({
      isLoading: true,
      error: "",
      scaleCount: 0,
      measurementCount: 0,
      scalesWithoutReferenceCount: 0,
      scalesWithoutMeasurementsCount: 0,
    });

  useEffect(() => {
    let isMounted = true;

    async function loadReportPhotos() {
      setReportPhotoLoadError("");

      const { data, error } = await supabase
        .from("calibration_report_photos")
        .select(
          "id, calibration_record_id, photo_category, photo_url, photo_path, file_name, caption, sort_order, created_at"
        )
        .eq("calibration_record_id", recordId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        setReportPhotoLoadError(
          "Tabella foto rapporto non disponibile o errore caricamento: " +
            error.message
        );
        setReportPhotos([]);
        return;
      }

      setReportPhotos((data ?? []) as ReportPhoto[]);
    }

    loadReportPhotos();

    return () => {
      isMounted = false;
    };
  }, [recordId]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const directorTechnician = useMemo(() => {
    return technicians.find(
      (technician) => technician.id === directorTechnicianId
    );
  }, [technicians, directorTechnicianId]);

  const selectedTestingTechnicians = useMemo(() => {
    return testingTechnicianIds
      .map((technicianId) =>
        technicians.find((technician) => technician.id === technicianId)
      )
      .filter((technician): technician is Technician => Boolean(technician));
  }, [technicians, testingTechnicianIds]);

  const selectedReviewerTechnicians = useMemo(() => {
    return reviewerTechnicianIds
      .map((technicianId) =>
        technicians.find((technician) => technician.id === technicianId)
      )
      .filter((technician): technician is Technician => Boolean(technician));
  }, [technicians, reviewerTechnicianIds]);

  const completenessItems = useMemo<CompletenessItem[]>(() => {
    const testingSignaturesMissing = selectedTestingTechnicians.some(
      (technician) => !technician.signature_url
    );

    const reviewerSignaturesMissing = selectedReviewerTechnicians.some(
      (technician) => !technician.signature_url
    );

    return [
      {
        label: "Numero rapporto",
        isComplete: mainReportNumber.trim().length > 0,
        warning: "Numero rapporto mancante",
      },
      {
        label: "Data rapporto",
        isComplete: reportDate.trim().length > 0,
        warning: "Data rapporto mancante",
      },
      {
        label: "Data delle prove",
        isComplete: testDate.trim().length > 0,
        warning: "Data delle prove mancante",
      },
      {
        label: "Committente",
        isComplete: customerName.trim().length > 0,
        warning: "Committente mancante",
      },
      {
        label: "Oggetto dei lavori",
        isComplete: workObject.trim().length > 0,
        warning: "Oggetto dei lavori mancante",
      },
      {
        label: "Foto strumento",
        isComplete: reportPhotos.some(
          (photo) => photo.photo_category === "instrument"
        ),
        warning: "Foto strumento mancante",
      },
      {
        label: "Tecnico/i addetto/i alle prove",
        isComplete: testingTechnicianIds.length > 0,
        warning: "Tecnico/i addetto/i alle prove non selezionato/i",
      },
      {
        label: "Firma tecnico/i addetto/i alle prove",
        isComplete:
          testingTechnicianIds.length > 0 && !testingSignaturesMissing,
        warning: "Firma mancante per almeno un tecnico addetto alle prove",
      },
      {
        label: "Redatto / verificato",
        isComplete: reviewerTechnicianIds.length > 0,
        warning: "Redatto/verificato non selezionato",
      },
      {
        label: "Firma redatto / verificato",
        isComplete:
          reviewerTechnicianIds.length > 0 && !reviewerSignaturesMissing,
        warning: "Firma mancante per almeno un tecnico redatto/verificato",
      },
      {
        label: "Direttore di laboratorio",
        isComplete: Boolean(directorTechnicianId),
        warning: "Direttore di laboratorio non impostato",
      },
      {
        label: "Firma direttore di laboratorio",
        isComplete: Boolean(directorTechnician?.signature_url),
        warning: "Firma direttore di laboratorio mancante",
      },
      {
        label: "Sezione tecnica",
        isComplete:
          technicalCompleteness.scaleCount > 0 &&
          technicalCompleteness.measurementCount > 0,
        warning: "Sezione tecnica o misure non presenti",
      },
      {
        label: "Strumenti campione associati alle scale",
        isComplete:
          technicalCompleteness.scaleCount > 0 &&
          technicalCompleteness.scalesWithoutReferenceCount === 0,
        warning: "Una o più scale non hanno lo strumento campione associato",
      },
      {
        label: "Punti di misura per ogni scala",
        isComplete:
          technicalCompleteness.scaleCount > 0 &&
          technicalCompleteness.measurementCount > 0 &&
          technicalCompleteness.scalesWithoutMeasurementsCount === 0,
        warning: "Una o più scale non hanno punti di misura",
      },
    ];
  }, [
    mainReportNumber,
    reportDate,
    testDate,
    customerName,
    workObject,
    reportPhotos,
    testingTechnicianIds,
    reviewerTechnicianIds,
    directorTechnicianId,
    directorTechnician,
    selectedTestingTechnicians,
    selectedReviewerTechnicians,
    technicalCompleteness,
  ]);

  const missingCompletenessItems = useMemo(() => {
    return completenessItems.filter((item) => !item.isComplete);
  }, [completenessItems]);

  const isReportComplete = missingCompletenessItems.length === 0;

  useEffect(() => {
    loadSignatureData();
    loadTechnicalCompletenessData();
  }, []);

  async function loadSignatureData() {
    setIsLoadingSignatures(true);
    setSignatureLoadError("");

    const { data: techniciansData, error: techniciansError } = await supabase
      .from("calibration_technicians")
      .select(
        `
        id,
        full_name,
        role,
        email,
        signature_url,
        is_active
      `
      )
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (techniciansError) {
      setSignatureLoadError(techniciansError.message);
      setIsLoadingSignatures(false);
      return;
    }

    const activeTechnicians = (techniciansData ?? []) as Technician[];
    setTechnicians(activeTechnicians);

    const { data: settingsData, error: settingsError } = await supabase
      .from("calibration_report_settings")
      .select("default_director_technician_id")
      .eq("id", true)
      .maybeSingle();

    if (settingsError) {
      setSignatureLoadError(settingsError.message);
      setIsLoadingSignatures(false);
      return;
    }

    const defaultDirectorId =
      typeof settingsData?.default_director_technician_id === "string"
        ? settingsData.default_director_technician_id
        : "";

    const { data: signaturesData, error: signaturesError } = await supabase
      .from("calibration_report_signatures")
      .select(
        `
        id,
        calibration_record_id,
        signature_role,
        technician_id,
        display_name,
        signature_url_snapshot,
        sort_order
      `
      )
      .eq("calibration_record_id", recordId)
      .order("sort_order", { ascending: true });

    if (signaturesError) {
      setSignatureLoadError(signaturesError.message);
      setIsLoadingSignatures(false);
      return;
    }

    const signatures = (signaturesData ?? []) as ReportSignature[];

    const testingIds = signatures
      .filter((signature) => signature.signature_role === "testing_technician")
      .map((signature) => signature.technician_id)
      .filter((id): id is string => Boolean(id));

    const reviewerIds = signatures
      .filter((signature) => signature.signature_role === "reviewer")
      .map((signature) => signature.technician_id)
      .filter((id): id is string => Boolean(id));

    const savedDirectorId =
      signatures.find((signature) => signature.signature_role === "director")
        ?.technician_id ?? "";

    setTestingTechnicianIds(testingIds);
    setReviewerTechnicianIds(reviewerIds);
    setDirectorTechnicianId(savedDirectorId || defaultDirectorId || "");

    setIsLoadingSignatures(false);
  }

  async function loadTechnicalCompletenessData() {
    setTechnicalCompleteness((current) => ({
      ...current,
      isLoading: true,
      error: "",
    }));

    const { data: scalesData, error: scalesError } = await supabase
      .from("calibration_record_scales")
      .select("id, reference_instrument_id")
      .eq("calibration_record_id", recordId);

    if (scalesError) {
      setTechnicalCompleteness({
        isLoading: false,
        error: scalesError.message,
        scaleCount: 0,
        measurementCount: 0,
        scalesWithoutReferenceCount: 0,
        scalesWithoutMeasurementsCount: 0,
      });
      return;
    }

    const { data: measurementsData, error: measurementsError } = await supabase
      .from("calibration_measurements")
      .select("id, scale_id")
      .eq("calibration_record_id", recordId);

    if (measurementsError) {
      setTechnicalCompleteness({
        isLoading: false,
        error: measurementsError.message,
        scaleCount: 0,
        measurementCount: 0,
        scalesWithoutReferenceCount: 0,
        scalesWithoutMeasurementsCount: 0,
      });
      return;
    }

    const scales = (scalesData ?? []) as Array<{
      id: string;
      reference_instrument_id: string | null;
    }>;

    const measurements = (measurementsData ?? []) as Array<{
      id: string;
      scale_id: string | null;
    }>;

    const scaleIdsWithMeasurements = new Set(
      measurements
        .map((measurement) => measurement.scale_id)
        .filter((scaleId): scaleId is string => Boolean(scaleId))
    );

    const scalesWithoutReferenceCount = scales.filter(
      (scale) => !scale.reference_instrument_id
    ).length;

    const scalesWithoutMeasurementsCount = scales.filter(
      (scale) => !scaleIdsWithMeasurements.has(scale.id)
    ).length;

    setTechnicalCompleteness({
      isLoading: false,
      error: "",
      scaleCount: scales.length,
      measurementCount: measurements.length,
      scalesWithoutReferenceCount,
      scalesWithoutMeasurementsCount,
    });
  }

  function handleTestDateChange(nextDate: string) {
    setTestDate(nextDate);
  }

  function regenerateDefaultTexts() {
    const nextDefaults = buildReportDefaults({
      autoPremiseData,
      customerName,
      siteDescription,
      testDate,
    });

    setWorkObject(nextDefaults.work_object);
    setRequestedTests(nextDefaults.requested_tests);
    setPremiseText(nextDefaults.premise_text);
    setScopeText(nextDefaults.scope_text);
    setApparatusDescription(nextDefaults.apparatus_description);
    setExecutionMethod(nextDefaults.execution_method);
    setResultsText(nextDefaults.results_text);
    setSaveMessage("");
    setSaveError("");
  }

  function handlePhotoChange(file: File | null) {
    setSelectedPhotoFile(file);

    if (!file) {
      setSelectedPhotoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedPhotoPreview(previewUrl);
  }

  async function saveReportPhotoFilesImmediately(
    files: File[],
    category: ReportPhotoCategory
  ) {
    if (files.length === 0) {
      return;
    }

    const temporaryPhotos: PendingReportPhoto[] = files.map((file, index) => ({
      id:
        "uploading-" +
        category +
        "-" +
        Date.now() +
        "-" +
        String(index + 1),
      photo_category: category,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: category === "instrument" ? "Foto strumento" : "Fase prova",
    }));

    setUploadingReportPhotos((currentPhotos) => [
      ...currentPhotos,
      ...temporaryPhotos,
    ]);

    setIsSaving(true);
    setSaveMessage("Caricamento foto in corso...");
    setSaveError("");
    setReportPhotoLoadError("");

    try {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const maxSizeBytes = 10 * 1024 * 1024;

      const insertedRows: ReportPhoto[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        if (!allowedTypes.includes(file.type)) {
          throw new Error(
            "Formato foto non valido per " +
              file.name +
              ". Usa JPG, PNG oppure WEBP."
          );
        }

        if (file.size > maxSizeBytes) {
          throw new Error(
            "La foto " +
              file.name +
              " è troppo grande. Dimensione massima: 10 MB."
          );
        }

        const extension = getFileExtension(file);
        const filePath =
          recordId +
          "/" +
          category +
          "-" +
          Date.now() +
          "-" +
          String(index + 1) +
          "." +
          extension;

        const { error: uploadError } = await supabase.storage
          .from("calibration-photos")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(
            "Errore caricamento foto nello storage: " + uploadError.message
          );
        }

        const { data } = supabase.storage
          .from("calibration-photos")
          .getPublicUrl(filePath);

        if (!data.publicUrl) {
          throw new Error(
            "Foto caricata nello storage, ma URL pubblico non disponibile."
          );
        }

        const row = {
          calibration_record_id: recordId,
          photo_category: category,
          photo_url: data.publicUrl,
          photo_path: filePath,
          file_name: file.name,
          caption: category === "instrument" ? "Foto strumento" : "Fase prova",
          sort_order: reportPhotos.length + insertedRows.length + 1,
        };

        const { data: insertedPhoto, error: insertError } = await supabase
          .from("calibration_report_photos")
          .insert(row)
          .select(
            "id, calibration_record_id, photo_category, photo_url, photo_path, file_name, caption, sort_order, created_at"
          )
          .single();

        if (insertError) {
          throw new Error(
            "Errore salvataggio foto nel rapporto: " + insertError.message
          );
        }

        insertedRows.push(insertedPhoto as ReportPhoto);
      }

      setReportPhotos((currentPhotos) => [
        ...currentPhotos,
        ...insertedRows,
      ]);
      setPendingReportPhotos([]);
      setSaveMessage(
        files.length === 1
          ? "Foto caricata e salvata nel rapporto."
          : "Foto caricate e salvate nel rapporto."
      );
      setSaveError("");

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il caricamento foto.";

      setSaveError(message);
      setReportPhotoLoadError(message);
      setSaveMessage("");
    } finally {
      setUploadingReportPhotos((currentPhotos) =>
        currentPhotos.filter(
          (photo) =>
            !temporaryPhotos.some(
              (temporaryPhoto) => temporaryPhoto.id === photo.id
            )
        )
      );

      temporaryPhotos.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });

      setIsSaving(false);
    }
  }

  function handleAdditionalPhotoFiles(
    files: FileList | null,
    category: ReportPhotoCategory
  ) {
    if (!files || files.length === 0) {
      return;
    }

    void saveReportPhotoFilesImmediately(Array.from(files), category);
  }

  async function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setActiveCameraCategory(null);
    setCameraError("");
  }

  async function startCamera(category: ReportPhotoCategory) {
    setCameraError("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        "Fotocamera non disponibile su questo dispositivo/browser. Usa il caricamento da archivio."
      );
      return;
    }

    setIsCameraStarting(true);
    setActiveCameraCategory(category);

    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'avvio della fotocamera.";

      setCameraError(
        "Impossibile avviare la fotocamera/webcam. Controlla i permessi del browser. Dettaglio: " +
          message
      );
      setActiveCameraCategory(null);
    } finally {
      setIsCameraStarting(false);
    }
  }

  async function captureCameraPhoto() {
    if (!activeCameraCategory || !videoRef.current) {
      return;
    }

    setCameraError("");

    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Impossibile acquisire l'immagine dalla fotocamera.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Impossibile generare il file immagine.");
          return;
        }

        const file = new File(
          [blob],
          "foto_" + activeCameraCategory + "_" + Date.now() + ".jpg",
          { type: "image/jpeg" }
        );

        const capturedCategory = activeCameraCategory;

        void saveReportPhotoFilesImmediately([file], capturedCategory).then(() => {
          void stopCamera();
        });
      },
      "image/jpeg",
      0.9
    );
  }

  function updatePendingPhotoCaption(photoId: string, caption: string) {
    setPendingReportPhotos((currentPhotos) =>
      currentPhotos.map((photo) =>
        photo.id === photoId ? { ...photo, caption } : photo
      )
    );
  }

  function removePendingReportPhoto(photoId: string) {
    setPendingReportPhotos((currentPhotos) =>
      currentPhotos.filter((photo) => photo.id !== photoId)
    );
  }

  async function removeSavedReportPhoto(photoId: string) {
    setSaveMessage("");
    setSaveError("");

    const { error } = await supabase
      .from("calibration_report_photos")
      .delete()
      .eq("id", photoId)
      .eq("calibration_record_id", recordId);

    if (error) {
      setSaveError("Errore eliminazione foto: " + error.message);
      return;
    }

    setReportPhotos((currentPhotos) =>
      currentPhotos.filter((photo) => photo.id !== photoId)
    );
  }

  function toggleTechnicianSelection(
    technicianId: string,
    currentIds: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    setter((current) => {
      if (current.includes(technicianId)) {
        return current.filter((id) => id !== technicianId);
      }

      return [...current, technicianId];
    });

    setSaveMessage("");
    setSaveError("");
  }

  async function uploadPhotoIfNeeded() {
    if (!selectedPhotoFile) {
      return instrumentPhotoUrl || null;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(selectedPhotoFile.type)) {
      throw new Error("Formato foto non valido. Usa JPG, PNG oppure WEBP.");
    }

    const maxSizeBytes = 10 * 1024 * 1024;

    if (selectedPhotoFile.size > maxSizeBytes) {
      throw new Error("La foto è troppo grande. Dimensione massima: 10 MB.");
    }

    const extension = getFileExtension(selectedPhotoFile);
    const filePath = `${recordId}/strumento-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("calibration-photos")
      .upload(filePath, selectedPhotoFile, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Errore caricamento foto: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from("calibration-photos")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error("Foto caricata, ma URL pubblico non disponibile.");
    }

    setInstrumentPhotoUrl(data.publicUrl);
    return data.publicUrl;
  }

  async function uploadAdditionalPhotosIfNeeded() {
    if (pendingReportPhotos.length === 0) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSizeBytes = 10 * 1024 * 1024;

    const rows: Array<{
      calibration_record_id: string;
      photo_category: ReportPhotoCategory;
      photo_url: string;
      photo_path: string;
      file_name: string;
      caption: string | null;
      sort_order: number;
    }> = [];

    for (let index = 0; index < pendingReportPhotos.length; index += 1) {
      const photo = pendingReportPhotos[index];

      if (!allowedTypes.includes(photo.file.type)) {
        throw new Error(
          "Formato foto non valido per " +
            photo.file.name +
            ". Usa JPG, PNG oppure WEBP."
        );
      }

      if (photo.file.size > maxSizeBytes) {
        throw new Error(
          "La foto " +
            photo.file.name +
            " è troppo grande. Dimensione massima: 10 MB."
        );
      }

      const extension = getFileExtension(photo.file);
      const filePath =
        recordId +
        "/" +
        photo.photo_category +
        "-" +
        Date.now() +
        "-" +
        String(index + 1) +
        "." +
        extension;

      const { error: uploadError } = await supabase.storage
        .from("calibration-photos")
        .upload(filePath, photo.file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          "Errore caricamento foto " + photo.file.name + ": " + uploadError.message
        );
      }

      const { data } = supabase.storage
        .from("calibration-photos")
        .getPublicUrl(filePath);

      if (!data.publicUrl) {
        throw new Error(
          "Foto caricata, ma URL pubblico non disponibile: " + photo.file.name
        );
      }

      rows.push({
        calibration_record_id: recordId,
        photo_category: photo.photo_category,
        photo_url: data.publicUrl,
        photo_path: filePath,
        file_name: photo.file.name,
        caption: photo.caption.trim() || null,
        sort_order: reportPhotos.length + index + 1,
      });
    }

    const { data: insertedPhotos, error: insertError } = await supabase
      .from("calibration_report_photos")
      .insert(rows)
      .select(
        "id, calibration_record_id, photo_category, photo_url, photo_path, file_name, caption, sort_order, created_at"
      );

    if (insertError) {
      throw new Error("Errore salvataggio foto rapporto: " + insertError.message);
    }

    setReportPhotos((currentPhotos) => [
      ...currentPhotos,
      ...((insertedPhotos ?? []) as ReportPhoto[]),
    ]);
    setPendingReportPhotos([]);
  }

  function removePhoto() {
    setInstrumentPhotoUrl("");
    setSelectedPhotoFile(null);
    setSelectedPhotoPreview("");
  }

  function buildSignatureRows() {
    const rows: Array<{
      calibration_record_id: string;
      signature_role: string;
      technician_id: string | null;
      display_name: string;
      signature_url_snapshot: string | null;
      sort_order: number;
    }> = [];

    testingTechnicianIds.forEach((technicianId, index) => {
      const technician = technicians.find((item) => item.id === technicianId);

      if (!technician) return;

      rows.push({
        calibration_record_id: recordId,
        signature_role: "testing_technician",
        technician_id: technician.id,
        display_name: technician.full_name,
        signature_url_snapshot: technician.signature_url,
        sort_order: index + 1,
      });
    });

    reviewerTechnicianIds.forEach((technicianId, index) => {
      const technician = technicians.find((item) => item.id === technicianId);

      if (!technician) return;

      rows.push({
        calibration_record_id: recordId,
        signature_role: "reviewer",
        technician_id: technician.id,
        display_name: technician.full_name,
        signature_url_snapshot: technician.signature_url,
        sort_order: index + 1,
      });
    });

    if (directorTechnician) {
      rows.push({
        calibration_record_id: recordId,
        signature_role: "director",
        technician_id: directorTechnician.id,
        display_name: directorTechnician.full_name,
        signature_url_snapshot: directorTechnician.signature_url,
        sort_order: 1,
      });
    }

    return rows;
  }

  async function saveReportDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      if (!customerName.trim()) {
        throw new Error("Inserisci il committente/cliente.");
      }

      if (!workObject.trim()) {
        throw new Error("Inserisci l’oggetto dei lavori.");
      }

      if (testingTechnicianIds.length === 0) {
        throw new Error("Seleziona almeno un tecnico addetto alle prove.");
      }

      if (reviewerTechnicianIds.length === 0) {
        throw new Error("Seleziona almeno un tecnico per redatto/verificato.");
      }

      if (!directorTechnicianId) {
        throw new Error(
          "Imposta il Direttore di laboratorio nella pagina Tecnici e firme."
        );
      }

      const finalPhotoUrl = instrumentPhotoUrl || null;
      await uploadAdditionalPhotosIfNeeded();

      const technicianName = joinTechnicianNames(
        technicians,
        testingTechnicianIds
      );
      const reviewerName = joinTechnicianNames(technicians, reviewerTechnicianIds);
      const directorName = directorTechnician?.full_name ?? "";

      const payload = {
        calibration_record_id: recordId,

        main_report_number: mainReportNumber.trim() || null,
        technical_annex_number: technicalAnnexNumber.trim() || null,
        acceptance_number: acceptanceNumber.trim() || null,
        acceptance_date: acceptanceDate || null,
        report_date: reportDate || null,
        test_date: testDate || null,

        customer_name: customerName.trim() || null,
        site_description: siteDescription.trim() || null,
        work_object: "Verifica di taratura",
        requested_tests: requestedTests.trim() || null,

        premise_text: premiseText.trim() || null,
        scope_text: scopeText.trim() || null,
        apparatus_description: apparatusDescription.trim() || null,
        execution_method: executionMethod.trim() || null,
        results_text: resultsText.trim() || null,

        temperature: temperature.trim() || null,
        humidity: humidity.trim() || null,

        technician_name: technicianName || null,
        reviewer_name: reviewerName || null,
        director_name: directorName || null,

        instrument_photo_url: finalPhotoUrl,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("calibration_report_details")
        .upsert(payload, {
          onConflict: "calibration_record_id",
        });

      if (error) {
        throw new Error(error.message);
      }

      const { error: deleteSignaturesError } = await supabase
        .from("calibration_report_signatures")
        .delete()
        .eq("calibration_record_id", recordId);

      if (deleteSignaturesError) {
        throw new Error(deleteSignaturesError.message);
      }

      const signatureRows = buildSignatureRows();

      if (signatureRows.length > 0) {
        const { error: insertSignaturesError } = await supabase
          .from("calibration_report_signatures")
          .insert(signatureRows);

        if (insertSignaturesError) {
          throw new Error(insertSignaturesError.message);
        }
      }

      setSaveMessage("Dati rapporto e firme salvati correttamente.");
      await loadTechnicalCompletenessData();
      router.refresh();
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
    <form onSubmit={saveReportDetails} className="space-y-6">
      {isReadOnly && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-bold">Rapporto emesso: dati in sola lettura</p>
              <p className="mt-1 text-emerald-900">
                Per evitare modifiche accidentali dopo l’emissione, i campi sono bloccati. Stato attuale: {currentReportStatus}. Se serve correggere qualcosa, riapri il rapporto dalla pagina di anteprima finale.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/verifiche/${recordId}/rapporto/finale`)}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Vai al rapporto
            </button>
          </div>
        </section>
      )}

      <fieldset disabled={isReadOnly} className="space-y-6 disabled:opacity-70">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Numerazione e date
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Numero rapporto
            </span>
            <input
              value={mainReportNumber}
              onChange={(event) => setMainReportNumber(event.target.value)}
              placeholder="Lascia vuoto finché non viene comunicato"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="block text-xs text-slate-500">
              Non viene più compilato in automatico: lo inserisce il tecnico quando l’ufficio lo comunica.
            </span>
          </label>

          <input
            type="hidden"
            value={technicalAnnexNumber}
            onChange={(event) => setTechnicalAnnexNumber(event.target.value)}
          />

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Accettazione interna
            </span>
            <input
              value={acceptanceNumber}
              onChange={(event) => setAcceptanceNumber(event.target.value)}
              placeholder="Es. 649-E/26"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Data accettazione
            </span>
            <input
              type="date"
              value={acceptanceDate}
              onChange={(event) => setAcceptanceDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Data rapporto
            </span>
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Data delle prove
            </span>
            <input
              type="date"
              value={testDate}
              onChange={(event) => handleTestDateChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati iniziali del rapporto
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Committente *
            </span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Es. F.LLI VERSARI S.n.c."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Luogo prove
            </span>
            <input
              value={siteDescription}
              onChange={(event) => setSiteDescription(event.target.value)}
              placeholder="Es. Via Monda, 46A - Forlì (FC)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Temperatura ambientale (°C)
            </span>
            <input
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
              inputMode="decimal"
              placeholder="Es. 20,5"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Umidità ambientale (%)
            </span>
            <input
              value={humidity}
              onChange={(event) => setHumidity(event.target.value)}
              inputMode="decimal"
              placeholder="Es. 55"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Oggetto dei lavori *
            </span>
            <input
              value={workObject}
              onChange={(event) => setWorkObject(event.target.value)}
              placeholder="Verifica di taratura"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Prove richieste
            </span>
            <input
              value={requestedTests}
              onChange={(event) => setRequestedTests(event.target.value)}
              placeholder="Verifica di taratura dello strumento"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Foto strumento e fasi prova
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Puoi acquisire foto dello strumento e delle fasi prova da smartphone,
          tablet o webcam collegata al laptop, oppure caricare immagini salvate.
          Le foto vengono salvate subito nel rapporto.
        </p>

        {reportPhotoLoadError && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
            {reportPhotoLoadError}
          </div>
        )}

        {saveMessage && saveMessage.toLowerCase().includes("foto") && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            {saveMessage}
          </div>
        )}

        {saveError && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
            {saveError}
          </div>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Foto strumento</h3>
            <p className="mt-1 text-xs text-slate-500">
              Per foto aggiuntive dello strumento, targhette, dettagli, accessori
              o condizioni prima/dopo la prova.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Acquisisci in diretta
                </span>
                <button
                  type="button"
                  onClick={() => startCamera("instrument")}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Apri fotocamera / webcam
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Carica da archivio
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  multiple
                  onChange={(event) => {
                    handleAdditionalPhotoFiles(
                      event.target.files,
                      "instrument"
                    );
                    event.target.value = "";
                  }}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Foto fasi prova</h3>
            <p className="mt-1 text-xs text-slate-500">
              Per documentare allestimento, collegamenti, fasi operative,
              letture, posizionamenti o eventuali particolari utili.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Acquisisci in diretta
                </span>
                <button
                  type="button"
                  onClick={() => startCamera("test_phase")}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Apri fotocamera / webcam
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Carica da archivio
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  multiple
                  onChange={(event) => {
                    handleAdditionalPhotoFiles(
                      event.target.files,
                      "test_phase"
                    );
                    event.target.value = "";
                  }}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        </div>

        {activeCameraCategory && (
          <div className="mt-5 rounded-2xl border border-slate-300 bg-slate-950 p-4 text-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h3 className="font-semibold">
                  Acquisizione in diretta -{" "}
                  {activeCameraCategory === "instrument"
                    ? "Foto strumento"
                    : "Foto fasi prova"}
                </h3>
                <p className="text-xs text-slate-300">
                  Consenti l'accesso alla fotocamera/webcam dal browser, poi
                  premi “Scatta foto”.
                </p>
              </div>

              <button
                type="button"
                onClick={() => stopCamera()}
                className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Chiudi fotocamera
              </button>
            </div>

            {cameraError && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                {cameraError}
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/20 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="max-h-[520px] w-full bg-black object-contain"
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => startCamera(activeCameraCategory)}
                disabled={isCameraStarting}
                className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              >
                {isCameraStarting ? "Avvio..." : "Riavvia fotocamera"}
              </button>

              <button
                type="button"
                onClick={captureCameraPhoto}
                disabled={isCameraStarting}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                Scatta foto
              </button>
            </div>
          </div>
        )}

        {(reportPhotos.length > 0 ||
          uploadingReportPhotos.length > 0 ||
          pendingReportPhotos.length > 0) && (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {uploadingReportPhotos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50"
              >
                <img
                  src={photo.previewUrl}
                  alt={photo.caption}
                  className="h-48 w-full bg-white object-contain"
                />
                <div className="space-y-2 p-3 text-sm">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    Caricamento... {photo.photo_category === "instrument"
                      ? "Strumento"
                      : "Fase prova"}
                  </span>
                  <p className="text-blue-900">
                    Salvataggio della foto in corso...
                  </p>
                </div>
              </div>
            ))}

            {reportPhotos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
              >
                <img
                  src={photo.photo_url}
                  alt={photo.caption || "Foto rapporto"}
                  className="h-48 w-full bg-white object-contain"
                />
                <div className="space-y-2 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      {photo.photo_category === "instrument"
                        ? "Strumento"
                        : "Fase prova"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSavedReportPhoto(photo.id)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Elimina
                    </button>
                  </div>
                  <p className="text-slate-700">{photo.caption || "-"}</p>
                </div>
              </div>
            ))}

            {pendingReportPhotos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50"
              >
                <img
                  src={photo.previewUrl}
                  alt={photo.caption}
                  className="h-48 w-full bg-white object-contain"
                />
                <div className="space-y-3 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                      Da salvare - {photo.photo_category === "instrument"
                        ? "Strumento"
                        : "Fase prova"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingReportPhoto(photo.id)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Rimuovi
                    </button>
                  </div>
                  <input
                    value={photo.caption}
                    onChange={(event) =>
                      updatePendingPhotoCaption(photo.id, event.target.value)
                    }
                    placeholder="Didascalia foto"
                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingReportPhotos.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Le foto vengono caricate e salvate subito nel rapporto.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Firme e note
        </h2>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Le condizioni ambientali vengono inserite in fase di nuova verifica e
          riportate automaticamente nel rapporto. In questa pagina non vengono
          richieste una seconda volta.
        </div>

        {signatureLoadError && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Errore caricamento tecnici/firme: {signatureLoadError}
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">
              Tecnico/i addetto/i alle prove *
            </h3>

            <div className="mt-3 space-y-2">
              {isLoadingSignatures ? (
                <p className="text-sm text-slate-500">Caricamento tecnici...</p>
              ) : technicians.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nessun tecnico attivo. Inseriscili in “Tecnici e firme”.
                </p>
              ) : (
                technicians.map((technician) => (
                  <label
                    key={technician.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={testingTechnicianIds.includes(technician.id)}
                      onChange={() =>
                        toggleTechnicianSelection(
                          technician.id,
                          testingTechnicianIds,
                          setTestingTechnicianIds
                        )
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="font-medium text-slate-900">
                        {technician.full_name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {technician.signature_url
                          ? "Firma presente"
                          : "Firma mancante"}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">
              Redatto / verificato *
            </h3>

            <div className="mt-3 space-y-2">
              {isLoadingSignatures ? (
                <p className="text-sm text-slate-500">Caricamento tecnici...</p>
              ) : technicians.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nessun tecnico attivo. Inseriscili in “Tecnici e firme”.
                </p>
              ) : (
                technicians.map((technician) => (
                  <label
                    key={technician.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={reviewerTechnicianIds.includes(technician.id)}
                      onChange={() =>
                        toggleTechnicianSelection(
                          technician.id,
                          reviewerTechnicianIds,
                          setReviewerTechnicianIds
                        )
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="font-medium text-slate-900">
                        {technician.full_name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {technician.signature_url
                          ? "Firma presente"
                          : "Firma mancante"}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">
              Direttore di laboratorio
            </h3>

            {directorTechnician ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {directorTechnician.full_name}
                </p>

                <p className="text-sm text-slate-500">
                  {directorTechnician.role ?? "Direttore di laboratorio"}
                </p>

                <div className="mt-3 flex h-20 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                  {directorTechnician.signature_url ? (
                    <img
                      src={directorTechnician.signature_url}
                      alt={`Firma ${directorTechnician.full_name}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-slate-400">
                      Firma mancante
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Nessun direttore predefinito impostato. Vai in “Tecnici e
                firme” e scegli il Direttore di laboratorio.
              </div>
            )}
          </div>
        </div>

        <label className="mt-5 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note interne</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-semibold text-slate-900">
          Modifica avanzata testi tecnici del rapporto
        </summary>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            I testi standard vengono presi da <strong>lib/report-defaults.ts</strong>.
            I campi qui sotto possono essere modificati per la singola verifica.
          </p>
          <p className="mt-1">
            Usa il pulsante solo se vuoi sostituire i testi attuali con quelli
            preimpostati del modulo.
          </p>

          <button
            type="button"
            onClick={regenerateDefaultTexts}
            className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Rigenera testi preimpostati
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              1. Premessa
            </span>
            <textarea
              value={premiseText}
              onChange={(event) => setPremiseText(event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              2. Scopo della prova
            </span>
            <textarea
              value={scopeText}
              onChange={(event) => setScopeText(event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              3. Descrizione apparato di verifica
            </span>
            <textarea
              value={apparatusDescription}
              onChange={(event) => setApparatusDescription(event.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              4. Descrizione e modalità di esecuzione
            </span>
            <textarea
              value={executionMethod}
              onChange={(event) => setExecutionMethod(event.target.value)}
              rows={7}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              6. Risultati della verifica
            </span>
            <textarea
              value={resultsText}
              onChange={(event) => setResultsText(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </details>

      <section
        className={
          "rounded-2xl border p-3 shadow-sm md:p-4 " +
          (isReportComplete
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50")
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Controllo completezza rapporto
            </h2>
            <p className="text-xs text-slate-600 md:text-sm">
              Riepilogo rapido prima dell’anteprima e della stampa PDF.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (isReportComplete
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900")
              }
            >
              {isReportComplete
                ? "Completo"
                : String(missingCompletenessItems.length) + " da controllare"}
            </span>

            {technicalCompleteness.error && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                Errore sezione tecnica
              </span>
            )}
          </div>
        </div>

        {technicalCompleteness.error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {technicalCompleteness.error}
          </p>
        )}

        {isReportComplete ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm font-medium text-emerald-900">
            Tutti i controlli principali risultano completi.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {missingCompletenessItems.map((item) => (
                <span
                  key={item.label}
                  className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-900"
                >
                  ⚠️ {item.label}
                </span>
              ))}
            </div>

            <details className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-900">
              <summary className="cursor-pointer font-semibold">
                Dettaglio elementi mancanti
              </summary>

              <ul className="mt-2 space-y-1 text-xs">
                {missingCompletenessItems.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}:</strong> {item.warning}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </section>

      </fieldset>

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

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/verifiche")}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Torna alle verifiche
        </button>

        <button
          type="submit"
          disabled={isSaving || isReadOnly}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isReadOnly ? "Rapporto in sola lettura" : isSaving ? "Salvataggio..." : "Salva dati rapporto"}
        </button>
      </div>
    </form>
  );
}