import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  getVerificationModuleFromMode,
  getVerificationTypeConfig,
} from "@/lib/verification-types";
import { supabase } from "@/lib/supabase";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    stato?: string;
  }>;
};

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  mode: string | null;
  verification_module: string | null;
  verification_date: string;
  operator_name: string | null;
  status: string | null;
  report_status: string | null;
  issued_at: string | null;
  reopened_at: string | null;
  customer_instrument_snapshot: Record<string, unknown> | null;
};

type ReportDetails = {
  calibration_record_id: string;
  main_report_number: string | null;
  report_date: string | null;
  test_date: string | null;
  customer_name: string | null;
  work_object: string | null;
  technician_name: string | null;
};

type ReportRow = {
  record: CalibrationRecord;
  details: ReportDetails | null;
};

function getSnapshotText(
  snapshot: Record<string, unknown> | null,
  key: string
): string {
  const value = snapshot?.[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function formatItalianDate(date: string | null | undefined) {
  if (!date) {
    return "-";
  }

  const parts = date.split("T")[0].split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return date;
}

function modeLabel(mode: string | null) {
  if (mode === "compressione") return "Compressione";
  if (mode === "trazione") return "Trazione";
  if (mode === "pressione") return "Pressione";

  return mode || "-";
}

function getVerificationModule(record: CalibrationRecord) {
  return record.verification_module || getVerificationModuleFromMode(record.mode);
}

function verificationTypeLabel(record: CalibrationRecord) {
  const config = getVerificationTypeConfig(getVerificationModule(record));

  return config?.shortTitle || modeLabel(record.mode);
}

function reportStatusLabel(status: string | null | undefined) {
  if (status === "draft") return "Bozza";
  if (status === "ready") return "Pronto per emissione";
  if (status === "issued") return "Emesso";
  if (status === "reopened") return "Da correggere / riaperto";

  return "Bozza";
}

function reportStatusClass(status: string | null | undefined) {
  if (status === "issued") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "ready") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (status === "reopened") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(row: ReportRow, query: string) {
  if (!query) {
    return true;
  }

  const record = row.record;
  const details = row.details;

  const searchableText = [
    record.record_number,
    record.mode,
    record.verification_module,
    verificationTypeLabel(record),
    record.operator_name,
    record.status,
    record.report_status,
    details?.main_report_number,
    details?.customer_name,
    details?.work_object,
    details?.technician_name,
    getSnapshotText(record.customer_instrument_snapshot, "customer_number"),
    getSnapshotText(record.customer_instrument_snapshot, "customer_name"),
    getSnapshotText(record.customer_instrument_snapshot, "site_name"),
    getSnapshotText(record.customer_instrument_snapshot, "instrument_name"),
    getSnapshotText(record.customer_instrument_snapshot, "manufacturer"),
    getSnapshotText(record.customer_instrument_snapshot, "model"),
    getSnapshotText(record.customer_instrument_snapshot, "serial_number"),
    getSnapshotText(record.customer_instrument_snapshot, "internal_code"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function matchesStatus(row: ReportRow, status: string) {
  if (!status || status === "tutti") {
    return true;
  }

  const currentStatus = row.record.report_status || "draft";

  return currentStatus === status;
}

function getCustomerName(row: ReportRow) {
  return (
    row.details?.customer_name ||
    getSnapshotText(row.record.customer_instrument_snapshot, "customer_name") ||
    "-"
  );
}

function getCustomerNumber(row: ReportRow) {
  return (
    getSnapshotText(row.record.customer_instrument_snapshot, "customer_number") ||
    "-"
  );
}

function getInstrumentLabel(row: ReportRow) {
  const instrumentName = getSnapshotText(
    row.record.customer_instrument_snapshot,
    "instrument_name"
  );
  const manufacturer = getSnapshotText(
    row.record.customer_instrument_snapshot,
    "manufacturer"
  );
  const model = getSnapshotText(row.record.customer_instrument_snapshot, "model");
  const serialNumber = getSnapshotText(
    row.record.customer_instrument_snapshot,
    "serial_number"
  );

  const firstLine = [instrumentName, manufacturer, model]
    .filter(Boolean)
    .join(" - ");

  if (!firstLine && !serialNumber) {
    return "-";
  }

  if (serialNumber) {
    return firstLine ? firstLine + " - Mat. " + serialNumber : "Mat. " + serialNumber;
  }

  return firstLine;
}

function getReportNumber(row: ReportRow) {
  const reportNumber = row.details?.main_report_number?.trim();

  if (reportNumber) {
    return reportNumber;
  }

  return "SENZA NUMERO";
}

export default async function ReportsArchivePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const q = normalizeSearch(resolvedSearchParams.q || "");
  const stato = resolvedSearchParams.stato || "tutti";

  const { data: recordsData, error: recordsError } = await supabase
    .from("calibration_records")
    .select(
      `
      id,
      record_number,
      mode,
      verification_module,
      verification_date,
      operator_name,
      status,
      report_status,
      issued_at,
      reopened_at,
      customer_instrument_snapshot
    `
    )
    .order("verification_date", { ascending: false })
    .limit(200);

  const records = (recordsData ?? []) as CalibrationRecord[];
  const recordIds = records.map((record) => record.id);

  let details: ReportDetails[] = [];
  let detailsErrorMessage = "";

  if (recordIds.length > 0) {
    const { data: detailsData, error: detailsError } = await supabase
      .from("calibration_report_details")
      .select(
        `
        calibration_record_id,
        main_report_number,
        report_date,
        test_date,
        customer_name,
        work_object,
        technician_name
      `
      )
      .in("calibration_record_id", recordIds);

    if (detailsError) {
      detailsErrorMessage = detailsError.message;
    } else {
      details = (detailsData ?? []) as ReportDetails[];
    }
  }

  const detailsByRecordId = new Map(
    details.map((item) => [item.calibration_record_id, item])
  );

  const rows = records
    .map((record) => ({
      record,
      details: detailsByRecordId.get(record.id) ?? null,
    }))
    .filter((row) => matchesSearch(row, q))
    .filter((row) => matchesStatus(row, stato));

  const totalCount = rows.length;
  const issuedCount = rows.filter(
    (row) => row.record.report_status === "issued"
  ).length;
  const readyCount = rows.filter(
    (row) => row.record.report_status === "ready"
  ).length;
  const draftCount = rows.filter(
    (row) => !row.record.report_status || row.record.report_status === "draft"
  ).length;
  const reopenedCount = rows.filter(
    (row) => row.record.report_status === "reopened"
  ).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">
              Archivio rapporti
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Vista riepilogativa dei rapporti generati dal gestionale:
              compressione/trazione e pressione/manometri, con struttura unica
              per le prossime tipologie.
            </p>
          </div>

          <Link
            href="/nuova-verifica"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Nuova verifica
          </Link>
        </div>

        {(recordsError || detailsErrorMessage) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            {recordsError && <p>Errore caricamento rapporti: {recordsError.message}</p>}
            {detailsErrorMessage && (
              <p>Errore caricamento dati rapporto: {detailsErrorMessage}</p>
            )}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Totali
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{totalCount}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bozze
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{draftCount}</p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Pronti
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{readyCount}</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Emessi
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {issuedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Riaperti
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {reopenedCount}
            </p>
          </div>
        </section>

        <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Cerca
              </span>
              <input
                name="q"
                defaultValue={resolvedSearchParams.q || ""}
                placeholder="Cliente, strumento, matricola, numero rapporto..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Stato rapporto
              </span>
              <select
                name="stato"
                defaultValue={stato}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="tutti">Tutti</option>
                <option value="draft">Bozza</option>
                <option value="ready">Pronto per emissione</option>
                <option value="issued">Emesso</option>
                <option value="reopened">Da correggere / riaperto</option>
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Filtra
              </button>

              <Link
                href="/rapporti"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rapporto</th>
                  <th className="px-4 py-3">N. cliente</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Strumento</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Data prova</th>
                  <th className="px-4 py-3">Tecnico</th>
                  <th className="px-4 py-3">Stato</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Nessun rapporto trovato.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.record.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950">
                          {getReportNumber(row)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Verifica interna: {row.record.record_number || "-"}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {getCustomerName(row)}
                        </p>
                        {row.details?.work_object && (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                            {row.details.work_object}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-slate-700">
                          {getInstrumentLabel(row)}
                        </p>
                      </td>

                      <td className="px-4 py-3">{verificationTypeLabel(row.record)}</td>

                      <td className="px-4 py-3">
                        {formatItalianDate(
                          row.details?.test_date || row.record.verification_date
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {row.details?.technician_name || row.record.operator_name || "-"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold " +
                            reportStatusClass(row.record.report_status)
                          }
                        >
                          {reportStatusLabel(row.record.report_status)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          href={"/verifiche/" + row.record.id + "/rapporto/finale"}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          Apri
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nessun rapporto trovato.
              </div>
            ) : (
              rows.map((row) => (
                <article key={row.record.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {getReportNumber(row)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatItalianDate(
                          row.details?.test_date || row.record.verification_date
                        )}{" "}
                        · {verificationTypeLabel(row.record)}
                      </p>
                    </div>

                    <span
                      className={
                        "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold " +
                        reportStatusClass(row.record.report_status)
                      }
                    >
                      {reportStatusLabel(row.record.report_status)}
                    </span>
                  </div>

                  <p className="mt-3 font-medium text-slate-900">
                    {getCustomerName(row)}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {getInstrumentLabel(row)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Tecnico:{" "}
                    {row.details?.technician_name || row.record.operator_name || "-"}
                  </p>

                  <Link
                    href={"/verifiche/" + row.record.id + "/rapporto/finale"}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Apri rapporto
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
