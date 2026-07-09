import Link from "next/link";
import AppShell from "@/components/AppShell";
import DeleteCalibrationRecordButton from "@/components/DeleteCalibrationRecordButton";
import {
  buildVerificationPath,
  getVerificationModuleFromMode,
  getVerificationTypeConfig,
} from "@/lib/verification-types";
import { supabase } from "@/lib/supabase";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    stato?: string;
    tipo?: string;
  }>;
};

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  mode: string | null;
  verification_date: string;
  operator_name: string | null;
  location: string | null;
  status: string | null;
  report_status: string | null;
  verification_module: string | null;
  issued_at: string | null;
  reopened_at: string | null;
  customer_instrument_snapshot: Record<string, unknown> | null;
  reference_instrument_snapshot: Record<string, unknown> | null;
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

type VerificationRow = {
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

function reportStatusLabel(status: string | null | undefined) {
  if (status === "draft") return "Bozza";
  if (status === "ready") return "Pronto";
  if (status === "issued") return "Emesso";
  if (status === "reopened") return "Da correggere";

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

function getCustomerName(row: VerificationRow) {
  return (
    row.details?.customer_name ||
    getSnapshotText(row.record.customer_instrument_snapshot, "customer_name") ||
    "-"
  );
}

function getSiteName(row: VerificationRow) {
  return (
    row.details?.site_description ||
    getSnapshotText(row.record.customer_instrument_snapshot, "site_name") ||
    "-"
  );
}

function getInstrumentLabel(row: VerificationRow) {
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
  const internalCode = getSnapshotText(
    row.record.customer_instrument_snapshot,
    "internal_code"
  );

  const firstLine = [instrumentName, manufacturer, model]
    .filter(Boolean)
    .join(" - ");

  const secondLine = [
    internalCode ? "Cod. " + internalCode : "",
    serialNumber ? "Mat. " + serialNumber : "",
  ]
    .filter(Boolean)
    .join(" · ");

  if (!firstLine && !secondLine) {
    return "-";
  }

  if (firstLine && secondLine) {
    return firstLine + " · " + secondLine;
  }

  return firstLine || secondLine;
}

function getReferenceInstrumentLabel(row: VerificationRow) {
  const name = getSnapshotText(row.record.reference_instrument_snapshot, "name");
  const internalCode = getSnapshotText(
    row.record.reference_instrument_snapshot,
    "internal_code"
  );
  const range = getSnapshotText(
    row.record.reference_instrument_snapshot,
    "measurement_range"
  );

  return [name, internalCode, range].filter(Boolean).join(" - ") || "-";
}

function getReportNumber(row: VerificationRow) {
  const reportNumber = row.details?.main_report_number?.trim();

  if (reportNumber) {
    return reportNumber;
  }

  return "SENZA NUMERO";
}

function getVerificationModule(row: VerificationRow) {
  return (
    row.record.verification_module ||
    getVerificationModuleFromMode(row.record.mode)
  );
}

function getVerificationShortTitle(row: VerificationRow) {
  const config = getVerificationTypeConfig(getVerificationModule(row));

  return config?.shortTitle || modeLabel(row.record.mode);
}

function getMeasuresHref(row: VerificationRow) {
  const config = getVerificationTypeConfig(getVerificationModule(row));

  if (!config) {
    return "/verifiche/" + row.record.id + "/misure";
  }

  return buildVerificationPath(config.measuresPathTemplate, row.record.id);
}

function matchesSearch(row: VerificationRow, query: string) {
  if (!query) {
    return true;
  }

  const searchableText = [
    row.record.record_number,
    row.record.mode,
    row.record.operator_name,
    row.record.location,
    row.record.status,
    row.record.report_status,
    row.details?.main_report_number,
    row.details?.customer_name,
    row.details?.site_description,
    row.details?.work_object,
    row.details?.technician_name,
    getSnapshotText(row.record.customer_instrument_snapshot, "customer_name"),
    getSnapshotText(row.record.customer_instrument_snapshot, "site_name"),
    getSnapshotText(row.record.customer_instrument_snapshot, "instrument_name"),
    getSnapshotText(row.record.customer_instrument_snapshot, "manufacturer"),
    getSnapshotText(row.record.customer_instrument_snapshot, "model"),
    getSnapshotText(row.record.customer_instrument_snapshot, "serial_number"),
    getSnapshotText(row.record.customer_instrument_snapshot, "internal_code"),
    getSnapshotText(row.record.reference_instrument_snapshot, "name"),
    getSnapshotText(row.record.reference_instrument_snapshot, "internal_code"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function matchesStatus(row: VerificationRow, status: string) {
  if (!status || status === "lavorazione") {
    return row.record.report_status !== "issued";
  }

  if (status === "tutti") {
    return true;
  }

  const currentStatus = row.record.report_status || "draft";

  return currentStatus === status;
}

function matchesType(row: VerificationRow, type: string) {
  if (!type || type === "tutti") {
    return true;
  }

  if (type === "CT_FORCE") {
    return getVerificationModule(row) === "CT_FORCE";
  }

  if (type === "PRESSURE") {
    return getVerificationModule(row) === "PRESSURE";
  }

  if (type === "TORQUE") {
    return getVerificationModule(row) === "TORQUE";
  }

  if (type === "FLOW") {
    return getVerificationModule(row) === "FLOW";
  }

  return row.record.mode === type;
}

function ClickableCell({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={className}>
      <Link href={href} className="block h-full w-full px-3 py-3">
        {children}
      </Link>
    </td>
  );
}

export default async function VerificationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const q = normalizeSearch(resolvedSearchParams.q || "");
  const stato = resolvedSearchParams.stato || "lavorazione";
  const tipo = resolvedSearchParams.tipo || "tutti";

  const { data: recordsData, error: recordsError } = await supabase
    .from("calibration_records")
    .select(
      `
      id,
      record_number,
      mode,
      verification_date,
      operator_name,
      location,
      status,
      report_status,
      verification_module,
      issued_at,
      reopened_at,
      customer_instrument_snapshot,
      reference_instrument_snapshot
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
        site_description,
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

  const allRows = records.map((record) => ({
    record,
    details: detailsByRecordId.get(record.id) ?? null,
  }));

  const rows = allRows
    .filter((row) => matchesSearch(row, q))
    .filter((row) => matchesStatus(row, stato))
    .filter((row) => matchesType(row, tipo));

  const workingCount = allRows.filter(
    (row) => row.record.report_status !== "issued"
  ).length;
  const draftCount = allRows.filter(
    (row) => !row.record.report_status || row.record.report_status === "draft"
  ).length;
  const readyCount = allRows.filter(
    (row) => row.record.report_status === "ready"
  ).length;
  const reopenedCount = allRows.filter(
    (row) => row.record.report_status === "reopened"
  ).length;
  const issuedCount = allRows.filter(
    (row) => row.record.report_status === "issued"
  ).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">
              Verifiche
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Elenco operativo delle verifiche in lavorazione. Clicca una riga
              per aprire i dati rapporto.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/rapporti"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Archivio rapporti
            </Link>

            <Link
              href="/nuova-verifica"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Nuova verifica
            </Link>
          </div>
        </div>

        {(recordsError || detailsErrorMessage) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            {recordsError && (
              <p>Errore caricamento verifiche: {recordsError.message}</p>
            )}
            {detailsErrorMessage && (
              <p>Errore caricamento dati rapporto: {detailsErrorMessage}</p>
            )}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              In lavorazione
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {workingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bozze
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {draftCount}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Pronte
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {readyCount}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Da correggere
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {reopenedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Emesse
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {issuedCount}
            </p>
          </div>
        </section>

        <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_auto]">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Cerca
              </span>
              <input
                name="q"
                defaultValue={resolvedSearchParams.q || ""}
                placeholder="Cliente, strumento, matricola, tecnico, numero..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Stato
              </span>
              <select
                name="stato"
                defaultValue={stato}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="lavorazione">In lavorazione</option>
                <option value="tutti">Tutte</option>
                <option value="draft">Bozza</option>
                <option value="ready">Pronto</option>
                <option value="reopened">Da correggere</option>
                <option value="issued">Emesso</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Tipo
              </span>
              <select
                name="tipo"
                defaultValue={tipo}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="tutti">Tutti</option>
                <option value="CT_FORCE">Compressione / trazione</option>
                <option value="PRESSURE">Pressione</option>
                <option value="TORQUE">Chiavi dinamometriche</option>
                <option value="FLOW">Portata / contalitri</option>
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
                href="/verifiche"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden xl:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[145px] px-3 py-3">Verifica</th>
                  <th className="w-[180px] px-3 py-3">Cliente / sede</th>
                  <th className="px-3 py-3">Strumenti</th>
                  <th className="w-[100px] px-3 py-3">Data</th>
                  <th className="w-[120px] px-3 py-3">Tecnico</th>
                  <th className="w-[95px] px-3 py-3">Stato</th>
                  <th className="w-[310px] px-3 py-3 text-right">Azioni</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nessuna verifica trovata.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const detailsHref =
                      "/verifiche/" + row.record.id + "/rapporto";
                    const measuresHref = getMeasuresHref(row);
                    const finalHref =
                      "/verifiche/" + row.record.id + "/rapporto/finale";
                    const isIssued = row.record.report_status === "issued";

                    return (
                      <tr
                        key={row.record.id}
                        className="group hover:bg-slate-50"
                      >
                        <ClickableCell href={detailsHref} className="align-top">
                          <p className="font-semibold leading-tight text-slate-950 group-hover:underline">
                            {row.record.record_number || "-"}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            Rapporto: {getReportNumber(row)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {getVerificationShortTitle(row)}
                          </p>
                        </ClickableCell>

                        <ClickableCell href={detailsHref} className="align-top">
                          <p className="truncate font-medium text-slate-900">
                            {getCustomerName(row)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {getSiteName(row)}
                          </p>
                        </ClickableCell>

                        <ClickableCell href={detailsHref} className="align-top">
                          <p className="truncate text-slate-700">
                            {getInstrumentLabel(row)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            Campione: {getReferenceInstrumentLabel(row)}
                          </p>
                        </ClickableCell>

                        <ClickableCell href={detailsHref} className="align-top">
                          {formatItalianDate(row.record.verification_date)}
                        </ClickableCell>

                        <ClickableCell href={detailsHref} className="align-top">
                          <span className="block leading-tight">
                            {row.details?.technician_name ||
                              row.record.operator_name ||
                              "-"}
                          </span>
                        </ClickableCell>

                        <ClickableCell href={detailsHref} className="align-top">
                          <span
                            className={
                              "inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold " +
                              reportStatusClass(row.record.report_status)
                            }
                          >
                            {reportStatusLabel(row.record.report_status)}
                          </span>
                        </ClickableCell>

                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-nowrap justify-end gap-1.5">
                            <Link
                              href={measuresHref}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Misure
                            </Link>

                            <Link
                              href={detailsHref}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Dati
                            </Link>

                            <Link
                              href={finalHref}
                              className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                            >
                              Rapporto
                            </Link>

                            <DeleteCalibrationRecordButton
                              recordId={row.record.id}
                              recordLabel={row.record.record_number || "senza numero"}
                              isIssued={isIssued}
                            />
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
            {rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nessuna verifica trovata.
              </div>
            ) : (
              rows.map((row) => {
                const detailsHref = "/verifiche/" + row.record.id + "/rapporto";
                const measuresHref = getMeasuresHref(row);
                const finalHref =
                  "/verifiche/" + row.record.id + "/rapporto/finale";
                const isIssued = row.record.report_status === "issued";

                return (
                  <article key={row.record.id} className="p-4">
                    <Link href={detailsHref} className="block">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {row.record.record_number || "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatItalianDate(row.record.verification_date)} ·{" "}
                            {getVerificationShortTitle(row)}
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
                        Rapporto: {getReportNumber(row)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Tecnico:{" "}
                        {row.details?.technician_name ||
                          row.record.operator_name ||
                          "-"}
                      </p>
                    </Link>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        href={measuresHref}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Misure
                      </Link>

                      <Link
                        href={detailsHref}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Dati
                      </Link>

                      <Link
                        href={finalHref}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                      >
                        Rapporto
                      </Link>

                      <DeleteCalibrationRecordButton
                        recordId={row.record.id}
                        recordLabel={row.record.record_number || "senza numero"}
                        isIssued={isIssued}
                      />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <p>
            <strong>Nota:</strong> l’eliminazione è disabilitata per i rapporti
            emessi. Il pulsante “Misure” apre i dati tecnici della verifica; “Dati” apre i dati
            del rapporto; “Rapporto” apre l’anteprima finale.
          </p>
        </section>
      </div>
    </AppShell>
  );
}