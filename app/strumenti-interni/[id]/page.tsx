import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditInternalInstrumentForm from "@/components/EditInternalInstrumentForm";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
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

function statusLabel(status: string) {
  if (status === "active") return "Attivo";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";

  return status;
}

function statusClass(status: string) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (status === "out_of_service") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (status === "dismissed") {
    return "border-slate-300 bg-slate-100 text-slate-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function DataBox({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value || "-"}</p>
    </div>
  );
}

export default async function InternalInstrumentDetailPage({ params }: PageProps) {
  const { id } = await params;

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
      is_active
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link
            href="/strumenti-interni"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti interni
          </Link>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-bold">Errore caricamento strumento interno</p>
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
            href="/strumenti-interni"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti interni
          </Link>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-bold">Strumento interno non trovato</p>
            <p className="mt-2">
              Il link aperto non corrisponde a uno strumento interno presente
              nel database.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const instrument = data as InternalInstrument;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/strumenti-interni"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti interni
          </Link>

          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">
                Modifica strumento interno
              </h1>

              <p className="mt-2 max-w-3xl text-slate-600">
                Aggiorna dati anagrafici e caratteristiche metrologiche dello
                strumento interno utilizzato nelle VI.
              </p>
            </div>

            <div
              className={
                "w-fit rounded-2xl border px-4 py-3 text-sm " +
                statusClass(instrument.status)
              }
            >
              <p className="font-semibold">
                Stato: {statusLabel(instrument.status)}
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Riepilogo strumento
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DataBox label="Nome" value={instrument.name} />
            <DataBox label="Codice interno" value={instrument.internal_code} />
            <DataBox label="Costruttore" value={instrument.manufacturer} />
            <DataBox label="Modello" value={instrument.model} />
            <DataBox label="Matricola" value={instrument.serial_number} />
            <DataBox label="Grandezza" value={instrument.measurement_quantity} />
            <DataBox label="Unità" value={instrument.unit} />
            <DataBox label="Fondo scala" value={instrument.measurement_range} />
            <DataBox label="Reparto" value={instrument.department} />
            <DataBox label="Ubicazione" value={instrument.location} />
          </div>
        </section>

        <EditInternalInstrumentForm instrument={instrument} />
      </div>
    </AppShell>
  );
}