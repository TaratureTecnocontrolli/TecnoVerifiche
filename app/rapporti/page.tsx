"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type GenericRecord = Record<string, any>;

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  mode: string | null;
  verification_module: string | null;
  verification_scope: string | null;
  verified_instrument_type: string | null;
  output_type: string | null;
  verification_date: string | null;
  operator_name: string | null;
  location: string | null;
  status: string | null;
  report_status: string | null;
  issued_at: string | null;
  reopened_at: string | null;
  customer_instrument_snapshot: GenericRecord | null;
  created_at: string | null;
};

type ReportDetails = {
  calibration_record_id: string;
  main_report_number: string | null;
  report_date: string | null;
  test_date: string | null;
  customer_name: string | null;
  site_description: string | null;
  work_object: string | null;
  technician_name: string | null;
};

type ReportRow = {
  record: CalibrationRecord;
  details: ReportDetails | null;
};

function textValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function snapshotText(snapshot: GenericRecord | null, key: string) {
  const value = snapshot?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function formatItalianDate(date: string | null | undefined) {
  if (!date) return "-";

  const dateOnly = date.split("T")[0];
  const parts = dateOnly.split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return date;
}

function getVerificationScope(row: ReportRow) {
  const valuesToCheck = [
    row.record.verification_scope,
    row.record.output_type,
    row.record.verified_instrument_type,
    row.record.mode,
    row.details?.work_object,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const isVI = valuesToCheck.some((value) => {
    return (
      value === "vi" ||
      value === "interno" ||
      value === "interna" ||
      value === "internal" ||
      value === "rapportino" ||
      value === "rapportino interno" ||
      value.includes("verifica interna") ||
      value.includes("rapportino interno")
    );
  });

  return isVI ? "VI" : "VT";
}

function isInternalVerification(row: ReportRow) {
  return getVerificationScope(row) === "VI";
}

function moduleLabel(row: ReportRow) {
  const module = row.record.verification_module;
  const mode = row.record.mode;

  if (module === "PRESSURE" || mode === "pressione") return "Pressione";
  if (module === "TORQUE" || mode === "dinamometria") return "Coppia";
  if (module === "FLOW" || mode === "portata") return "Portata";
  if (module === "MASS" || mode === "massa") return "Massa";
  if (module === "SCLEROMETRIC" || mode === "sclerometro") return "Sclerometro";
  if (module === "TEMPERATURE" || mode === "temperatura") return "Temperatura";
  if (module === "DIMENSIONAL" || mode === "dimensionale") return "Dimensionale";
  if (module === "PULLOFF" || mode === "pulloff") return "Pull-off";
  if (mode === "trazione") return "Trazione";
  return "Compressione";
}

function reportStatusLabel(status: string | null | undefined) {
  if (status === "draft") return "Bozza";
  if (status === "ready") return "Pronto";
  if (status === "issued") return "Emesso";
  if (status === "reopened") return "Da correggere";
  return "Bozza";
}

function reportStatusClass(status: string | null | undefined) {
  if (status === "issued") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "ready") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "reopened") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getDocumentNumber(row: ReportRow) {
  return (
    row.details?.main_report_number ||
    row.record.record_number ||
    "SENZA NUMERO"
  );
}

function getCustomerLabel(row: ReportRow) {
  if (isInternalVerification(row)) {
    return row.details?.customer_name || "Tecnocontrolli S.r.l. / Interno";
  }

  return (
    row.details?.customer_name ||
    snapshotText(row.record.customer_instrument_snapshot, "customer_name") ||
    snapshotText(row.record.customer_instrument_snapshot, "business_name") ||
    "-"
  );
}

function getInstrumentLabel(row: ReportRow) {
  const snapshot = row.record.customer_instrument_snapshot;
  const name =
    snapshotText(snapshot, "instrument_name") ||
    snapshotText(snapshot, "name") ||
    snapshotText(snapshot, "description");

  const manufacturer = snapshotText(snapshot, "manufacturer");
  const model = snapshotText(snapshot, "model");
  const serialNumber = snapshotText(snapshot, "serial_number");
  const internalCode = snapshotText(snapshot, "internal_code");

  const firstLine = [name, manufacturer, model].filter(Boolean).join(" - ");
  const secondLine = [
    internalCode ? "Cod. " + internalCode : "",
    serialNumber ? "Mat. " + serialNumber : "",
  ]
    .filter(Boolean)
    .join(" · ");

  if (firstLine && secondLine) return firstLine + " · " + secondLine;
  return firstLine || secondLine || "-";
}

function getDocumentHref(row: ReportRow) {
  if (isInternalVerification(row)) {
    return "/verifiche/" + row.record.id + "/rapportino-interno";
  }

  return "/verifiche/" + row.record.id + "/rapporto/finale";
}

function getEditHref(row: ReportRow) {
  if (isInternalVerification(row)) {
    return "/verifiche/" + row.record.id + "/rapportino-interno";
  }

  return "/verifiche/" + row.record.id + "/rapporto";
}

function getDisplayDate(row: ReportRow) {
  return (
    row.details?.report_date ||
    row.details?.test_date ||
    row.record.verification_date ||
    row.record.created_at
  );
}

function matchesSearch(row: ReportRow, query: string) {
  if (!query) return true;

  const searchableText = [
    getDocumentNumber(row),
    getVerificationScope(row),
    getCustomerLabel(row),
    getInstrumentLabel(row),
    moduleLabel(row),
    row.record.operator_name,
    row.details?.technician_name,
    row.record.report_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

export default function ReportsArchivePage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("tutti");
  const [statusFilter, setStatusFilter] = useState("tutti");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage("");

      const { data: recordsData, error: recordsError } = await supabase
        .from("calibration_records")
        .select(
          "id, record_number, mode, verification_module, verification_scope, verified_instrument_type, output_type, verification_date, operator_name, location, status, report_status, issued_at, reopened_at, customer_instrument_snapshot, created_at"
        )
        .order("created_at", { ascending: false });

      if (recordsError) {
        if (isMounted) {
          setErrorMessage(recordsError.message);
          setRows([]);
          setIsLoading(false);
        }
        return;
      }

      const records = (recordsData ?? []) as CalibrationRecord[];
      const recordIds = records.map((record) => record.id);

      let details: ReportDetails[] = [];

      if (recordIds.length > 0) {
        const { data: detailsData, error: detailsError } = await supabase
          .from("calibration_report_details")
          .select(
            "calibration_record_id, main_report_number, report_date, test_date, customer_name, site_description, work_object, technician_name"
          )
          .in("calibration_record_id", recordIds);

        if (detailsError) {
          if (isMounted) {
            setErrorMessage(detailsError.message);
          }
        } else {
          details = (detailsData ?? []) as ReportDetails[];
        }
      }

      const detailsByRecordId = new Map(
        details.map((item) => [item.calibration_record_id, item])
      );

      const nextRows = records.map((record) => ({
        record,
        details: detailsByRecordId.get(record.id) ?? null,
      }));

      if (isMounted) {
        setRows(nextRows);
        setIsLoading(false);
      }
    }

    void loadRows();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((row) => matchesSearch(row, normalizedQuery))
      .filter((row) => {
        if (scopeFilter === "tutti") return true;
        return getVerificationScope(row) === scopeFilter;
      })
      .filter((row) => {
        if (statusFilter === "tutti") return true;
        return (row.record.report_status || "draft") === statusFilter;
      });
  }, [query, rows, scopeFilter, statusFilter]);

  const total = rows.length;
  const issuedCount = rows.filter((row) => row.record.report_status === "issued").length;
  const draftCount = rows.filter(
    (row) => !row.record.report_status || row.record.report_status === "draft"
  ).length;
  const readyCount = rows.filter((row) => row.record.report_status === "ready").length;
  const reopenedCount = rows.filter((row) => row.record.report_status === "reopened").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">
              Documenti
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Archivio rapporti
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Vista unica di rapporti VT e rapportini VI, con stato documento e
              accesso rapido ad anteprima e dati.
            </p>
          </div>

          <Link
            href="/nuova-verifica"
            className="inline-flex w-fit items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            Nuova verifica
          </Link>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
            {errorMessage}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-5">
          <SummaryCard label="Totali" value={total} />
          <SummaryCard label="Bozze" value={draftCount} />
          <SummaryCard label="Pronti" value={readyCount} tone="blue" />
          <SummaryCard label="Emessi" value={issuedCount} tone="emerald" />
          <SummaryCard label="Da correggere" value={reopenedCount} tone="amber" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_170px_170px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca per numero, cliente, strumento, tecnico..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="tutti">VT + VI</option>
              <option value="VT">Solo VT</option>
              <option value="VI">Solo VI</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="tutti">Tutti gli stati</option>
              <option value="draft">Bozza</option>
              <option value="ready">Pronto</option>
              <option value="issued">Emesso</option>
              <option value="reopened">Da correggere</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden xl:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[155px] px-3 py-3">N. documento</th>
                  <th className="w-[85px] px-3 py-3">Tipo</th>
                  <th className="w-[220px] px-3 py-3">Cliente / interno</th>
                  <th className="px-3 py-3">Strumento</th>
                  <th className="w-[115px] px-3 py-3">Data</th>
                  <th className="w-[115px] px-3 py-3">Stato</th>
                  <th className="w-[210px] px-3 py-3 text-right">Azioni</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Caricamento rapporti...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nessun rapporto trovato.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isVI = isInternalVerification(row);

                    return (
                      <tr key={row.record.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 align-top">
                          <p className="font-black text-slate-950">
                            {getDocumentNumber(row)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {isVI ? "Rapportino interno" : "Rapporto finale"}
                          </p>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <span
                            className={
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-black " +
                              (isVI
                                ? "border-sky-200 bg-sky-50 text-sky-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800")
                            }
                          >
                            {getVerificationScope(row)}
                          </span>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="truncate font-semibold text-slate-900">
                            {getCustomerLabel(row)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {textValue(row.details?.site_description ?? row.record.location)}
                          </p>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="truncate text-slate-800">
                            {getInstrumentLabel(row)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {moduleLabel(row)}
                          </p>
                        </td>

                        <td className="px-3 py-3 align-top">
                          {formatItalianDate(getDisplayDate(row))}
                        </td>

                        <td className="px-3 py-3 align-top">
                          <span
                            className={
                              "inline-flex rounded-full border px-2 py-1 text-[11px] font-bold " +
                              reportStatusClass(row.record.report_status)
                            }
                          >
                            {reportStatusLabel(row.record.report_status)}
                          </span>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={getEditHref(row)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              {isVI ? "Firme" : "Dati"}
                            </Link>

                            <Link
                              href={getDocumentHref(row)}
                              className={
                                "rounded-lg px-3 py-1.5 text-xs font-bold text-white " +
                                (isVI
                                  ? "bg-sky-700 hover:bg-sky-600"
                                  : "bg-slate-950 hover:bg-slate-800")
                              }
                            >
                              {isVI ? "Rapportino" : "Rapporto"}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 xl:hidden">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Caricamento rapporti...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nessun rapporto trovato.
              </div>
            ) : (
              filteredRows.map((row) => {
                const isVI = isInternalVerification(row);

                return (
                  <article key={row.record.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {getDocumentNumber(row)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatItalianDate(getDisplayDate(row))} · {moduleLabel(row)}
                        </p>
                      </div>

                      <span
                        className={
                          "rounded-full border px-2.5 py-1 text-xs font-black " +
                          (isVI
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800")
                        }
                      >
                        {getVerificationScope(row)}
                      </span>
                    </div>

                    <p className="mt-3 font-semibold text-slate-900">
                      {getCustomerLabel(row)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {getInstrumentLabel(row)}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        href={getEditHref(row)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                      >
                        {isVI ? "Firme" : "Dati"}
                      </Link>

                      <Link
                        href={getDocumentHref(row)}
                        className={
                          "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-bold text-white " +
                          (isVI ? "bg-sky-700" : "bg-slate-950")
                        }
                      >
                        {isVI ? "Rapportino" : "Rapporto"}
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "blue" | "amber";
}) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <div className={"rounded-2xl border p-4 shadow-sm " + classes[tone]}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}
