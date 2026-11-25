import InstrumentDocumentArchive from "@/components/InstrumentDocumentArchive";
import InstrumentSiteCard from "@/components/InstrumentSiteCard";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditInternalInstrumentForm, {
  type InternalInstrumentInitialData,
} from "@/components/EditInternalInstrumentForm";
import RoleGate from "@/components/RoleGate";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { InternalInstrumentMeasurement } from "@/lib/internal-instrument-measurements";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

function statusLabel(status: string) {
  if (status === "active") return "Attivo";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";
  return status;
}

function statusClass(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "out_of_service") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "dismissed") return "border-slate-300 bg-slate-100 text-slate-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function DataBox({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value || "-"}</p>
    </div>
  );
}

export default async function InternalInstrumentDetailPage({ params }: PageProps) {
  const supabase = await createServerSupabaseClient();
  const { id } = await params;

  const [{ data, error }, { data: measurementsData, error: measurementsError }] =
    await Promise.all([
      supabase
        .from("internal_instruments")
        .select(
          "lab_site, id, name, manufacturer, model, serial_number, internal_code, measurement_quantity, unit, measurement_range, location, department, status, notes, is_active"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("internal_instrument_measurements")
        .select(
          "id, measurement_quantity, unit, measurement_range, resolution, notes, is_primary, sort_order"
        )
        .eq("internal_instrument_id", id)
        .order("sort_order", { ascending: true }),
    ]);

  if (error || measurementsError) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link href="/strumenti-interni" className="text-sm font-medium text-slate-500 hover:text-slate-950">← Torna agli strumenti interni</Link>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-bold">Errore caricamento strumento interno</p>
            <p className="mt-2">{error?.message || measurementsError?.message}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link href="/strumenti-interni" className="text-sm font-medium text-slate-500 hover:text-slate-950">← Torna agli strumenti interni</Link>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-bold">Strumento interno non trovato</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const instrument = data as InternalInstrumentInitialData;
  const measurements = ((measurementsData ?? []) as Array<{
    id: string;
    measurement_quantity: string;
    unit: string | null;
    measurement_range: string | null;
    resolution: string | null;
    notes: string | null;
    is_primary: boolean;
    sort_order: number;
  }>).map(
    (row): InternalInstrumentMeasurement => ({
      id: row.id,
      measurement_quantity: row.measurement_quantity,
      unit: row.unit ?? "",
      measurement_range: row.measurement_range ?? "",
      resolution: row.resolution ?? "",
      notes: row.notes ?? "",
      is_primary: row.is_primary,
      sort_order: row.sort_order,
    })
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/strumenti-interni" className="text-sm font-medium text-slate-500 hover:text-slate-950">← Torna agli strumenti interni</Link>
          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">{instrument.name}</h1>
              <p className="mt-2 max-w-3xl text-slate-600">Anagrafica e caratteristiche metrologiche dello strumento interno utilizzato nelle VI.</p>
            </div>
            <div className={"w-fit rounded-2xl border px-4 py-3 text-sm " + statusClass(instrument.status)}>
              <p className="font-semibold">Stato: {statusLabel(instrument.status)}</p>
            </div>
          </div>
        </div>

        <InstrumentSiteCard id={instrument.id} kind="interni" initialSite={(data as {lab_site?:string|null}).lab_site??null} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Riepilogo strumento</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DataBox label="Nome" value={instrument.name} />
            <DataBox label="Codice interno" value={instrument.internal_code} />
            <DataBox label="Costruttore" value={instrument.manufacturer} />
            <DataBox label="Modello" value={instrument.model} />
            <DataBox label="Matricola" value={instrument.serial_number} />
            <DataBox label="Reparto" value={instrument.department} />
            <DataBox label="Ubicazione" value={instrument.location} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Grandezze associate</h2>
              <p className="text-sm text-slate-500">{measurements.length} grandezze configurate</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {measurements.map((measurement) => (
              <div key={measurement.id || measurement.sort_order} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">{measurement.measurement_quantity}</p>
                  {measurement.is_primary && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-700">Principale</span>}
                </div>
                <p className="mt-2 text-sm text-slate-700">Unità: <strong>{measurement.unit || "-"}</strong></p>
                <p className="text-sm text-slate-700">Campo: <strong>{measurement.measurement_range || "-"}</strong></p>
                <p className="text-sm text-slate-700">Risoluzione: <strong>{measurement.resolution || "-"}</strong></p>
              </div>
            ))}
            {measurements.length === 0 && <p className="text-sm text-slate-500">Nessuna grandezza configurata.</p>}
          </div>
        </section>

        <RoleGate
          allow={["master"]}
          fallback={
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              La modifica dell’anagrafica è riservata ai profili MASTER.
            </div>
          }
        >
          <EditInternalInstrumentForm instrument={instrument} initialMeasurements={measurements} />
        </RoleGate>
        <InstrumentDocumentArchive kind="interni" id={instrument.id} />
      </div>
    </AppShell>
  );
}
