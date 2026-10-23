import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import EditForceMeasurementsForm from "@/components/EditForceMeasurementsForm";
import EditJackMeasurementsForm from "@/components/EditJackMeasurementsForm";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  verification_date: string | null;
  mode: string | null;
  verification_module: string | null;
  verification_scope: string | null;
  verified_instrument_type: string | null;
  output_type: string | null;
  report_status: string | null;
  procedure_snapshot: unknown;
  customer_instrument_snapshot: unknown;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function isJackRecord(record: CalibrationRecord) {
  const module = String(record.verification_module ?? "").trim().toUpperCase();
  const recordNumber = String(record.record_number ?? "").trim().toUpperCase();
  const procedureSnapshot = asObject(record.procedure_snapshot);
  const instrumentSnapshot = asObject(record.customer_instrument_snapshot);
  const conversionUnit = String(procedureSnapshot.conversion_unit ?? "")
    .trim()
    .toLowerCase();
  const calculationVersion = String(
    procedureSnapshot.calculation_engine_version ?? ""
  )
    .trim()
    .toLowerCase();
  const procedureCode = String(procedureSnapshot.code ?? "").trim().toUpperCase();
  const instrumentUnit = String(instrumentSnapshot.unit ?? "").trim().toLowerCase();

  return (
    module === "JACK" ||
    recordNumber.startsWith("MAR-") ||
    conversionUnit === "kn/bar" ||
    instrumentUnit === "kn/bar" ||
    calculationVersion.startsWith("martinetti") ||
    (procedureCode === "PTS6" && conversionUnit === "kn/bar")
  );
}

export default async function EditMeasurementsPage({ params }: PageProps) {
  const { id } = await params;

  const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select(
      "id, record_number, verification_date, mode, verification_module, verification_scope, verified_instrument_type, output_type, report_status, procedure_snapshot, customer_instrument_snapshot"
    )
    .eq("id", id)
    .single();

  if (recordError || !recordData) {
    notFound();
  }

  const record = recordData as CalibrationRecord;
  const isJack = isJackRecord(record);
  const isInternalVerification =
    record.verification_scope === "VI" ||
    record.output_type === "rapportino" ||
    record.output_type === "rapportino_interno" ||
    record.verified_instrument_type === "internal" ||
    record.verified_instrument_type === "interno";

  const detailsHref = isInternalVerification
    ? "/verifiche/" + id + "/rapportino-interno"
    : "/verifiche/" + id + "/rapporto";

  const reportHref = isInternalVerification
    ? "/verifiche/" + id + "/rapportino-interno"
    : "/verifiche/" + id + "/rapporto/finale";

  const { data: scalesData, error: scalesError } = await supabase
    .from("calibration_record_scales")
    .select(
      `
      id,
      calibration_record_id,
      scale_order,
      scale_name,
      scale_range,
      reference_instrument_id,
      reference_instrument_snapshot,
      reference_instrument_ids,
      reference_instruments_snapshot,
      notes
    `
    )
    .eq("calibration_record_id", id)
    .order("scale_order", { ascending: true });

  const { data: measurementsData, error: measurementsError } = await supabase
    .from("calibration_measurements")
    .select(
      `
      id,
      calibration_record_id,
      scale_id,
      point_order,
      section,
      nominal_value,
      applied_value,
      cycle_1,
      cycle_2,
      cycle_3,
      max_value,
      min_value,
      average_value,
      mean_error,
      accuracy_error_percent,
      repeatability_error_percent,
      result,
      notes
    `
    )
    .eq("calibration_record_id", id)
    .order("point_order", { ascending: true });

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
        status
      `
      )
      .order("name", { ascending: true });

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
              Modifica misure
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              {isJack
                ? "Modifica i dati tecnici della verifica martinetto: pressione, letture in kN, coefficiente di conversione e ripetibilità."
                : "Modifica i dati tecnici della verifica compressione/trazione: scale, strumento campione usato e punti di misura."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={detailsHref}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {isInternalVerification ? "Rapportino" : "Dati rapporto"}
            </Link>

            <Link
              href={reportHref}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isInternalVerification ? "Rapportino" : "Rapporto"}
            </Link>
          </div>
        </div>

        {(scalesError || measurementsError || referenceInstrumentsError) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            {scalesError && <p>Errore caricamento scale: {scalesError.message}</p>}
            {measurementsError && (
              <p>Errore caricamento misure: {measurementsError.message}</p>
            )}
            {referenceInstrumentsError && (
              <p>
                Errore caricamento strumenti campione: {referenceInstrumentsError.message}
              </p>
            )}
          </div>
        )}

        {isJack ? (
          <EditJackMeasurementsForm
            recordId={id}
            recordNumber={record.record_number}
            reportStatus={record.report_status}
            initialVerificationDate={record.verification_date}
            isInternalVerification={isInternalVerification}
            initialScales={scalesData ?? []}
            initialMeasurements={measurementsData ?? []}
            referenceInstruments={referenceInstrumentsData ?? []}
          />
        ) : (
          <EditForceMeasurementsForm
            recordId={id}
            recordNumber={record.record_number}
            reportStatus={record.report_status}
            initialVerificationDate={record.verification_date}
            initialScales={scalesData ?? []}
            initialMeasurements={measurementsData ?? []}
            referenceInstruments={referenceInstrumentsData ?? []}
            isInternalVerification={isInternalVerification}
          />
        )}
      </div>
    </AppShell>
  );
}
