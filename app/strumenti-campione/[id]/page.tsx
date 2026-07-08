import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditReferenceInstrumentForm from "@/components/EditReferenceInstrumentForm";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ReferenceInstrument = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  resolution: string | null;
  certificate_number: string | null;
  certificate_date: string | null;
  certificate_expiry: string | null;
  certificate_file_url: string | null;
  certificate_file_name: string | null;
  status: string;
  notes: string | null;
};

export default async function ReferenceInstrumentDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("reference_instruments")
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
      resolution,
      certificate_number,
      certificate_date,
      certificate_expiry,
      certificate_file_url,
      certificate_file_name,
      status,
      notes
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link
            href="/strumenti-campione"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti campione
          </Link>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-bold">Errore caricamento strumento campione</p>
            <p className="mt-2">{error.message}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link
            href="/strumenti-campione"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti campione
          </Link>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-bold">Strumento campione non trovato</p>
            <p className="mt-2">
              Il link aperto non corrisponde a uno strumento presente nel database.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const instrument = data as ReferenceInstrument;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/strumenti-campione"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti campione
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Modifica strumento campione
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Aggiorna dati anagrafici, stato, certificato, file certificato e
            scadenza dello strumento campione.
          </p>
        </div>

        <EditReferenceInstrumentForm instrument={instrument} />
      </div>
    </AppShell>
  );
}
