import Link from "next/link";
import AppShell from "@/components/AppShell";
import ReferenceInstrumentsArchiveSearchTable, {
  type ReferenceInstrumentListItem,
} from "@/components/ReferenceInstrumentsArchiveSearchTable";
import DeleteReferenceInstrumentButton from "@/components/DeleteReferenceInstrumentButton";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type ReferenceInstrument = ReferenceInstrumentListItem;

type ExpiryBucket =
  | "out_of_service"
  | "expired"
  | "within_30"
  | "within_60"
  | "missing_expiry"
  | "valid";

function formatItalianDate(date: string | null) {
  if (!date) {
    return "-";


}

  const parts = date.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

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

function effectiveStatus(status: string, certificateExpiry: string | null) {
  if (status === "dismissed") {
    return "dismissed";
  }

  if (status === "out_of_service") {
    return "out_of_service";
  }

  const days = daysToExpiry(certificateExpiry);

  if (days === null) {
    return status || "valid";
  }

  if (days < 0) {
    return "expired";
  }

  if (days <= 30) {
    return "expiring";
  }

  return "valid";
}

function statusLabel(status: string) {
  if (status === "valid") return "Operativo";
  if (status === "expiring") return "In scadenza";
  if (status === "expired") return "Disattivato";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";

  return status;
}

function statusClass(status: string) {
  if (status === "valid") return "bg-emerald-100 text-emerald-800";
  if (status === "expiring") return "bg-amber-100 text-amber-800";
  if (status === "expired") return "bg-red-100 text-red-800";
  if (status === "out_of_service") return "bg-slate-200 text-slate-700";
  if (status === "dismissed") return "bg-zinc-200 text-zinc-800";

  return "bg-slate-100 text-slate-700";
}

function expiryLabel(date: string | null) {
  const days = daysToExpiry(date);

  if (days === null) {
    return "Scadenza non indicata";
  }

  if (days < 0) {
    return `Scaduto da ${Math.abs(days)} giorni`;
  }

  if (days === 0) {
    return "Scade oggi";
  }

  return `Scade tra ${days} giorni`;
}

function getBucket(instrument: ReferenceInstrument): ExpiryBucket {
  if (instrument.status === "out_of_service") {
    return "out_of_service";
  }

  const days = daysToExpiry(instrument.certificate_expiry);

  if (days === null) {
    return "missing_expiry";
  }

  if (days < 0) {
    return "expired";
  }

  if (days <= 30) {
    return "within_30";
  }

  if (days <= 60) {
    return "within_60";
  }

  return "valid";
}

function bucketLabel(bucket: ExpiryBucket) {
  if (bucket === "out_of_service") return "Fuori servizio";
  if (bucket === "expired") return "Scaduto";
  if (bucket === "within_30") return "Entro 30 giorni";
  if (bucket === "within_60") return "Entro 60 giorni";
  if (bucket === "missing_expiry") return "Senza scadenza";
  return "Valido";
}

function bucketClass(bucket: ExpiryBucket) {
  if (bucket === "out_of_service") {
    return "border-slate-300 bg-slate-100 text-slate-800";
  }

  if (bucket === "expired") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  if (bucket === "within_30") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (bucket === "within_60") {
    return "border-yellow-200 bg-yellow-50 text-yellow-900";
  }

  if (bucket === "missing_expiry") {
    return "border-orange-200 bg-orange-50 text-orange-900";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function sortByPriority(a: ReferenceInstrument, b: ReferenceInstrument) {
  const bucketOrder: Record<ExpiryBucket, number> = {
    out_of_service: 0,
    expired: 1,
    within_30: 2,
    within_60: 3,
    missing_expiry: 4,
    valid: 5,
  };

  const bucketDifference = bucketOrder[getBucket(a)] - bucketOrder[getBucket(b)];

  if (bucketDifference !== 0) {
    return bucketDifference;
  }

  const daysA = daysToExpiry(a.certificate_expiry);
  const daysB = daysToExpiry(b.certificate_expiry);

  if (daysA === null && daysB === null) {
    return a.name.localeCompare(b.name);
  }

  if (daysA === null) return 1;
  if (daysB === null) return -1;

  return daysA - daysB;
}

function CertificateCell({
  certificateNumber,
  certificateDate,
  certificateFileUrl,
}: {
  certificateNumber: string | null;
  certificateDate: string | null;
  certificateFileUrl: string | null;
}) {
  return (
    <div className="space-y-1">
      <div className="font-medium text-slate-800">
        {certificateNumber ?? "-"}
      </div>

      <div className="text-xs text-slate-500">
        {formatItalianDate(certificateDate)}
      </div>

      <div className="pt-1">
        {certificateFileUrl ? (
          <a
            href={certificateFileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Apri certificato
          </a>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </div>
    </div>
  );
}

export default async function ReferenceInstrumentsPage() {
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
      certificate_number,
      certificate_date,
      certificate_expiry,
      certificate_file_url,
      certificate_file_name,
      status,
      notes,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  const instruments = (data ?? []) as ReferenceInstrument[];
  const sortedByPriority = [...instruments].sort(sortByPriority);

  const validCount = instruments.filter(
    (item) => effectiveStatus(item.status, item.certificate_expiry) === "valid"
  ).length;

  const expiringCount = instruments.filter(
    (item) =>
      effectiveStatus(item.status, item.certificate_expiry) === "expiring"
  ).length;

  const expiredCount = instruments.filter(
    (item) => effectiveStatus(item.status, item.certificate_expiry) === "expired"
  ).length;

  const outOfServiceCount = instruments.filter(
    (item) => item.status === "out_of_service"
  ).length;

  const missingCertificateFileCount = instruments.filter(
    (item) => !item.certificate_file_url
  ).length;

  const criticalInstruments = sortedByPriority.filter((instrument) => {
    const bucket = getBucket(instrument);

    return (
      bucket === "out_of_service" ||
      bucket === "expired" ||
      bucket === "within_30" ||
      bucket === "within_60" ||
      bucket === "missing_expiry" ||
      !instrument.certificate_file_url
    );
  });

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
              Strumenti campione
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Archivio unico degli strumenti campione, con controllo scadenze,
              stato operativo e certificati collegati.
            </p>
          </div>

          <Link
            href="/strumenti-campione/nuovo"
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Nuovo strumento campione
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore nel caricamento strumenti campione: {error.message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Totale</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {instruments.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-900">Operativi</p>
            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {validCount}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-900">In scadenza</p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {expiringCount}
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-red-900">Scaduti</p>
            <p className="mt-2 text-3xl font-bold text-red-900">
              {expiredCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-800">Fuori servizio</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {outOfServiceCount}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-orange-900">
              File mancanti
            </p>
            <p className="mt-2 text-3xl font-bold text-orange-900">
              {missingCertificateFileCount}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-950">
              Da gestire
            </h2>
            <p className="text-sm text-amber-900">
              Qui compaiono solo gli strumenti con criticità: scaduti, in
              scadenza, fuori servizio, senza scadenza o senza file certificato.
            </p>
          </div>

          {criticalInstruments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Nessuna criticità rilevata sugli strumenti campione.
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Priorità</th>
                    <th className="px-4 py-3">Strumento</th>
                    <th className="px-4 py-3">Codice</th>
                    <th className="px-4 py-3">Matricola</th>
                    <th className="px-4 py-3">Certificato</th>
                    <th className="px-4 py-3">Scadenza</th>
                    <th className="px-4 py-3">Giorni</th>
                    <th className="px-4 py-3">Azioni</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {criticalInstruments.map((instrument) => {
                    const bucket = getBucket(instrument);

                    return (
                      <tr key={instrument.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${bucketClass(
                              bucket
                            )}`}
                          >
                            {bucketLabel(bucket)}
                          </span>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <Link
                            href={`/strumenti-campione/${instrument.id}`}
                            className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                          >
                            {instrument.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {[instrument.manufacturer, instrument.model]
                              .filter(Boolean)
                              .join(" - ") || "-"}
                          </p>
                        </td>

                        <td className="px-4 py-3 align-top text-slate-700">
                          {instrument.internal_code ?? "-"}
                        </td>

                        <td className="px-4 py-3 align-top text-slate-700">
                          {instrument.serial_number ?? "-"}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <CertificateCell
                            certificateNumber={instrument.certificate_number}
                            certificateDate={instrument.certificate_date}
                            certificateFileUrl={instrument.certificate_file_url}
                          />
                        </td>

                        <td className="px-4 py-3 align-top text-slate-700">
                          {formatItalianDate(instrument.certificate_expiry)}
                        </td>

                        <td className="px-4 py-3 align-top font-medium text-slate-800">
                          {expiryLabel(instrument.certificate_expiry)}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <Link
                            href={`/strumenti-campione/${instrument.id}`}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                          >
                            Modifica
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ReferenceInstrumentsArchiveSearchTable instruments={instruments} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
          <strong>Regola gestionale:</strong> strumenti scaduti o fuori servizio
          sono bloccati nelle nuove verifiche. Gli strumenti in scadenza possono
          essere usati ma devono essere gestiti per la ritaratura.
        </div>
      </div>
    </AppShell>
  );
}
