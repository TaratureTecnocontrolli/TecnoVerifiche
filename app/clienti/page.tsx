import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  customer_number: string | null;
  business_name: string;
  vat_number: string | null;
  tax_code: string | null;
  city: string | null;
  province: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  is_active: boolean;
  created_at: string;
  customer_sites: {
    id: string;
    name: string;
    city: string | null;
    province: string | null;
  }[] | null;
};

function formatItalianDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

export default async function CustomersPage() {
  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      id,
      customer_number,
      business_name,
      vat_number,
      tax_code,
      city,
      province,
      email,
      phone,
      contact_person,
      is_active,
      created_at,
      customer_sites (
        id,
        name,
        city,
        province
      )
    `
    )
    .order("business_name", { ascending: true });

  const customers = (data ?? []) as Customer[];

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
              Clienti
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Archivio clienti di TecnoTarature. Ogni cliente può avere una o
              più sedi operative e più strumenti collegati.
            </p>
          </div>

          <Link
            href="/clienti/nuovo"
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Nuovo cliente
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore nel caricamento clienti: {error.message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Clienti totali</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {customers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Clienti attivi</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {customers.filter((customer) => customer.is_active).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sedi registrate</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {customers.reduce(
                (total, customer) =>
                  total + (customer.customer_sites?.length ?? 0),
                0
              )}
            </p>
          </div>
        </section>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Elenco clienti
            </h2>
            <p className="text-sm text-slate-500">
              Totale clienti trovati: {customers.length}
            </p>
          </div>

          {customers.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Nessun cliente registrato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">N. cliente</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">P.IVA / C.F.</th>
                    <th className="px-4 py-3">Località</th>
                    <th className="px-4 py-3">Referente</th>
                    <th className="px-4 py-3">Contatti</th>
                    <th className="px-4 py-3">Sedi</th>
                    <th className="px-4 py-3">Stato</th>
                    <th className="px-4 py-3">Inserito il</th>
                    <th className="px-4 py-3">Azioni</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {customer.customer_number || "-"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={"/clienti/" + customer.id}
                          className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {customer.business_name}
                        </Link>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <p>{customer.vat_number ?? "-"}</p>
                        <p className="text-xs text-slate-500">
                          {customer.tax_code ?? "-"}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {[customer.city, customer.province]
                          .filter(Boolean)
                          .join(" (") +
                          (customer.province ? ")" : "") || "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {customer.contact_person ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <p>{customer.email ?? "-"}</p>
                        <p className="text-xs text-slate-500">
                          {customer.phone ?? "-"}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {customer.customer_sites?.length ?? 0}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            customer.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {customer.is_active ? "Attivo" : "Non attivo"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {formatItalianDate(customer.created_at)}
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={"/clienti/" + customer.id}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
        </div>
      </div>
    </AppShell>
  );
}
