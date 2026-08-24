import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditReferenceInstrumentForm from "@/components/EditReferenceInstrumentForm";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

function getEffectiveStatus(status: string, certificateExpiry: string | null) {
  if (status === "dismissed") {
    return "dismissed";
  }

  if (status === "out_of_service") {
    return "out_of_service";
  }

  if (!certificateExpiry) {
    return "valid";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(certificateExpiry);
  expiry.setHours(0, 0, 0, 0);

  if (expiry.getTime() < today.getTime()) {
    return "expired";
  }

  const differenceDays = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (differenceDays <= 30) {
    return "expiring";
  }

  return "valid";
}

function statusLabel(status: string) {
  if (status === "valid") return "Operativo";
  if (status === "expiring") return "In scadenza";
  if (status === "expired") return "Disattivato per certificato scaduto";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";

  return status;
}

function statusClass(status: string) {
  if (status === "valid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (status === "expiring") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (status === "expired") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  if (status === "out_of_service") {
    return "border-orange-200 bg-orange-50 text-orange-900";
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

  const effectiveStatus = getEffectiveStatus(
    instrument.status,
    instrument.certificate_expiry
  );

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

          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">
                Modifica strumento campione
              </h1>

              <p className="mt-2 max-w-3xl text-slate-600">
                Aggiorna dati anagrafici, stato, certificato attualmente valido
                e storico certificati dello strumento campione.
              </p>
            </div>

            <div
              className={
                "w-fit rounded-2xl border px-4 py-3 text-sm " +
                statusClass(effectiveStatus)
              }
            >
              <p className="font-semibold">
                Stato effettivo: {statusLabel(effectiveStatus)}
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
            <DataBox
              label="Grandezza"
              value={instrument.measurement_quantity}
            />
            <DataBox label="Unità" value={instrument.unit} />
            <DataBox label="Fondo scala" value={instrument.measurement_range} />
          </div>
        </section>

        <EditReferenceInstrumentForm instrument={instrument} />
      </div>
    </AppShell>
  );
}
