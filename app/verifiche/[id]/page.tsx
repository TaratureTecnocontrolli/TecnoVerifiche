import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import CalibrationReportDetailsForm from "@/components/CalibrationReportDetailsForm";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  mode: string | null;
  verification_date: string;
  customer_instrument_id: string | null;
  reference_instrument_id: string | null;
  customer_instrument_snapshot: Record<string, unknown> | null;
  reference_instrument_snapshot: Record<string, unknown> | null;
  procedure_snapshot: Record<string, unknown> | null;
};

type CustomerInstrument = {
  id: string;
  customer_name: string | null;
  site: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  measurement_range: string | null;
};

type ReportDetails = {
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatItalianDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function getSnapshotText(
  snapshot: Record<string, unknown> | null,
  key: string
): string | null {
  const value = snapshot?.[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function buildMainReportNumber(recordNumber: string | null) {
  if (!recordNumber) {
    return "";
  }

  return recordNumber.replace(".1-", "-").replace(".1.", ".");
}

function buildTechnicalAnnexNumber(recordNumber: string | null) {
  if (!recordNumber) {
    return "";
  }

  if (recordNumber.includes(".1")) {
    return recordNumber;
  }

  return `${recordNumber}.1`;
}

function buildDefaultPremise(params: {
  testDate: string;
  customerName: string;
  siteDescription: string;
  instrumentName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  range: string;
}) {
  const italianTestDate = formatItalianDate(params.testDate);

  return `Il giorno ${italianTestDate} tecnici di questo Laboratorio tecnologico hanno sottoposto, per conto di ${params.customerName} presso la sede di ${params.siteDescription}, una ${params.instrumentName} ${params.manufacturer} ${params.model} (s/n ${params.serialNumber}) a verifica di taratura. La macchina ha un Fondo Scala di ${params.range}.`;
}

function defaultScopeText() {
  return `La prova ha come scopo la verifica della macchina sui ⅘ superiori della sua portata massima. Tale verifica è il procedimento di controllo per determinare gli errori della macchina.

Gli errori si distinguono in:
a) errore di ripetibilità;
b) errore di accuratezza.`;
}

function defaultResultsText(annexNumber: string) {
  return `I risultati della verifica di taratura sono riportati nel RdP ${annexNumber} che è parte integrante del presente Rapporto di Prova.`;
}

function defaultApparatusDescription() {
  return `L’apparato utilizzato è costituito da:
• Cella di carico con taratura riferibile;
• Indicatore digitale;
• Software applicativo per l’esecuzione delle verifiche di taratura di macchine prova materiali;
• Termo-igrometro per il rilievo delle condizioni ambientali.`;
}

function defaultExecutionMethod(params: {
  instrumentName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  range: string;
}) {
  return `La verifica di taratura della ${params.instrumentName} ${params.manufacturer} ${params.model} (s/n ${params.serialNumber}) è stata eseguita disponendo la cella di carico tra le piastre della macchina. Prima dell’inizio della verifica il sistema è stato portato al suo carico massimo di ${params.range} per due volte a temperatura ambiente. La verifica è stata effettuata sui ⅘ superiori della portata massima della macchina e su punti regolarmente spaziati. È stata effettuata una serie da tre cicli. La temperatura e l’umidità sono state verificate con un termo-igrometro. L’insieme di queste operazioni rappresenta una serie di prove.`;
}

export default async function CalibrationReportDetailsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select(
      `
      id,
      record_number,
      mode,
      verification_date,
      customer_instrument_id,
      reference_instrument_id,
      customer_instrument_snapshot,
      reference_instrument_snapshot,
      procedure_snapshot
    `
    )
    .eq("id", id)
    .single();

  if (recordError || !recordData) {
    notFound();
  }

  const record = recordData as CalibrationRecord;

  let customerInstrument: CustomerInstrument | null = null;

  if (record.customer_instrument_id) {
    const { data } = await supabase
      .from("customer_instruments")
      .select(
        `
        id,
        customer_name,
        site,
        name,
        manufacturer,
        model,
        serial_number,
        measurement_range
      `
      )
      .eq("id", record.customer_instrument_id)
      .single();

    customerInstrument = (data ?? null) as CustomerInstrument | null;
  }

  const { data: reportDetailsData } = await supabase
    .from("calibration_report_details")
    .select(
      `
      id,
      calibration_record_id,
      main_report_number,
      technical_annex_number,
      acceptance_number,
      acceptance_date,
      report_date,
      test_date,
      customer_name,
      site_description,
      work_object,
      requested_tests,
      premise_text,
      scope_text,
      apparatus_description,
      execution_method,
      results_text,
      temperature,
      humidity,
      technician_name,
      reviewer_name,
      director_name,
      instrument_photo_url,
      notes
    `
    )
    .eq("calibration_record_id", id)
    .maybeSingle();

  const customerName =
    getSnapshotText(record.customer_instrument_snapshot, "customer_name") ??
    customerInstrument?.customer_name ??
    "";

  const siteName =
    getSnapshotText(record.customer_instrument_snapshot, "site_name") ??
    customerInstrument?.site ??
    "";

  const siteCity =
    getSnapshotText(record.customer_instrument_snapshot, "site_city") ?? "";

  const siteProvince =
    getSnapshotText(record.customer_instrument_snapshot, "site_province") ?? "";

  const siteDescription =
    customerInstrument?.site ??
    [siteName, siteCity, siteProvince ? `(${siteProvince})` : ""]
      .filter(Boolean)
      .join(" ");

  const instrumentName =
    getSnapshotText(record.customer_instrument_snapshot, "instrument_name") ??
    customerInstrument?.name ??
    "macchina";

  const manufacturer =
    getSnapshotText(record.customer_instrument_snapshot, "manufacturer") ??
    customerInstrument?.manufacturer ??
    "";

  const model =
    getSnapshotText(record.customer_instrument_snapshot, "model") ??
    customerInstrument?.model ??
    "";

  const serialNumber =
    getSnapshotText(record.customer_instrument_snapshot, "serial_number") ??
    customerInstrument?.serial_number ??
    "";

  const measurementRange =
    getSnapshotText(record.customer_instrument_snapshot, "measurement_range") ??
    customerInstrument?.measurement_range ??
    "";

  const reportDate = todayIsoDate();
  const testDate = record.verification_date ?? todayIsoDate();
  const technicalAnnexNumber = buildTechnicalAnnexNumber(record.record_number);
  const mainReportNumber = buildMainReportNumber(record.record_number);

  const workObject = `Verifica taratura di ${instrumentName.toUpperCase()} ${manufacturer.toUpperCase()} ${model}`.trim();
  const requestedTests = `Verifica taratura ${instrumentName.toUpperCase()} ${manufacturer.toUpperCase()} ${model}`.trim();

  const defaultData: ReportDetails = {
    id: null,
    calibration_record_id: id,
    main_report_number: mainReportNumber,
    technical_annex_number: technicalAnnexNumber,
    acceptance_number: null,
    acceptance_date: null,
    report_date: reportDate,
    test_date: testDate,
    customer_name: customerName,
    site_description: siteDescription,
    work_object: workObject,
    requested_tests: requestedTests,
    premise_text: buildDefaultPremise({
      testDate,
      customerName,
      siteDescription,
      instrumentName,
      manufacturer,
      model,
      serialNumber,
      range: measurementRange,
    }),
    scope_text: defaultScopeText(),
    apparatus_description: defaultApparatusDescription(),
    execution_method: defaultExecutionMethod({
      instrumentName,
      manufacturer,
      model,
      serialNumber,
      range: measurementRange,
    }),
    results_text: defaultResultsText(technicalAnnexNumber),
    temperature: null,
    humidity: null,
    technician_name: "Geom. Giosuè Del Mastro",
    reviewer_name: "Geom. Giosuè Del Mastro",
    director_name: "Ing. Pietro Cardone",
    instrument_photo_url: null,
    notes: null,
  };

  const initialData: ReportDetails = reportDetailsData
    ? ((reportDetailsData as ReportDetails) ?? defaultData)
    : defaultData;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link
              href={`/verifiche/${id}`}
              className="text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              ← Torna alla verifica
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              Dati rapporto finale
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Compila i dati necessari per generare il rapporto principale
              Tecnocontrolli. Questa è la parte che oggi viene preparata
              manualmente e poi unita all’allegato tecnico.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/verifiche/${id}/rapporto/anteprima`}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Anteprima rapporto
            </Link>

            <Link
              href={`/verifiche/${id}/rapporto/allegato`}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Anteprima allegato tecnico
            </Link>

            <Link
              href={`/verifiche/${id}/rapporto/finale`}
              className="rounded-xl bg-indigo-700 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
            >
              Anteprima finale
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Nota:</strong> i testi sono precompilati in automatico partendo
          dalla verifica, ma vanno sempre controllati prima della validazione
          finale.
        </div>

        <CalibrationReportDetailsForm recordId={id} initialData={initialData} />
      </div>
    </AppShell>
  );
}