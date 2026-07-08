import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type CalibrationRecord = {
  id: string;
  status: string | null;
  report_status: string | null;
};

type ReferenceInstrument = {
  id: string;
  status: string;
  certificate_expiry: string | null;
  certificate_file_url: string | null;
};

function daysToExpiry(date: string | null) {
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(date);
  expiry.setHours(0, 0, 0, 0);

  const differenceMs = expiry.getTime() - today.getTime();

  return Math.ceil(differenceMs / (1000 * 60 * 60 * 24));
}

function isReferenceInstrumentExpiring(instrument: ReferenceInstrument) {
  if (instrument.status === "out_of_service") {
    return false;
  }

  const days = daysToExpiry(instrument.certificate_expiry);

  if (days === null) {
    return false;
  }

  return days >= 0 && days <= 30;
}

function isReferenceInstrumentExpired(instrument: ReferenceInstrument) {
  if (instrument.status === "out_of_service") {
    return false;
  }

  const days = daysToExpiry(instrument.certificate_expiry);

  if (days === null) {
    return false;
  }

  return days < 0;
}

export default async function HomePage() {
  const { data: recordsData } = await supabase
    .from("calibration_records")
    .select("id, status, report_status");

  const { data: referenceInstrumentsData } = await supabase
    .from("reference_instruments")
    .select("id, status, certificate_expiry, certificate_file_url");

  const records = (recordsData ?? []) as CalibrationRecord[];
  const referenceInstruments =
    (referenceInstrumentsData ?? []) as ReferenceInstrument[];

  const draftRecords = records.filter((record) => {
    return (
      record.status === "draft" ||
      record.report_status === "draft" ||
      record.report_status === "reopened"
    );
  }).length;

  const issuedReports = records.filter((record) => {
    return record.report_status === "issued";
  }).length;

  const expiringReferences = referenceInstruments.filter(
    isReferenceInstrumentExpiring
  ).length;

  const expiredReferences = referenceInstruments.filter(
    isReferenceInstrumentExpired
  ).length;

  const missingCertificateFiles = referenceInstruments.filter(
    (instrument) => !instrument.certificate_file_url
  ).length;

  return (
    <AppShell>
      <div className="space-y-8">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Gestionale interno
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            TecnoTarature
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Software interno per la gestione delle verifiche di taratura,
            elaborazione dei risultati, calcoli, grafici, certificati e
            tracciabilità tecnica.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <Link
            href="/verifiche"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">Verifiche in bozza</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {draftRecords}
            </p>
          </Link>

          <Link
            href="/rapporti"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">Rapporti emessi</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {issuedReports}
            </p>
          </Link>

          <Link
            href="/strumenti-campione"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-medium text-amber-900">
              Campioni in scadenza
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {expiringReferences}
            </p>
          </Link>

          <Link
            href="/strumenti-campione"
            className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-medium text-red-900">
              Campioni scaduti
            </p>
            <p className="mt-2 text-3xl font-bold text-red-900">
              {expiredReferences}
            </p>
          </Link>

          <Link
            href="/strumenti-campione"
            className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-medium text-orange-900">
              Certificati mancanti
            </p>
            <p className="mt-2 text-3xl font-bold text-orange-900">
              {missingCertificateFiles}
            </p>
          </Link>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <Link
            href="/nuova-verifica"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Avvio guidato
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Nuova verifica
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Scegli il tipo di verifica: CT, pressione o moduli futuri.
            </p>
          </Link>

          <Link
            href="/verifiche"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Lavorazioni
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Verifiche aperte
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Riprendi verifiche in bozza, completa misure e genera rapporti.
            </p>
          </Link>
        </section>

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/clienti"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-bold text-slate-950">Clienti</h2>
            <p className="mt-2 text-sm text-slate-600">
              Anagrafiche, numero cliente e sedi.
            </p>
          </Link>

          <Link
            href="/strumenti-cliente"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-bold text-slate-950">
              Strumenti cliente
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Strumenti da verificare e dati tecnici.
            </p>
          </Link>

          <Link
            href="/strumenti-campione"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-bold text-slate-950">
              Strumenti campione
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Campioni, certificati, scadenze e stato operativo.
            </p>
          </Link>

          <Link
            href="/tecnici-firme"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-bold text-slate-950">
              Tecnici e firme
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Firme digitalizzate e direttore predefinito.
            </p>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
