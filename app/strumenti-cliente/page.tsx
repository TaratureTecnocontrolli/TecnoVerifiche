import Link from "next/link";
import AppShell from "@/components/AppShell";
import CustomerInstrumentsSearchTable, {
  type CustomerInstrumentListItem,
} from "@/components/CustomerInstrumentsSearchTable";
import { supabase } from "@/lib/supabase";

export default async function CustomerInstrumentsPage() {
  const { data, error } = await supabase
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
      internal_code,
      measurement_quantity,
      unit,
      measurement_range,
      notes,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  const instruments = (data ?? []) as CustomerInstrumentListItem[];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              ← Torna alla dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              Strumenti cliente
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Archivio degli strumenti sottoposti a verifica o taratura. Questa
              sezione serve a collegare ogni verifica al relativo strumento del
              cliente.
            </p>
          </div>

          <Link
            href="/strumenti-cliente/nuovo"
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Nuovo strumento cliente
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore nel caricamento strumenti cliente: {error.message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Totale strumenti</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {instruments.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Clienti registrati</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {
                new Set(
                  instruments
                    .map((item) => item.customer_name)
                    .filter(Boolean)
                ).size
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tipologie/grandezze</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {
                new Set(
                  instruments
                    .map((item) => item.measurement_quantity)
                    .filter(Boolean)
                ).size
              }
            </p>
          </div>
        </section>

        <CustomerInstrumentsSearchTable instruments={instruments} />

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Nota:</strong> per ora non stiamo importando dati cliente dagli
          Excel caricati. Gli Excel li usiamo solo per struttura, formule e
          impostazione tecnica.
        </div>
      </div>
    </AppShell>
  );
}