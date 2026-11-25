import {readAllRows} from "@/lib/read-all-rows";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import InternalInstrumentsSearchTable, {
  type InternalInstrumentListItem,
} from "@/components/InternalInstrumentsSearchTable";
import RoleGate from "@/components/RoleGate";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function InternalInstrumentsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, { data: measurementData, error: measurementError }] =
    await Promise.all([
      readAllRows((from,to)=>supabase
        .from("internal_instruments")
        .select("lab_site, id, name, manufacturer, model, serial_number, internal_code, measurement_quantity, unit, measurement_range, location, department, status, notes, is_active, created_at")
        .order("created_at", { ascending: false }).order("id").range(from,to)),
      readAllRows<{id:string;internal_instrument_id:string;measurement_quantity:string|null;unit:string|null;measurement_range:string|null;resolution:string|null;is_primary:boolean;sort_order:number}>((from,to)=>supabase
        .from("internal_instrument_measurements")
        .select("id, internal_instrument_id, measurement_quantity, unit, measurement_range, resolution, is_primary, sort_order")
        .order("sort_order", { ascending: true }).order("id").range(from,to)),
    ]);

  const byInstrument = new Map<string, InternalInstrumentListItem["measurements"]>();
  for (const row of measurementData ?? []) {
    const instrumentId = String(row.internal_instrument_id);
    const current = byInstrument.get(instrumentId) ?? [];
    current.push({
      id: String(row.id),
      measurement_quantity: String(row.measurement_quantity ?? ""),
      unit: row.unit ?? null,
      measurement_range: row.measurement_range ?? null,
      resolution: row.resolution ?? null,
      is_primary: row.is_primary === true,
      sort_order: Number(row.sort_order) || 1,
    });
    byInstrument.set(instrumentId, current);
  }

  const instruments = ((data ?? []) as Omit<InternalInstrumentListItem, "measurements">[]).map(
    (instrument) => ({
      ...instrument,
      measurements: byInstrument.get(instrument.id) ?? [],
    })
  );

  const activeCount = instruments.filter((item) => item.status === "active").length;
  const outOfServiceCount = instruments.filter((item) => item.status === "out_of_service").length;
  const dismissedCount = instruments.filter((item) => item.status === "dismissed").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">← Torna alla dashboard</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">Strumenti interni</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Archivio delle attrezzature e degli strumenti aziendali da sottoporre a verifiche interne, con gestione di più grandezze per lo stesso strumento.</p>
          </div>
          <RoleGate allow={["master", "technician"]}>
            <Link href="/strumenti-interni/nuovo" className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700">Nuovo strumento interno</Link>
          </RoleGate>
        </div>

        {(error || measurementError) && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">Errore nel caricamento strumenti interni: {error?.message || measurementError?.message}</div>}

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Totale strumenti</p><p className="mt-2 text-3xl font-bold text-slate-900">{instruments.length}</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><p className="text-sm font-medium text-emerald-900">Attivi</p><p className="mt-2 text-3xl font-bold text-emerald-900">{activeCount}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><p className="text-sm font-medium text-amber-900">Fuori servizio</p><p className="mt-2 text-3xl font-bold text-amber-900">{outOfServiceCount}</p></div>
          <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm"><p className="text-sm font-medium text-slate-800">Dismessi</p><p className="mt-2 text-3xl font-bold text-slate-900">{dismissedCount}</p></div>
        </section>

        <InternalInstrumentsSearchTable instruments={instruments} />
      </div>
    </AppShell>
  );
}
