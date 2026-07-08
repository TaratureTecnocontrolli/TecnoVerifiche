import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditCustomerInstrumentForm from "@/components/EditCustomerInstrumentForm";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CustomerInstrument = {
  id: string;
  customer_id: string | null;
  site_id: string | null;
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
};

export default async function CustomerInstrumentDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const { data: instrumentData, error: instrumentError } = await supabase
    .from("customer_instruments")
    .select(
      `
      id,
      customer_id,
      site_id,
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
      notes
    `
    )
    .eq("id", id)
    .maybeSingle();

  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select("id, customer_number, business_name")
    .eq("is_active", true)
    .order("business_name", { ascending: true });

  const { data: sitesData, error: sitesError } = await supabase
    .from("customer_sites")
    .select("id, customer_id, name, city, province")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (instrumentError || customersError || sitesError) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link
            href="/strumenti-cliente"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti cliente
          </Link>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-bold">Errore caricamento strumento</p>
            <p className="mt-2">
              {instrumentError?.message ||
                customersError?.message ||
                sitesError?.message}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!instrumentData) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link
            href="/strumenti-cliente"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti cliente
          </Link>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-bold">Strumento cliente non trovato</p>
            <p className="mt-2">
              Il link aperto non corrisponde a uno strumento presente nel database.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const instrument = instrumentData as CustomerInstrument;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/strumenti-cliente"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti cliente
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Modifica strumento cliente
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Aggiorna dati anagrafici dello strumento, cliente associato, sede,
            matricola, campo di misura e dati tecnici.
          </p>
        </div>

        <EditCustomerInstrumentForm
          instrument={instrument}
          customers={(customersData ?? []) as {
            id: string;
            customer_number: string | null;
            business_name: string;
          }[]}
          sites={(sitesData ?? []) as {
            id: string;
            customer_id: string;
            name: string;
            city: string | null;
            province: string | null;
          }[]}
        />
      </div>
    </AppShell>
  );
}
