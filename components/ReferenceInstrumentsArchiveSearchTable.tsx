"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DeleteReferenceInstrumentButton from "@/components/DeleteReferenceInstrumentButton";

export type ReferenceInstrumentListItem = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  certificate_number: string | null;
  certificate_date: string | null;
  certificate_expiry: string | null;
  certificate_file_url: string | null;
  certificate_file_name: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

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

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function searchableInstrumentText(instrument: ReferenceInstrumentListItem) {
  const realStatus = effectiveStatus(
    instrument.status,
    instrument.certificate_expiry
  );

  return normalizeSearchText(
    [
      instrument.name,
      instrument.manufacturer,
      instrument.model,
      instrument.serial_number,
      instrument.internal_code,
      instrument.measurement_quantity,
      instrument.unit,
      instrument.measurement_range,
      instrument.certificate_number,
      instrument.certificate_date,
      instrument.certificate_expiry,
      instrument.certificate_file_name,
      statusLabel(realStatus),
      realStatus,
      expiryLabel(instrument.certificate_expiry),
      instrument.notes,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export default function ReferenceInstrumentsArchiveSearchTable({
  instruments,
}: {
  instruments: ReferenceInstrumentListItem[];
}) {
  const [search, setSearch] = useState("");

  const normalizedSearch = normalizeSearchText(search);

  const filteredInstruments = useMemo(() => {
    if (!normalizedSearch) {
      return instruments;
    }

    return instruments.filter((instrument) =>
      searchableInstrumentText(instrument).includes(normalizedSearch)
    );
  }, [instruments, normalizedSearch]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Archivio completo strumenti campione
            </h2>
            <p className="text-sm text-slate-500">
              Totale strumenti trovati: {filteredInstruments.length}
              {filteredInstruments.length !== instruments.length
                ? " su " + instruments.length
                : ""}
            </p>
          </div>

          <label className="w-full max-w-md space-y-1">
            <span className="text-sm font-medium text-slate-700">Cerca</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca campione, codice, matricola, certificato, scadenza..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />
          </label>
        </div>
      </div>

      {instruments.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Nessuno strumento campione registrato.
        </div>
      ) : filteredInstruments.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Nessuno strumento campione trovato con la ricerca inserita.
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Strumento</th>
                <th className="px-4 py-3">Codice</th>
                <th className="px-4 py-3">Matricola</th>
                <th className="px-4 py-3">Grandezza</th>
                <th className="px-4 py-3">Fondo scala</th>
                <th className="px-4 py-3">Certificato</th>
                <th className="px-4 py-3">Scadenza</th>
                <th className="px-4 py-3">Giorni</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredInstruments.map((instrument) => {
                const realStatus = effectiveStatus(
                  instrument.status,
                  instrument.certificate_expiry
                );

                return (
                  <tr key={instrument.id} className="hover:bg-slate-50">
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

                    <td className="px-4 py-3 align-top text-slate-700">
                      {[instrument.measurement_quantity, instrument.unit]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>

                    <td className="px-4 py-3 align-top text-slate-700">
                      {instrument.measurement_range ?? "-"}
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

                    <td className="px-4 py-3 align-top text-slate-700">
                      {expiryLabel(instrument.certificate_expiry)}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          realStatus
                        )}`}
                      >
                        {statusLabel(realStatus)}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/strumenti-campione/${instrument.id}`}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Modifica
                        </Link>

                        <DeleteReferenceInstrumentButton
                          instrumentId={instrument.id}
                          instrumentName={instrument.name}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}