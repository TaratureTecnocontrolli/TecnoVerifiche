import AppShell from "@/components/AppShell";
import NewVerificationHeader from "@/components/NewVerificationHeader";
import TemperatureVerificationStarter from "@/components/TemperatureVerificationStarter";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Promise<{
    scope?: string;
  }>;
};

type VerificationScope = "VT" | "VI";

type Customer = {
  id: string;


customer_number?: string | null;
  business_name?: string | null;
  name?: string | null;
};

type CustomerInstrument = {
  id: string;
  customer_id?: string | null;
  name?: string | null;
  description?: string | null;
  instrument_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  range?: string | null;
  resolution?: string | null;
  notes?: string | null;
};

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
};

type ReferenceInstrument = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  range?: string | null;
  resolution?: string | null;
  certificate_number?: string | null;
  certificate_expiry?: string | null;
  certificate_file_url?: string | null;
  certificate_file_name?: string | null;
  status?: string | null;
};

function resolveScope(scope: string | undefined): VerificationScope {
  return scope === "VI" ? "VI" : "VT";
}

export default async function NewTemperatureVerificationPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const verificationScope = resolveScope(resolvedSearchParams.scope);

  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select("*")
    .order("business_name", { ascending: true });

  const { data: customerInstrumentsData, error: customerInstrumentsError } =
    await supabase
      .from("customer_instruments")
      .select("*")
      .order("name", { ascending: true });

  const { data: internalInstrumentsData, error: internalInstrumentsError } =
    await supabase
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
        is_active
      `
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

  const { data: referenceInstrumentsData, error: referenceInstrumentsError } =
    await supabase
      .from("reference_instruments")
      .select("*")
      .order("name", { ascending: true });

  const customers = (customersData ?? []) as Customer[];
  const customerInstruments =
    (customerInstrumentsData ?? []) as CustomerInstrument[];
  const internalInstruments =
    (internalInstrumentsData ?? []) as InternalInstrument[];
  const referenceInstruments =
    (referenceInstrumentsData ?? []) as ReferenceInstrument[];

  return (
    <AppShell>
      <div className="space-y-6">
        <NewVerificationHeader
          title="Nuova verifica temperatura"
          description={
            verificationScope === "VI"
              ? "Crea una nuova verifica VI per strumenti o sistemi di temperatura interni, con strumento aziendale, campione di riferimento e rapportino tecnico."
              : "Crea una nuova verifica VT per strumenti o sistemi di temperatura cliente, con strumento in prova, campione di riferimento e snapshot tecnico."
          }
          verificationScope={verificationScope}
          basePath="/nuova-verifica/temperatura"
          showScopeSwitch
        />

        {(customersError ||
          customerInstrumentsError ||
          internalInstrumentsError ||
          referenceInstrumentsError) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-bold">Errore caricamento dati iniziali</p>
            {customersError && <p>Clienti: {customersError.message}</p>}
            {customerInstrumentsError && (
              <p>Strumenti cliente: {customerInstrumentsError.message}</p>
            )}
            {internalInstrumentsError && (
              <p>Strumenti interni: {internalInstrumentsError.message}</p>
            )}
            {referenceInstrumentsError && (
              <p>
                Strumenti campione: {referenceInstrumentsError.message}
              </p>
            )}
          </div>
        )}

        <TemperatureVerificationStarter
          verificationScope={verificationScope}
          customers={customers}
          customerInstruments={customerInstruments}
          internalInstruments={internalInstruments}
          referenceInstruments={referenceInstruments}
        />
      </div>
    </AppShell>
  );
}