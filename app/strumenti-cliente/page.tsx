import Link from "next/link";
import AppShell from "@/components/AppShell";
import DeleteCustomerInstrumentButton from "@/components/DeleteCustomerInstrumentButton";
import { supabase } from "@/lib/supabase";

type CustomerInstrument = {
  id: string;
  customer_name: string | null;
  site: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  resolution: string | null;
  acceptance_class: string | null;
  notes: string | null;
  created_at: string;
};

function formatItalianDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

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
      resolution,
      acceptance_class,
      notes,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  const instruments = (data ?? []) as CustomerInstrument[];

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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Elenco strumenti cliente
            </h2>
            <p className="text-sm text-slate-500">
              Totale strumenti trovati: {instruments.length}
            </p>
          </div>

          {instruments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Nessuno strumento cliente registrato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1220px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Strumento</th>
                    <th className="px-4 py-3">Codice</th>
                    <th className="px-4 py-3">Matricola</th>
                    <th className="px-4 py-3">Grandezza</th>
                    <th className="px-4 py-3">Campo</th>
                    <th className="px-4 py-3">Risoluzione</th>
                    <th className="px-4 py-3">Classe/tolleranza</th>
                    <th className="px-4 py-3">Inserito il</th>
                    <th className="px-4 py-3">Azioni</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {instruments.map((instrument) => (
                    <tr key={instrument.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {instrument.customer_name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {instrument.site ?? "-"}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={"/strumenti-cliente/" + instrument.id}
                          className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {instrument.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {[instrument.manufacturer, instrument.model]
                            .filter(Boolean)
                            .join(" - ") || "-"}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {instrument.internal_code ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {instrument.serial_number ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {[instrument.measurement_quantity, instrument.unit]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {instrument.measurement_range ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {instrument.resolution ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {instrument.acceptance_class ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {formatItalianDate(instrument.created_at)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <Link
                            href={"/strumenti-cliente/" + instrument.id}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Modifica
                          </Link>

                          <DeleteCustomerInstrumentButton
                            instrumentId={instrument.id}
                            instrumentName={instrument.name}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Nota:</strong> per ora non stiamo importando dati cliente dagli
          Excel caricati. Gli Excel li usiamo solo per struttura, formule e
          impostazione tecnica.
        </div>
      </div>
    </AppShell>
  );
}
