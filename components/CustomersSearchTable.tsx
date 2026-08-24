"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CustomerListItem = {
  id: string;
  customer_number: string | null;
  business_name: string;
  vat_number: string | null;
  tax_code: string | null;
  city: string | null;
  province: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  is_active: boolean;
  created_at: string;
  customer_sites:
    | {
        id: string;
        name: string;
        city: string | null;
        province: string | null;
      }[]
    | null;
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

function searchableCustomerText(customer: CustomerListItem) {
  return normalizeSearchText(
    [
      customer.customer_number,
      customer.business_name,
      customer.vat_number,
      customer.tax_code,
      customer.city,
      customer.province,
      customer.email,
      customer.phone,
      customer.contact_person,
      customer.is_active ? "attivo" : "non attivo",
      ...(customer.customer_sites ?? []).flatMap((site) => [
        site.name,
        site.city,
        site.province,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export default function CustomersSearchTable({
  customers,
}: {
  customers: CustomerListItem[];
}) {
  const [search, setSearch] = useState("");

  const normalizedSearch = normalizeSearchText(search);

  const filteredCustomers = useMemo(() => {
    if (!normalizedSearch) {
      return customers;
    }

    return customers.filter((customer) =>
      searchableCustomerText(customer).includes(normalizedSearch)
    );
  }, [customers, normalizedSearch]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Elenco clienti
            </h2>
            <p className="text-sm text-slate-500">
              Totale clienti trovati: {filteredCustomers.length}
              {filteredCustomers.length !== customers.length
                ? " su " + customers.length
                : ""}
            </p>
          </div>

          <label className="w-full max-w-md space-y-1">
            <span className="text-sm font-medium text-slate-700">Cerca</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca cliente, P.IVA, referente, città, sede..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />
          </label>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Nessun cliente registrato.
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Nessun cliente trovato con la ricerca inserita.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">N. cliente</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">P.IVA / C.F.</th>
                <th className="px-4 py-3">Località</th>
                <th className="px-4 py-3">Referente</th>
                <th className="px-4 py-3">Contatti</th>
                <th className="px-4 py-3">Sedi</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Inserito il</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {customer.customer_number || "-"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={"/clienti/" + customer.id}
                      className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {customer.business_name}
                    </Link>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <p>{customer.vat_number ?? "-"}</p>
                    <p className="text-xs text-slate-500">
                      {customer.tax_code ?? "-"}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {[customer.city, customer.province]
                      .filter(Boolean)
                      .join(" (") + (customer.province ? ")" : "") || "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {customer.contact_person ?? "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <p>{customer.email ?? "-"}</p>
                    <p className="text-xs text-slate-500">
                      {customer.phone ?? "-"}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {customer.customer_sites?.length ?? 0}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        customer.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {customer.is_active ? "Attivo" : "Non attivo"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {formatItalianDate(customer.created_at)}
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={"/clienti/" + customer.id}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Modifica
                    </Link>
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