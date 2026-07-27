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
  status: string | null;
  report_status: string | null;
  verification_date: string | null;
  operator_name: string | null;
  location: string | null;
  customer_instrument_snapshot: GenericRecord | null;
  created_at: string | null;
};

type ReportDetails = {
  calibration_record_id: string;
  main_report_number: string | null;
  customer_name: string | null;
  site_description: string | null;
  work_object: string | null;
  test_date: string | null;
  report_date: string | null;
};

type VerificationRow = {
  record: CalibrationRecord;
  details: ReportDetails | null;
};

type VerificationTypeConfig = {
  measuresPathTemplate: string;
};

const VERIFICATION_TYPE_CONFIG: Record<string, VerificationTypeConfig> = {
  CT_FORCE: { measuresPathTemplate: "/verifiche/:id/misure" },
  PRESSURE: { measuresPathTemplate: "/verifiche/:id/misure-pressione" },
  TORQUE: { measuresPathTemplate: "/verifiche/:id/misure-dinamometria" },
  FLOW: { measuresPathTemplate: "/verifiche/:id/misure-portata" },
  MASS: { measuresPathTemplate: "/verifiche/:id/misure-massa" },
  SCLEROMETRIC: { measuresPathTemplate: "/verifiche/:id/misure-sclerometro" },
  TEMPERATURE: { measuresPathTemplate: "/verifiche/:id/misure-temperatura" },
  DIMENSIONAL: { measuresPathTemplate: "/verifiche/:id/misure-dimensionale" },
  PULLOFF: { measuresPathTemplate: "/verifiche/:id/misure-pulloff" },
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

function getVerificationModule(row: VerificationRow) {
  if (row.record.verification_module) {
    return row.record.verification_module;
  }

  if (row.record.mode === "pressione") return "PRESSURE";
  if (row.record.mode === "dinamometria") return "TORQUE";
  if (row.record.mode === "portata") return "FLOW";
  if (row.record.mode === "massa") return "MASS";
  if (row.record.mode === "sclerometro") return "SCLEROMETRIC";
  if (row.record.mode === "temperatura") return "TEMPERATURE";
  if (row.record.mode === "dimensionale") return "DIMENSIONAL";
  if (row.record.mode === "pulloff") return "PULLOFF";

  return "CT_FORCE";
}

function getVerificationTypeConfig(module: string) {
  return VERIFICATION_TYPE_CONFIG[module] ?? null;
}

function buildVerificationPath(template: string, id: string) {
  return template.replace(":id", id);
}

function getVerificationScope(row: VerificationRow) {
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

function isInternalVerification(row: VerificationRow) {
  return getVerificationScope(row) === "VI";
}

function getDetailsHref(row: VerificationRow) {
  if (!row.record.id) return "/verifiche";
  if (isInternalVerification(row)) {
    return "/verifiche/" + row.record.id + "/rapportino-interno";
  }
  return "/verifiche/" + row.record.id + "/rapporto";
}

function getFinalHref(row: VerificationRow) {
  if (!row.record.id) return "/verifiche";
  if (isInternalVerification(row)) {
    return "/verifiche/" + row.record.id + "/rapportino-interno";
  }
  return "/verifiche/" + row.record.id + "/rapporto/finale";
}

function getMeasuresHref(row: VerificationRow) {
  if (!row.record.id) return "/verifiche";

  const config = getVerificationTypeConfig(getVerificationModule(row));

  if (!config) {
    return "/verifiche/" + row.record.id + "/misure";
  }

  return buildVerificationPath(config.measuresPathTemplate, row.record.id);
}

function moduleLabel(row: VerificationRow) {
  const module = getVerificationModule(row);
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

function getCustomerLabel(row: VerificationRow) {
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

function getInstrumentLabel(row: VerificationRow) {
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

function getRecordNumber(row: VerificationRow) {
  return (
    row.details?.main_report_number ||
    row.record.record_number ||
    "SENZA NUMERO"
  );
}

function getDisplayDate(row: VerificationRow) {
  return (
    row.details?.test_date ||
    row.details?.report_date ||
    row.record.verification_date ||
    row.record.created_at
  );
}

function matchesSearch(row: VerificationRow, query: string) {
  if (!query) return true;

  const searchableText = [
    getRecordNumber(row),
    getCustomerLabel(row),
    getInstrumentLabel(row),
    moduleLabel(row),
    getVerificationScope(row),
    row.record.operator_name,
    row.record.status,
    row.record.report_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

export default function VerifichePage() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("tutti");
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
          "id, record_number, mode, verification_module, verification_scope, verified_instrument_type, output_type, status, report_status, verification_date, operator_name, location, customer_instrument_snapshot, created_at"
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
            "calibration_record_id, main_report_number, customer_name, site_description, work_object, test_date, report_date"
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
      });
  }, [query, rows, scopeFilter]);

  const total = rows.length;
  const vtCount = rows.filter((row) => getVerificationScope(row) === "VT").length;
  const viCount = rows.filter((row) => getVerificationScope(row) === "VI").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">
              Archivio operativo
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Verifiche elaborate
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Elenco completo delle verifiche VT e VI. Da qui accedi a misure,
              dati rapporto, rapporto finale e rapportino interno.
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

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="Totali" value={total} />
          <SummaryCard label="VT" value={vtCount} tone="emerald" />
          <SummaryCard label="VI" value={viCount} tone="sky" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca per cliente, strumento, numero, tecnico..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="tutti">Tutte</option>
              <option value="VT">Solo VT</option>
              <option value="VI">Solo VI</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden xl:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[140px] px-3 py-3">N. documento</th>
                  <th className="w-[85px] px-3 py-3">Tipo</th>
                  <th className="w-[210px] px-3 py-3">Cliente / interno</th>
                  <th className="px-3 py-3">Strumento</th>
                  <th className="w-[120px] px-3 py-3">Data</th>
                  <th className="w-[115px] px-3 py-3">Stato</th>
                  <th className="w-[275px] px-3 py-3 text-right">Azioni</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Caricamento verifiche...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nessuna verifica trovata.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isVI = isInternalVerification(row);

                    return (
                      <tr key={row.record.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 align-top">
                          <p className="font-bold text-slate-950">
                            {getRecordNumber(row)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {moduleLabel(row)}
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
                              href={getMeasuresHref(row)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Misure
                            </Link>

                            {!isVI && (
                              <Link
                                href={getDetailsHref(row)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Dati
                              </Link>
                            )}

                            <Link
                              href={getFinalHref(row)}
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
                Caricamento verifiche...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nessuna verifica trovata.
              </div>
            ) : (
              filteredRows.map((row) => {
                const isVI = isInternalVerification(row);

                return (
                  <article key={row.record.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {getRecordNumber(row)}
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
                        href={getMeasuresHref(row)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                      >
                        Misure
                      </Link>

                      <Link
                        href={getFinalHref(row)}
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
  tone?: "slate" | "emerald" | "sky";
}) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
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
