import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type InternalInstrument = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  location: string | null;
  department: string | null;
  status: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

function formatItalianDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function statusLabel(status: string) {
  if (status === "active") return "Attivo";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";

  return status;
}

function statusClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "out_of_service") return "bg-amber-100 text-amber-800";
  if (status === "dismissed") return "bg-slate-200 text-slate-700";

  return "bg-slate-100 text-slate-700";
}

export default async function InternalInstrumentsPage() {
  const { data, error } = await supabase
    .from("internal_instruments")
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
      location,
      department,
      status,
      notes,
      is_active,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  const instruments = (data ?? []) as InternalInstrument[];

  const activeCount = instruments.filter((item) => item.status === "active").length;
  const outOfServiceCount = instruments.filter(
    (item) => item.status === "out_of_service"
  ).length;
  const dismissedCount = instruments.filter(
    (item) => item.status === "dismissed"
  ).length;

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
              Strumenti interni
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Archivio delle attrezzature e degli strumenti aziendali da
              sottoporre a verifiche interne. Questa anagrafica verrà usata per
              il flusso VI.
            </p>
          </div>

          <Link
            href="/strumenti-interni/nuovo"
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Nuovo strumento interno
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore nel caricamento strumenti interni: {error.message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Totale strumenti</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {instruments.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-900">Attivi</p>
            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-900">Fuori servizio</p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {outOfServiceCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-800">Dismessi</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {dismissedCount}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Elenco strumenti interni
            </h2>
            <p className="text-sm text-slate-500">
              Totale strumenti trovati: {instruments.length}
            </p>
          </div>

          {instruments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Nessuno strumento interno registrato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Strumento</th>
                    <th className="px-4 py-3">Codice</th>
                    <th className="px-4 py-3">Matricola</th>
                    <th className="px-4 py-3">Grandezza</th>
                    <th className="px-4 py-3">Fondo scala</th>
                    <th className="px-4 py-3">Reparto</th>
                    <th className="px-4 py-3">Ubicazione</th>
                    <th className="px-4 py-3">Stato</th>
                    <th className="px-4 py-3">Inserito il</th>
                    <th className="px-4 py-3">Azioni</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {instruments.map((instrument) => (
                    <tr key={instrument.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={"/strumenti-interni/" + instrument.id}
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
                        {instrument.department ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {instrument.location ?? "-"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            instrument.status
                          )}`}
                        >
                          {statusLabel(instrument.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {formatItalianDate(instrument.created_at)}
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={"/strumenti-interni/" + instrument.id}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Modifica
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}