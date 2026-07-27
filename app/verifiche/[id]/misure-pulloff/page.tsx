import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import EditPullOffMeasurementsForm from "@/components/EditPullOffMeasurementsForm";
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
  verification_module: string | null;
  verification_scope: string | null;
  verified_instrument_type: string | null;
  output_type: string | null;
  report_status: string | null;
};

export default async function EditPullOffMeasurementsPage({ params }: PageProps) {
  const { id } = await params;

  const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select("id, record_number, mode, verification_module, verification_scope, verified_instrument_type, output_type, report_status")
    .eq("id", id)
    .single();

  if (recordError || !recordData) {
    notFound();
  }

  const record = recordData as CalibrationRecord;
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


  if (
    record.verification_module !== "PULLOFF" &&
    record.mode !== "pulloff"
  ) {
    notFound();
  }

  const { data: scalesData, error: scalesError } = await supabase
    .from("calibration_record_scales")
    .select("*")
    .eq("calibration_record_id", id)
    .order("scale_order", { ascending: true });

  const { data: measurementsData, error: measurementsError } = await supabase
    .from("calibration_measurements")
    .select("*")
    .eq("calibration_record_id", id)
    .order("point_order", { ascending: true });

  const { data: referenceInstrumentsData, error: referenceInstrumentsError } =
    await supabase
      .from("reference_instruments")
      .select("*")
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
              Misure pull-off
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Inserisci i punti di carico, le tre letture ripetute e controlla
              errore, errore percentuale e ripetibilità.
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
                Errore caricamento strumenti campione:{" "}
                {referenceInstrumentsError.message}
              </p>
            )}
          </div>
        )}

        <EditPullOffMeasurementsForm
          recordId={id}
          recordNumber={record.record_number}
          reportStatus={record.report_status}
          initialScales={scalesData ?? []}
          initialMeasurements={measurementsData ?? []}
          referenceInstruments={referenceInstrumentsData ?? []}
          isInternalVerification={isInternalVerification}
        />
      </div>
    </AppShell>
  );
}