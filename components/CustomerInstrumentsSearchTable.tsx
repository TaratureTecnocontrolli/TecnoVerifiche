"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DeleteCustomerInstrumentButton from "@/components/DeleteCustomerInstrumentButton";

export type CustomerInstrumentListItem = {
  id: string;
  customer_name: string | null;
  site: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  notes: string | null;
  created_at: string;
};

function formatItalianDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function searchableInstrumentText(instrument: CustomerInstrumentListItem) {
  return normalizeSearchText(
    [
      instrument.customer_name,
      instrument.site,
      instrument.name,
      instrument.manufacturer,
      instrument.model,
      instrument.serial_number,
      instrument.internal_code,
      instrument.measurement_quantity,
      instrument.unit,
      instrument.measurement_range,
      instrument.notes,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export default function CustomerInstrumentsSearchTable({
  instruments,
}: {
  instruments: CustomerInstrumentListItem[];
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Elenco strumenti cliente
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
              placeholder="Cerca cliente, strumento, matricola, modello, grandezza..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />
          </label>
        </div>
      </div>

      {instruments.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Nessuno strumento cliente registrato.
        </div>
      ) : filteredInstruments.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Nessuno strumento cliente trovato con la ricerca inserita.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Strumento</th>
                <th className="px-4 py-3">Codice</th>
                <th className="px-4 py-3">Matricola</th>
                <th className="px-4 py-3">Grandezza</th>
                <th className="px-4 py-3">Fondo scala</th>
                <th className="px-4 py-3">Inserito il</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredInstruments.map((instrument) => (
                <tr key={instrument.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {instrument.customer_name ?? "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {instrument.site ?? "-"}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={"/strumenti-cliente/" + instrument.id}
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

                  <td className="px-4 py-3 text-slate-700">
                    {instrument.internal_code ?? "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {instrument.serial_number ?? "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {[instrument.measurement_quantity, instrument.unit]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {instrument.measurement_range ?? "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {formatItalianDate(instrument.created_at)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={"/strumenti-cliente/" + instrument.id}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Modifica
                      </Link>

                      <DeleteCustomerInstrumentButton
                        instrumentId={instrument.id}
                        instrumentName={instrument.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}