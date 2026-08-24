import Link from "next/link";
import AppShell from "@/components/AppShell";
import TemperatureVerificationStarter from "@/components/TemperatureVerificationStarter";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

export default async function NewTemperatureVerificationPage() {
  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select("*")
    .order("business_name", { ascending: true });

  const { data: customerInstrumentsData, error: customerInstrumentsError } =
    await supabase
      .from("customer_instruments")
      .select("*")
      .order("name", { ascending: true });

  const { data: referenceInstrumentsData, error: referenceInstrumentsError } =
    await supabase
      .from("reference_instruments")
      .select("*")
      .order("name", { ascending: true });

  const customers = (customersData ?? []) as Customer[];
  const customerInstruments =
    (customerInstrumentsData ?? []) as CustomerInstrument[];
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

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Nuova verifica temperatura
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Crea una nuova verifica in bozza per il monitoraggio della
            temperatura di un ambiente. In questo primo passaggio vengono
            salvati cliente, strumento in prova, termometro di riferimento e
            snapshot tecnico. Il log delle misure giornaliere si compila nel
            passaggio successivo.
          </p>
        </div>

        {(customersError ||
          customerInstrumentsError ||
          referenceInstrumentsError) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-bold">Errore caricamento dati iniziali</p>
            {customersError && <p>Clienti: {customersError.message}</p>}
            {customerInstrumentsError && (
              <p>Strumenti cliente: {customerInstrumentsError.message}</p>
            )}
            {referenceInstrumentsError && (
              <p>
                Strumenti campione: {referenceInstrumentsError.message}
              </p>
            )}
          </div>
        )}

        <TemperatureVerificationStarter
          customers={customers}
          customerInstruments={customerInstruments}
          referenceInstruments={referenceInstruments}
        />
      </div>
    </AppShell>
  );
}

