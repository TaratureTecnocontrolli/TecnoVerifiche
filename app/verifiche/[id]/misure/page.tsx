import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import EditForceMeasurementsForm from "@/components/EditForceMeasurementsForm";
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
  report_status: string | null;
};

export default async function EditMeasurementsPage({ params }: PageProps) {
  const { id } = await params;

  const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select("id, record_number, mode, report_status")
    .eq("id", id)
    .single();

  if (recordError || !recordData) {
    notFound();
  }

  const record = recordData as CalibrationRecord;

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
              Modifica i dati tecnici della verifica compressione/trazione:
              scale, strumento campione usato e punti di misura.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={"/verifiche/" + id + "/rapporto"}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dati rapporto
            </Link>

            <Link
              href={"/verifiche/" + id + "/rapporto/finale"}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Rapporto
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

        <EditForceMeasurementsForm
          recordId={id}
          recordNumber={record.record_number}
          reportStatus={record.report_status}
          initialScales={scalesData ?? []}
          initialMeasurements={measurementsData ?? []}
          referenceInstruments={referenceInstrumentsData ?? []}
        />
      </div>
    </AppShell>
  );
}
