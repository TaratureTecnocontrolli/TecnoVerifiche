"use client";

import LabSiteSelect from "@/components/LabSiteSelect";
import {matchesSite} from "@/lib/lab-sites";
import Link from "next/link";
import { useMemo, useState } from "react";

export type InternalInstrumentMeasurementListItem = {
  id: string;
  measurement_quantity: string;
  unit: string | null;
  measurement_range: string | null;
  resolution: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type InternalInstrumentListItem = {
  id: string;
  lab_site?: string|null;
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
  created_at: string;
  measurements: InternalInstrumentMeasurementListItem[];
};

function formatItalianDate(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function statusLabel(status: string) {
  if (status === "active") return "Attivo";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";
  return status;
}

function statusClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "out_of_service") return "bg-amber-100 text-amber-800";
  if (status === "dismissed") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function measurementSummary(instrument: InternalInstrumentListItem) {
  if (instrument.measurements.length === 0) {
    return instrument.measurement_quantity
      ? `${instrument.measurement_quantity}${instrument.unit ? ` (${instrument.unit})` : ""}`
      : "-";
  }

  return instrument.measurements
    .map((measurement) =>
      `${measurement.measurement_quantity}${measurement.unit ? ` (${measurement.unit})` : ""}`
    )
    .join(" · ");
}

function rangeSummary(instrument: InternalInstrumentListItem) {
  if (instrument.measurements.length === 0) {
    return instrument.measurement_range ?? "-";
  }

  return instrument.measurements
    .map((measurement) => measurement.measurement_range || "-")
    .join(" · ");
}

function searchableInstrumentText(instrument: InternalInstrumentListItem) {
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
      ...instrument.measurements.flatMap((measurement) => [
        measurement.measurement_quantity,
        measurement.unit,
        measurement.measurement_range,
        measurement.resolution,
      ]),
      instrument.location,
      instrument.department,
      statusLabel(instrument.status),
      instrument.status,
      instrument.is_active ? "attivo" : "non attivo",
      instrument.notes,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export default function InternalInstrumentsSearchTable({
  instruments,
}: {
  instruments: InternalInstrumentListItem[];
}) {
  const [search, setSearch] = useState("");
  const [site,setSite]=useState("all");
  const normalizedSearch = normalizeSearchText(search);

  const filteredInstruments = useMemo(() => instruments.filter(instrument=>matchesSite(instrument.lab_site,site)&&(!normalizedSearch||searchableInstrumentText(instrument).includes(normalizedSearch))),[instruments,normalizedSearch,site]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Elenco strumenti interni</h2>
            <p className="text-sm text-slate-500">
              Totale strumenti trovati: {filteredInstruments.length}
              {filteredInstruments.length !== instruments.length ? " su " + instruments.length : ""}
            </p>
          </div>
          <LabSiteSelect value={site} onChange={setSite} filter/>
          <label className="w-full max-w-md space-y-1">
            <span className="text-sm font-medium text-slate-700">Cerca</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca strumento, codice, matricola, grandezza, unità..." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100" />
          </label>
        </div>
      </div>

      {instruments.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">Nessuno strumento interno registrato.</div>
      ) : filteredInstruments.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">Nessuno strumento interno trovato con la ricerca inserita.</div>
      ) : (
        <div className="overflow-x-auto tc-sticky-table" tabIndex={0} role="region" aria-label="Tabella scorrevole">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Strumento</th>
                <th className="px-4 py-3">Codice</th>
                <th className="px-4 py-3">Matricola</th>
                <th className="px-4 py-3">Grandezze</th>
                <th className="px-4 py-3">Campi</th>
                <th className="px-4 py-3">Reparto</th>
                <th className="px-4 py-3">Ubicazione</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Inserito il</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInstruments.map((instrument) => (
                <tr key={instrument.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/strumenti-interni/${instrument.id}`} className="font-semibold text-slate-900 hover:text-red-700 hover:underline">{instrument.name}</Link><div className="text-xs text-slate-500">{instrument.lab_site||"Da assegnare"}</div>
                    <p className="text-xs text-slate-500">{[instrument.manufacturer, instrument.model].filter(Boolean).join(" - ") || "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{instrument.internal_code ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{instrument.serial_number ?? "-"}</td>
                  <td className="max-w-[330px] px-4 py-3 text-slate-700">{measurementSummary(instrument)}</td>
                  <td className="max-w-[280px] px-4 py-3 text-slate-700">{rangeSummary(instrument)}</td>
                  <td className="px-4 py-3 text-slate-700">{instrument.department ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{instrument.location ?? "-"}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(instrument.status)}`}>{statusLabel(instrument.status)}</span></td>
                  <td className="px-4 py-3 text-slate-600">{formatItalianDate(instrument.created_at)}</td>
                  <td className="px-4 py-3"><Link href={`/strumenti-interni/${instrument.id}`} className="text-sm font-semibold text-slate-700 hover:text-red-700 hover:underline">Apri</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
