import Link from "next/link";
import AppShell from "@/components/AppShell";
import CustomersSearchTable, {
  type CustomerListItem,
} from "@/components/CustomersSearchTable";
import { supabase } from "@/lib/supabase";

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

  const customers = (data ?? []) as CustomerListItem[];

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

        <CustomersSearchTable customers={customers} />
      </div>
    </AppShell>
  );
}