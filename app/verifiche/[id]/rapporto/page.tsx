import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import CalibrationReportDetailsForm from "@/components/CalibrationReportDetailsForm";
import { supabase } from "@/lib/supabase";
import { getVerificationModuleFromMode } from "@/lib/verification-types";

type PageProps = {
  params: Promise<{
    id: string;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

}>;
};

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  mode: string | null;
  verification_module: string | null;
  verification_date: string;
  operator_name: string | null;
  location: string | null;
  environmental_conditions: string | null;
  status: string | null;
  report_status: string | null;
  customer_instrument_snapshot: Record<string, unknown> | null;
  reference_instrument_snapshot: Record<string, unknown> | null;
  procedure_snapshot: Record<string, unknown> | null;
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

function getSnapshotText(
  snapshot: Record<string, unknown> | null,
  key: string
): string {
  const value = snapshot?.[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function buildEmptyReportDetails(recordId: string): ReportDetails {
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

function reportStatusLabel(status: string | null | undefined) {
  if (status === "draft") return "Bozza";
  if (status === "ready") return "Pronto per emissione";
  if (status === "issued") return "Emesso";
  if (status === "reopened") return "Da correggere / riaperto";

  return "Bozza";
}

function reportStatusClass(status: string | null | undefined) {
  if (status === "issued") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "ready") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (status === "reopened") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function CalibrationReportDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select(
      `
      id,
      record_number,
      mode,
      verification_module,
      verification_date,
      operator_name,
      location,
      environmental_conditions,
      status,
      report_status,
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

  const { data: reportData, error: reportError } = await supabase
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

  const reportDetails = reportData
    ? ((reportData as ReportDetails))
    : buildEmptyReportDetails(id);

  const autoPremiseData = {
    customerName:
      reportDetails.customer_name ||
      getSnapshotText(record.customer_instrument_snapshot, "customer_name") ||
      "",
    siteDescription:
      reportDetails.site_description ||
      getSnapshotText(record.customer_instrument_snapshot, "site_name") ||
      record.location ||
      "",
    instrumentName:
      getSnapshotText(record.customer_instrument_snapshot, "instrument_name") ||
      "",
    manufacturer:
      getSnapshotText(record.customer_instrument_snapshot, "manufacturer") ||
      "",
    model:
      getSnapshotText(record.customer_instrument_snapshot, "model") ||
      "",
    serialNumber:
      getSnapshotText(record.customer_instrument_snapshot, "serial_number") ||
      "",
    range:
      getSnapshotText(record.customer_instrument_snapshot, "measurement_range") ||
      "",
    verificationModule:
      record.verification_module ||
      getVerificationModuleFromMode(record.mode),
    verificationDate: record.verification_date,
  };

  const isIssued = record.report_status === "issued";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link
              href="/verifiche"
              className="text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              ← Torna alle verifiche
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              Dati rapporto finale
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Compila i dati del rapporto, le firme e gli elementi necessari per
              l’emissione del PDF finale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={
                "rounded-full border px-3 py-1.5 text-xs font-semibold " +
                reportStatusClass(record.report_status)
              }
            >
              {reportStatusLabel(record.report_status)}
            </span>

            <Link
              href={`/verifiche/${id}/rapporto/finale`}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Anteprima finale
            </Link>
          </div>
        </div>

        {reportError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore caricamento dati rapporto: {reportError.message}
          </div>
        )}

        {isIssued && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            Questo rapporto risulta emesso. I dati sotto sono consultabili ma non
            modificabili. Per correggere il rapporto usa “Riapri per correzione”
            nell’anteprima finale.
          </div>
        )}

        <CalibrationReportDetailsForm
          recordId={id}
          initialData={reportDetails}
          autoPremiseData={autoPremiseData}
          isReadOnly={isIssued}
          reportStatus={record.report_status}
        />
      </div>
    </AppShell>
  );
}

