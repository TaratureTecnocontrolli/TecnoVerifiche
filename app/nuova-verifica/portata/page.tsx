import Link from "next/link";
import AppShell from "@/components/AppShell";
import FlowVerificationStarter from "@/components/FlowVerificationStarter";
import { supabase } from "@/lib/supabase";

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
  site_id?: string | null;
  site?: string | null;
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

function scopeLabel(scope: VerificationScope) {
  if (scope === "VI") {
    return "VI - Verifica interna";
  }

  return "VT - Verifica/Taratura cliente";
}

function scopeDescription(scope: VerificationScope) {
  if (scope === "VI") {
    return "Flusso per verifica interna di strumenti aziendali di portata/volume, con inserimento immediato dei cicli e rapportino tecnico finale.";
  }

  return "Flusso per verifica/taratura di strumenti cliente di portata/volume, con inserimento immediato dei cicli e rapporto finale.";
}

export default async function NewFlowVerificationPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const verificationScope = resolveScope(resolvedSearchParams.scope);

  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select("*")
    .eq("is_active", true)
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
        <div>
          <Link
            href="/nuova-verifica"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna alla scelta modulo
          </Link>

          <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div
                className={
                  "inline-flex rounded-b-xl px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white " +
                  (verificationScope === "VI" ? "bg-sky-700" : "bg-emerald-700")
                }
              >
                {scopeLabel(verificationScope)}
              </div>

              <h1 className="mt-5 text-3xl font-bold text-slate-950">
                Nuova verifica portata / contalitri
              </h1>

              <p className="mt-2 max-w-3xl text-slate-600">
                {scopeDescription(verificationScope)}
              </p>
            </div>

            <div
              className={
                "rounded-2xl border px-4 py-3 text-sm " +
                (verificationScope === "VI"
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900")
              }
            >
              <p className="font-semibold">
                Processo selezionato: {verificationScope}
              </p>
              <p className="mt-1">
                {verificationScope === "VI"
                  ? "Strumento interno + rapportino tecnico"
                  : "Cliente + rapporto finale"}
              </p>
            </div>
          </div>
        </div>

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
              <p>Strumenti campione: {referenceInstrumentsError.message}</p>
            )}
          </div>
        )}

        <FlowVerificationStarter
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
