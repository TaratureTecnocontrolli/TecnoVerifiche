"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

function buildAutoPremise(params: {
  testDate: string;
  customerName: string;
  siteDescription: string;
  instrumentName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  range: string;
  verificationModule?: string;
}) {
  const italianTestDate = formatItalianDateFromInput(params.testDate);
  const customerName = params.customerName || "committente indicato nel rapporto";
  const siteDescription =
    params.siteDescription || "sede indicata nel rapporto";
  const instrumentLabel =
    [
      params.instrumentName,
      params.manufacturer,
      params.model,
    ]
      .filter(Boolean)
      .join(" ") || "strumento verificato";

  if (params.verificationModule === "PRESSURE") {
    return `Il giorno ${italianTestDate}, presso ${siteDescription}, è stato sottoposto a verifica di taratura lo strumento di misura della pressione ${instrumentLabel} (s/n ${params.serialNumber || "non indicato"}), per conto di ${customerName}. La strumentazione interessata dalla verifica presenta campo/fondo scala ${params.range || "non indicato"}.`;
  }

  if (params.verificationModule === "TORQUE") {
    return `Il giorno ${italianTestDate}, presso ${siteDescription}, è stato sottoposto a verifica di taratura lo strumento di coppia ${instrumentLabel} (s/n ${params.serialNumber || "non indicato"}), per conto di ${customerName}. La strumentazione interessata dalla verifica presenta campo ${params.range || "non indicato"}.`;
  }

  if (params.verificationModule === "FLOW") {
    return `Il giorno ${italianTestDate}, presso ${siteDescription}, è stato sottoposto a verifica di taratura lo strumento di portata / contalitri ${instrumentLabel} (s/n ${params.serialNumber || "non indicato"}), per conto di ${customerName}. La strumentazione interessata dalla verifica presenta campo ${params.range || "non indicato"}.`;
  }

  if (params.verificationModule === "SCLEROMETRIC") {
    return `Il giorno ${italianTestDate}, presso ${siteDescription}, è stato sottoposto a verifica di taratura lo sclerometro ${instrumentLabel} (s/n ${params.serialNumber || "non indicato"}), per conto di ${customerName}.`;
  }

  if (params.verificationModule === "MASS") {
    return `Il giorno ${italianTestDate}, presso ${siteDescription}, è stata sottoposta a verifica di taratura la bilancia ${instrumentLabel} (s/n ${params.serialNumber || "non indicato"}), per conto di ${customerName}. La strumentazione interessata dalla verifica presenta portata ${params.range || "non indicata"}.`;
  }

  if (params.verificationModule === "DIMENSIONAL") {
    return `Il giorno ${italianTestDate}, presso ${siteDescription}, è stato sottoposto a verifica di taratura lo strumento dimensionale ${instrumentLabel} (s/n ${params.serialNumber || "non indicato"}), per conto di ${customerName}. La strumentazione interessata dalla verifica presenta campo ${params.range || "non indicato"}.`;
  }

  return `Il giorno ${italianTestDate} tecnici di questo Laboratorio tecnologico hanno sottoposto, per conto di ${customerName} presso la sede di ${siteDescription}, una ${instrumentLabel} (s/n ${params.serialNumber}) a verifica di taratura. La macchina ha un Fondo Scala di ${params.range}.`;
}

function defaultRequestedTests(verificationModule?: string) {
  if (verificationModule === "PRESSURE") {
    return "Verifica taratura dello strumento di misura della pressione mediante confronto con strumento campione.";
  }

  if (verificationModule === "TORQUE") {
    return "Verifica taratura di chiave dinamometrica / strumento di coppia mediante confronto con strumento campione.";
  }

  if (verificationModule === "FLOW") {
    return "Verifica taratura di contalitri / strumento di misura volume-portata mediante confronto con strumento campione.";
  }

  if (verificationModule === "SCLEROMETRIC") {
    return "Verifica taratura di sclerometro / strumento di prova non distruttiva a rimbalzo mediante confronto con incudine di riferimento.";
  }

  if (verificationModule === "MASS") {
    return "Verifica taratura di bilancia / strumento di misura della massa mediante prove di ripetibilità, eccentricità e linearità con masse campione.";
  }

  if (verificationModule === "DIMENSIONAL") {
    return "Verifica taratura di calibro / strumento dimensionale mediante confronto con campioni di riferimento.";
  }

  return "";
}

function defaultScopeText(verificationModule?: string) {
  if (verificationModule === "PRESSURE") {
    return "La prova ha come scopo la verifica dello strumento di misura della pressione sui punti previsti della propria portata, con particolare riferimento ai quattro quinti superiori della portata massima quando applicabile. Tale verifica rappresenta il procedimento di controllo per determinare gli errori dello strumento. Gli errori presi in considerazione sono: a) errore di ripetibilità; b) errore di accuratezza.";
  }

  if (verificationModule === "TORQUE") {
    return "La prova ha come scopo la verifica dello strumento di coppia sui punti di coppia previsti, rilevando tre letture per ciascun punto e calcolando media, errore medio, errore di accuratezza percentuale e ripetibilità.";
  }

  if (verificationModule === "FLOW") {
    return "La prova ha come scopo la verifica del contalitri / strumento di misura volume-portata confrontando il volume impostato sullo strumento in verifica con le letture rilevate sullo strumento campione, su tre cicli di misura.";
  }

  if (verificationModule === "SCLEROMETRIC") {
    return "La prova ha come scopo la verifica dello sclerometro mediante battute ripetute su un'incudine di riferimento a valore nominale fisso, rilevando tre letture per battuta e calcolando media, errore medio ed errore percentuale.";
  }

  if (verificationModule === "MASS") {
    return "La prova ha come scopo la verifica della bilancia tramite tre prove distinte: ripetibilità su un unico punto, eccentricità su più zone del piatto di pesata e linearità su più punti dell'intero campo di pesata, rilevando tre letture per ciascun punto.";
  }

  if (verificationModule === "DIMENSIONAL") {
    return "La prova ha come scopo la verifica dello strumento dimensionale sui punti previsti, rilevando tre scostamenti per ciascun punto e calcolando media, errore medio, errore di accuratezza percentuale, ripetibilità e incertezza strumentale.";
  }

  return "";
}

function defaultApparatusDescription(verificationModule?: string) {
  if (verificationModule === "PRESSURE") {
    return "L’apparato utilizzato per la verifica è costituito dal sistema di generazione/applicazione della pressione e dallo strumento campione indicato nella sezione tecnica del presente rapporto. Lo strumento campione risulta identificato con i relativi dati di matricola, codice interno, campo di misura e certificato di taratura in corso di validità alla data della prova.";
  }

  if (verificationModule === "TORQUE") {
    return "L’apparato utilizzato per la verifica è costituito dallo strumento campione indicato nella sezione tecnica del presente rapporto e dagli eventuali accessori necessari all’applicazione controllata della coppia. Lo strumento campione risulta identificato con i relativi dati di matricola, codice interno, campo di misura e certificato di taratura in corso di validità alla data della prova.";
  }

  if (verificationModule === "FLOW") {
    return "L’apparato utilizzato per la verifica è costituito dallo strumento campione indicato nella sezione tecnica del presente rapporto, con confronto dei risultati su tre cicli di misura. Lo strumento campione risulta identificato con i relativi dati di matricola, codice interno, campo di misura e certificato di taratura in corso di validità alla data della prova.";
  }

  if (verificationModule === "SCLEROMETRIC") {
    return "L’apparato utilizzato per la verifica è costituito dall'incudine di riferimento indicata nella sezione tecnica del presente rapporto, a valore nominale certificato. L'incudine risulta identificata con i relativi dati di matricola, codice interno e certificato di taratura in corso di validità alla data della prova.";
  }

  if (verificationModule === "MASS") {
    return "L’apparato utilizzato per la verifica è costituito dalle masse campione indicate nella sezione tecnica del presente rapporto. Le masse campione risultano identificate con i relativi dati di matricola, codice interno e certificato di taratura in corso di validità alla data della prova.";
  }

  if (verificationModule === "DIMENSIONAL") {
    return "L’apparato utilizzato per la verifica è costituito dai campioni di riferimento indicati nella sezione tecnica del presente rapporto. I campioni di riferimento risultano identificati con i relativi dati di matricola, codice interno e certificato di taratura in corso di validità alla data della prova.";
  }

  return "";
}

function defaultExecutionMethod(verificationModule?: string) {
  if (verificationModule === "PRESSURE") {
    return "La verifica di taratura è stata eseguita installando lo strumento da verificare sull’apparato di generazione della pressione, in collegamento/confronto con lo strumento campione. Prima dell’inizio della verifica il sistema può essere portato al valore massimo previsto per stabilizzare il circuito e verificare il corretto funzionamento dell’insieme di prova. La verifica è stata effettuata sui punti prefissati, regolarmente distribuiti sul campo di misura, sia in fase di carico fino al raggiungimento del valore massimo previsto sia in fase di scarico sugli stessi punti a scendere. Per ciascun punto sono state registrate tre letture/cicli. Per ogni punto sono stati calcolati lettura massima, lettura minima, media delle letture, errore medio, errore di accuratezza percentuale ed errore di ripetibilità percentuale. Temperatura e umidità ambientali sono riportate nel presente rapporto.";
  }

  if (verificationModule === "TORQUE") {
    return "La verifica di taratura è stata eseguita applicando i punti di coppia previsti e rilevando, per ciascun punto, tre letture consecutive dello strumento in prova. Per ogni punto sono stati determinati il valore massimo, il valore minimo, la media delle letture, l’errore medio, l’errore di accuratezza percentuale e l’errore di ripetibilità percentuale.";
  }

  if (verificationModule === "FLOW") {
    return "La verifica di taratura è stata eseguita impostando sullo strumento in prova i volumi nominali previsti e rilevando tre letture per ciascun punto. Per ciascun punto sono stati determinati media delle letture, errore ed errore percentuale, calcolati come Errore = Media letture - Volume impostato ed Errore % = Errore / Volume impostato x 100.";
  }

  if (verificationModule === "SCLEROMETRIC") {
    return "La verifica di taratura è stata eseguita effettuando un numero prestabilito di battute sull'incudine di riferimento a valore nominale fisso e rilevando, per ciascuna battuta, tre letture consecutive dello strumento in prova. Per ciascuna battuta sono stati determinati media delle letture, errore medio ed errore percentuale, calcolati come Errore medio = Media letture - Valore nominale incudine ed Errore % = Errore medio / Valore nominale incudine x 100.";
  }

  if (verificationModule === "MASS") {
    return "La verifica di taratura è stata eseguita mediante tre prove distinte. Ripetibilità: tre letture su un unico punto di carico. Eccentricità: tre letture su cinque zone del piatto di pesata (centro e periferia). Linearità: tre letture su più punti distribuiti sull'intero campo di pesata. Per ciascun punto sono stati determinati media delle letture, errore ed errore di ripetibilità percentuale; per la sola prova di linearità è calcolato anche l'errore percentuale rispetto al peso campione.";
  }

  if (verificationModule === "DIMENSIONAL") {
    return "La verifica di taratura è stata eseguita confrontando lo strumento in prova con i campioni di riferimento sui punti previsti, rilevando tre scostamenti consecutivi per ciascun punto. Per ogni punto sono stati determinati il valore massimo, il valore minimo, la media degli scostamenti, l'errore medio, l'errore di accuratezza percentuale, l'errore di ripetibilità percentuale e l'incertezza strumentale.";
  }

  return "";
}

function defaultResultsText(verificationModule?: string) {
  if (verificationModule === "PRESSURE") {
    return "I risultati della verifica sono riportati nella sezione tecnica del presente rapporto. Le tabelle riportano, separatamente per la prova in carico e per la prova in scarico, i punti di verifica, il carico applicato, le letture dei tre cicli, la lettura massima, la lettura minima, la media delle letture, l’errore medio, l’errore di accuratezza e l’errore di ripetibilità. I grafici riportano l’andamento dell’errore di accuratezza per le due fasi di prova.";
  }

  if (verificationModule === "TORQUE") {
    return "I risultati della verifica sono riportati nella sezione tecnica del presente rapporto. Per ciascun punto di coppia sono indicati il valore applicato, le tre letture rilevate, la media, l’errore medio, l’errore di accuratezza percentuale e l’errore di ripetibilità percentuale.";
  }

  if (verificationModule === "FLOW") {
    return "I risultati della verifica sono riportati nella sezione tecnica del presente rapporto. Per ciascun punto sono indicati volume nominale, volume impostato nello strumento in verifica, tre letture, media letture, errore ed errore percentuale.";
  }

  if (verificationModule === "SCLEROMETRIC") {
    return "I risultati della verifica sono riportati nella sezione tecnica del presente rapporto. Per ciascuna battuta sono indicati il valore nominale dell'incudine di riferimento, le tre letture rilevate, la media, l'errore medio e l'errore percentuale.";
  }

  if (verificationModule === "MASS") {
    return "I risultati della verifica sono riportati nella sezione tecnica del presente rapporto, distinti per prova di ripetibilità, eccentricità e linearità. Per ciascun punto sono indicati il peso nominale, il peso campione, le tre letture rilevate, la media, l'errore e la ripetibilità percentuale (l'errore percentuale rispetto al peso campione è indicato solo per la prova di linearità).";
  }

  if (verificationModule === "DIMENSIONAL") {
    return "I risultati della verifica sono riportati nella sezione tecnica del presente rapporto. Per ciascun punto sono indicati il valore nominale, i tre scostamenti rilevati, la media, l'errore medio, l'errore di accuratezza percentuale, l'errore di ripetibilità percentuale e l'incertezza strumentale.";
  }

  return "";
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
  const [workObject, setWorkObject] = useState(
    valueOrEmpty(safeInitialData.work_object) ||
      (autoPremiseData?.verificationModule === "PRESSURE"
        ? "Verifica strumento di misura della pressione"
        : autoPremiseData?.verificationModule === "TORQUE"
          ? "Verifica strumento di coppia / chiave dinamometrica"
          : autoPremiseData?.verificationModule === "FLOW"
            ? "Verifica strumento di portata / contalitri"
            : autoPremiseData?.verificationModule === "SCLEROMETRIC"
              ? "Verifica sclerometro"
              : autoPremiseData?.verificationModule === "MASS"
                ? "Verifica bilancia / strumento di misura della massa"
                : autoPremiseData?.verificationModule === "DIMENSIONAL"
                  ? "Verifica strumento dimensionale"
                  : "")
  );
  const [requestedTests, setRequestedTests] = useState(
    valueOrEmpty(safeInitialData.requested_tests) ||
      defaultRequestedTests(autoPremiseData?.verificationModule)
  );

  const initialPremiseText =
    valueOrEmpty(safeInitialData.premise_text) ||
    buildAutoPremise({
      testDate:
        valueOrEmpty(safeInitialData.test_date) ||
        autoPremiseData?.verificationDate ||
        "",
      customerName:
        valueOrEmpty(safeInitialData.customer_name) ||
        autoPremiseData?.customerName ||
        "",
      siteDescription:
        valueOrEmpty(safeInitialData.site_description) ||
        autoPremiseData?.siteDescription ||
        "",
      instrumentName: autoPremiseData?.instrumentName ?? "",
      manufacturer: autoPremiseData?.manufacturer ?? "",
      model: autoPremiseData?.model ?? "",
      serialNumber: autoPremiseData?.serialNumber ?? "",
      range: autoPremiseData?.range ?? "",
      verificationModule: autoPremiseData?.verificationModule,
    });

  const [premiseText, setPremiseText] = useState(initialPremiseText);
  const [scopeText, setScopeText] = useState(
    valueOrEmpty(safeInitialData.scope_text) ||
      defaultScopeText(autoPremiseData?.verificationModule)
  );
  const [apparatusDescription, setApparatusDescription] = useState(
    valueOrEmpty(safeInitialData.apparatus_description) ||
      defaultApparatusDescription(autoPremiseData?.verificationModule)
  );
  const [executionMethod, setExecutionMethod] = useState(
    valueOrEmpty(safeInitialData.execution_method) ||
      defaultExecutionMethod(autoPremiseData?.verificationModule)
  );
  const [resultsText, setResultsText] = useState(
    valueOrEmpty(safeInitialData.results_text) ||
      defaultResultsText(autoPremiseData?.verificationModule)
  );

  useEffect(() => {
    if (valueOrEmpty(safeInitialData.premise_text)) {
      return;
    }

    setPremiseText(
      buildAutoPremise({
        testDate,
        customerName: customerName || autoPremiseData?.customerName || "",
        siteDescription:
          siteDescription || autoPremiseData?.siteDescription || "",
        instrumentName: autoPremiseData?.instrumentName ?? "",
        manufacturer: autoPremiseData?.manufacturer ?? "",
        model: autoPremiseData?.model ?? "",
        serialNumber: autoPremiseData?.serialNumber ?? "",
        range: autoPremiseData?.range ?? "",
        verificationModule: autoPremiseData?.verificationModule,
      })
    );
  }, [
    autoPremiseData?.customerName,
    autoPremiseData?.instrumentName,
    autoPremiseData?.manufacturer,
    autoPremiseData?.model,
    autoPremiseData?.range,
    autoPremiseData?.serialNumber,
    autoPremiseData?.siteDescription,
    autoPremiseData?.verificationModule,
    autoPremiseData?.verificationDate,
    customerName,
    safeInitialData.premise_text,
    siteDescription,
    testDate,
  ]);

  const [temperature, setTemperature] = useState(
    valueOrEmpty(safeInitialData.temperature)
  );
  const [humidity, setHumidity] = useState(
    valueOrEmpty(safeInitialData.humidity)
  );

  const [instrumentPhotoUrl, setInstrumentPhotoUrl] = useState(
    valueOrEmpty(safeInitialData.instrument_photo_url)
  );
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState("");

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
        label: "Temperatura ambientale",
        isComplete: temperature.trim().length > 0,
        warning: "Temperatura mancante",
      },
      {
        label: "Umidità ambientale",
        isComplete: humidity.trim().length > 0,
        warning: "Umidità mancante",
      },
      {
        label: "Foto strumento",
        isComplete: Boolean(selectedPhotoPreview || instrumentPhotoUrl),
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
    temperature,
    humidity,
    selectedPhotoPreview,
    instrumentPhotoUrl,
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

    const updatedPremise = buildAutoPremise({
      testDate: nextDate,
      customerName: customerName || autoPremiseData?.customerName || "",
      siteDescription: siteDescription || autoPremiseData?.siteDescription || "",
      instrumentName: autoPremiseData?.instrumentName ?? "strumento",
      manufacturer: autoPremiseData?.manufacturer ?? "",
      model: autoPremiseData?.model ?? "",
      serialNumber: autoPremiseData?.serialNumber ?? "",
      range: autoPremiseData?.range ?? "",
      verificationModule: autoPremiseData?.verificationModule,
    });

    setPremiseText(updatedPremise);
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

      const finalPhotoUrl = await uploadPhotoIfNeeded();

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
        work_object: workObject.trim() || null,
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
      setSelectedPhotoFile(null);
      setSelectedPhotoPreview("");
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
              Cantiere / sede prova
            </span>
            <input
              value={siteDescription}
              onChange={(event) => setSiteDescription(event.target.value)}
              placeholder="Es. Via Monda, 46A - Forlì (FC)"
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
              placeholder="Es. Verifica taratura di PRESSA CONTROLS C44L2"
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
              placeholder="Es. Verifica taratura PRESSA CONTROLS C44L2"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Foto strumento
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Da telefono o tablet puoi scattare direttamente la foto dello
          strumento. Da PC puoi caricare una foto già salvata.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-[320px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {selectedPhotoPreview || instrumentPhotoUrl ? (
              <img
                src={selectedPhotoPreview || instrumentPhotoUrl}
                alt="Foto strumento"
                className="h-[240px] w-full bg-white object-contain"
              />
            ) : (
              <div className="flex h-[240px] items-center justify-center text-center text-sm text-slate-500">
                Nessuna foto caricata
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Scatta o carica foto
              </span>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                capture="environment"
                onChange={(event) =>
                  handlePhotoChange(event.target.files?.[0] ?? null)
                }
                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              La foto viene caricata solo quando premi{" "}
              <strong>Salva dati rapporto</strong>.
            </div>

            {(selectedPhotoPreview || instrumentPhotoUrl) && (
              <button
                type="button"
                onClick={removePhoto}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Rimuovi foto
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Ambiente e firme
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Temperatura ambientale °C
            </span>
            <input
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
              placeholder="Es. 21"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Umidità ambientale %
            </span>
            <input
              value={humidity}
              onChange={(event) => setHumidity(event.target.value)}
              placeholder="Es. 50"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
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

        <p className="mt-2 text-sm text-slate-500">
          Questi testi sono preimpostati dal sistema. Modificarli solo se serve
          davvero, perché finiscono nel rapporto finale.
        </p>

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