import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import EditCustomerForm from "@/components/EditCustomerForm";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{
    id: string;


}>;
};

type CustomerRow = {
  id: string;
  customer_number: string | null;
  business_name: string;
  vat_number: string | null;
  tax_code: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  notes: string | null;
  is_active: boolean;
  customer_sites:
    | {
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        province: string | null;
        postal_code: string | null;
        contact_person: string | null;
        phone: string | null;
        email: string | null;
        is_active: boolean;
      }[]
    | null;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      id,
      customer_number,
      business_name,
      vat_number,
      tax_code,
      address,
      city,
      province,
      postal_code,
      email,
      phone,
      contact_person,
      notes,
      is_active,
      customer_sites (
        id,
        name,
        address,
        city,
        province,
        postal_code,
        contact_person,
        phone,
        email,
        is_active
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const customer = data as CustomerRow;
  const mainSite = customer.customer_sites?.[0] ?? null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/clienti"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna ai clienti
          </Link>

          <div className="mt-3 flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">
                Modifica cliente
              </h1>

              <p className="mt-2 max-w-3xl text-slate-600">
                Aggiorna anagrafica cliente, numero cliente, contatti e sede
                principale.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm">
              <p className="text-slate-500">Cliente</p>
              <p className="font-bold text-slate-900">
                {customer.customer_number
                  ? customer.customer_number + " - "
                  : ""}
                {customer.business_name}
              </p>
            </div>
          </div>
        </div>

        <EditCustomerForm customer={customer} mainSite={mainSite} />
      </div>
    </AppShell>
  );
}

