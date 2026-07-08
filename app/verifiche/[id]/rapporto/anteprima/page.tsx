import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

const LETTERHEAD_IMAGE_SRC = "/carta_intestata_rev02.png";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  mode: string | null;
  verification_date: string;
  customer_instrument_snapshot: Record<string, unknown> | null;
};

type ReportDetails = {
  id: string;
  calibration_record_id: string;
  main_report_number: string | null;
  technical_annex_number: string | null;
  acceptance_number: string | null;
  acceptance_date: string | null;
  report_date: string | null;
  test_date: string | null;
  customer_name: string | null;
  site_description: string | null;
  work_object: string | null;
  requested_tests: string | null;
  premise_text: string | null;
  scope_text: string | null;
  apparatus_description: string | null;
  execution_method: string | null;
  results_text: string | null;
  temperature: string | null;
  humidity: string | null;
  technician_name: string | null;
  reviewer_name: string | null;
  director_name: string | null;
  instrument_photo_url: string | null;
  notes: string | null;
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

function textToParagraphs(text: string | null) {
  if (!text) {
    return ["-"];
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getSnapshotText(
  snapshot: Record<string, unknown> | null,
  key: string
): string | null {
  const value = snapshot?.[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function buildFormulaText() {
  return [
    "La verifica del punto di gradazione della scala, corrispondente ad un carico letto sull’apparecchio indicatore dei carichi della macchina di prova oggetto della verifica (Fi), viene effettuata leggendo il corrispondente valore effettivo sul dispositivo di verifica, con carico di prova crescente, quando i due sistemi sono in equilibrio.",
    "Per ogni livello di carico l’errore relativo di accuratezza, espresso in percentuale, del carico effettivo medio è dato da:",
    "q = 100 · [(Fi - F̄) ÷ F̄]",
    "L’errore relativo di ripetibilità è dato da:",
    "b = 100 · [(Fmax - Fmin) ÷ F̄]",
    "dove F è il carico effettivo indicato dallo strumento di misura del carico; Fi è il carico letto sull’indicatore della macchina da verificare; F̄ è la media aritmetica delle misure; Fmax e Fmin sono rispettivamente il massimo e il minimo dei valori ottenuti nelle serie di prova.",
  ];
}

function ReportPage({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative mx-auto h-[1123px] w-[794px] overflow-hidden rounded-sm bg-white shadow-lg print:shadow-none">
      <img
        src={LETTERHEAD_IMAGE_SRC}
        alt="Carta intestata Tecnocontrolli"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute left-[62px] right-[62px] top-[132px] bottom-[45px] z-10">
        {children}
      </div>
    </section>
  );
}

function ReportFooter({
  page,
  totalPages,
  reportNumber,
  reportDate,
}: {
  page: number;
  totalPages: number;
  reportNumber: string;
  reportDate: string | null;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-slate-400 bg-white/40 pt-1 text-center text-[8.5px] leading-tight text-slate-950">
      <p>
        Pagina {page} di {totalPages} del Rapporto di Prova {reportNumber} del{" "}
        {formatItalianDate(reportDate)}
      </p>
      <p>
        È vietata la riproduzione del rapporto di prova o di singole parti senza
        l’approvazione del laboratorio Tecnocontrolli S.r.l.
      </p>
    </div>
  );
}

function InstrumentPhotoBox({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <div className="mx-auto flex h-[285px] w-[420px] items-center justify-center border border-slate-300 bg-white/70 text-center text-sm text-slate-500">
        Spazio foto strumento
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[285px] w-[420px] items-center justify-center overflow-hidden border border-slate-300 bg-white">
      <img
        src={imageUrl}
        alt="Foto strumento"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export default async function ReportPreviewPage({ params }: PageProps) {
  const { id } = await params;

  const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select(
      `
      id,
      record_number,
      mode,
      verification_date,
      customer_instrument_snapshot
    `
    )
    .eq("id", id)
    .single();

  if (recordError || !recordData) {
    notFound();
  }

  const record = recordData as CalibrationRecord;

  const { data: reportData, error: reportError } = await supabase
    .from("calibration_report_details")
    .select(
      `
      id,
      calibration_record_id,
      main_report_number,
      technical_annex_number,
      acceptance_number,
      acceptance_date,
      report_date,
      test_date,
      customer_name,
      site_description,
      work_object,
      requested_tests,
      premise_text,
      scope_text,
      apparatus_description,
      execution_method,
      results_text,
      temperature,
      humidity,
      technician_name,
      reviewer_name,
      director_name,
      instrument_photo_url,
      notes
    `
    )
    .eq("calibration_record_id", id)
    .maybeSingle();

  const reportDetails = (reportData ?? null) as ReportDetails | null;

  const instrumentName =
    getSnapshotText(record.customer_instrument_snapshot, "instrument_name") ??
    "macchina";

  const manufacturer =
    getSnapshotText(record.customer_instrument_snapshot, "manufacturer") ?? "";

  const model =
    getSnapshotText(record.customer_instrument_snapshot, "model") ?? "";

  const serialNumber =
    getSnapshotText(record.customer_instrument_snapshot, "serial_number") ?? "";

  const range =
    getSnapshotText(record.customer_instrument_snapshot, "measurement_range") ??
    "";

  const reportNumber =
    reportDetails?.main_report_number ?? record.record_number ?? "-";

  const annexNumber =
    reportDetails?.technical_annex_number ?? record.record_number ?? "-";

  const reportDate = reportDetails?.report_date ?? null;
  const totalPages = 5;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link
              href={`/verifiche/${id}/rapporto`}
              className="text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              ← Torna ai dati rapporto
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              Anteprima rapporto principale
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Anteprima del rapporto principale usando la carta intestata reale
              Tecnocontrolli come sfondo pagina.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/verifiche/${id}/rapporto/allegato`}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Allegato tecnico
            </Link>

            <Link
              href={`/verifiche/${id}/rapporto/finale`}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Anteprima finale
            </Link>

            <button
              type="button"
              disabled
              className="rounded-xl bg-slate-400 px-5 py-2 text-sm font-semibold text-white"
            >
              Genera PDF prossimamente
            </button>
          </div>
        </div>

        {reportError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore caricamento dati rapporto: {reportError.message}
          </div>
        )}

        {!reportDetails && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            I dati rapporto non sono ancora stati salvati. Torna alla pagina
            precedente, compila i dati e salva prima di usare l’anteprima.
          </div>
        )}

        <div className="space-y-8">
          <ReportPage>
            <div className="relative h-full">
              <div className="h-[830px] overflow-hidden">
                <div className="text-right text-sm font-semibold text-slate-900">
                  Calderara di Reno, {formatItalianDate(reportDate)}
                </div>

                <div className="mt-10 space-y-5 text-sm">
                  <div className="grid grid-cols-[190px_1fr] border border-slate-900 bg-white/80">
                    <div className="border-r border-slate-900 p-3 font-bold">
                      RAPPORTO DI PROVA
                    </div>
                    <div className="p-3 font-bold">{reportNumber}</div>
                  </div>

                  <div className="grid grid-cols-[190px_1fr] border border-slate-900 bg-white/80">
                    <div className="border-r border-slate-900 p-3 font-bold">
                      COMMITTENTE
                    </div>
                    <div className="p-3 font-bold">
                      {reportDetails?.customer_name ?? "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-[190px_1fr] border border-slate-900 bg-white/80">
                    <div className="border-r border-slate-900 p-3 font-bold">
                      OGGETTO DEI LAVORI
                    </div>
                    <div className="p-3 font-bold">
                      {reportDetails?.work_object ?? "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-[190px_1fr] border border-slate-900 bg-white/80">
                    <div className="border-r border-slate-900 p-3 font-bold">
                      CANTIERE
                    </div>
                    <div className="p-3 font-bold">
                      {reportDetails?.site_description ?? "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-[190px_1fr] border border-slate-900 bg-white/80">
                    <div className="border-r border-slate-900 p-3 font-bold">
                      PROVE RICHIESTE
                    </div>
                    <div className="p-3 font-bold">
                      {reportDetails?.requested_tests ?? "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-[190px_1fr] border border-slate-900 bg-white/80">
                    <div className="border-r border-slate-900 p-3 font-bold">
                      DATA DELLE PROVE
                    </div>
                    <div className="p-3 font-bold">
                      {reportDetails?.test_date
                        ? formatItalianDate(reportDetails.test_date)
                        : ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-[190px_1fr] border border-slate-900 bg-white/80">
                    <div className="border-r border-slate-900 p-3 font-bold">
                      ACCETTAZIONE INT.
                    </div>
                    <div className="p-3 font-bold">
                      {reportDetails?.acceptance_number ?? "-"}
                      {reportDetails?.acceptance_date
                        ? ` del ${formatItalianDate(
                            reportDetails.acceptance_date
                          )}`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="mt-36 text-center text-sm font-bold">
                  (il presente rapporto di prova si compone di n. 5 pagine)
                </div>
              </div>

              <ReportFooter
                page={1}
                totalPages={totalPages}
                reportNumber={reportNumber}
                reportDate={reportDate}
              />
            </div>
          </ReportPage>

          <ReportPage>
            <div className="relative h-full">
              <main className="h-[830px] overflow-hidden space-y-6 text-sm leading-6 text-slate-900">
                <section>
                  <h2 className="mb-3 font-bold">1. PREMESSA</h2>
                  {textToParagraphs(reportDetails?.premise_text ?? null).map(
                    (paragraph, index) => (
                      <p key={index} className="mb-2">
                        {paragraph}
                      </p>
                    )
                  )}
                </section>

                <InstrumentPhotoBox
                  imageUrl={reportDetails?.instrument_photo_url ?? null}
                />

                <section>
                  <h2 className="mb-3 font-bold">2. SCOPO DELLA PROVA</h2>
                  {textToParagraphs(reportDetails?.scope_text ?? null).map(
                    (paragraph, index) => (
                      <p key={index} className="mb-2 whitespace-pre-line">
                        {paragraph}
                      </p>
                    )
                  )}
                </section>
              </main>

              <ReportFooter
                page={2}
                totalPages={totalPages}
                reportNumber={reportNumber}
                reportDate={reportDate}
              />
            </div>
          </ReportPage>

          <ReportPage>
            <div className="relative h-full">
              <main className="h-[830px] overflow-hidden space-y-5 text-sm leading-6 text-slate-900">
                <section>
                  <h2 className="mb-3 font-bold">
                    3. DESCRIZIONE DELL&apos;APPARATO DI VERIFICA
                  </h2>
                  {textToParagraphs(
                    reportDetails?.apparatus_description ?? null
                  ).map((paragraph, index) => (
                    <p key={index} className="mb-2">
                      {paragraph}
                    </p>
                  ))}
                </section>

                <section>
                  <h2 className="mb-3 font-bold">
                    4. DESCRIZIONE E MODALITA&apos; DI ESECUZIONE DELLA VERIFICA
                    DI TARATURA
                  </h2>
                  {textToParagraphs(
                    reportDetails?.execution_method ?? null
                  ).map((paragraph, index) => (
                    <p key={index} className="mb-2">
                      {paragraph}
                    </p>
                  ))}
                </section>

                <section>
                  <h2 className="mb-3 font-bold">
                    5. ESPRESSIONE DEI RISULTATI
                  </h2>
                  {buildFormulaText().map((paragraph, index) => (
                    <p key={index} className="mb-2">
                      {paragraph}
                    </p>
                  ))}
                </section>
              </main>

              <ReportFooter
                page={3}
                totalPages={totalPages}
                reportNumber={reportNumber}
                reportDate={reportDate}
              />
            </div>
          </ReportPage>

          <ReportPage>
            <div className="relative h-full">
              <main className="h-[830px] overflow-hidden space-y-7 text-sm leading-6 text-slate-900">
                <section>
                  <h2 className="mb-5 font-bold">
                    6. RISULTATI DELLA VERIFICA
                  </h2>

                  <table className="w-full border border-slate-900 bg-white/80 text-center text-sm">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="border border-slate-900 p-2">
                          Temperatura ambientale (°C)
                        </th>
                        <th className="border border-slate-900 p-2">
                          Umidità ambientale (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-900 p-2 font-bold">
                          {reportDetails?.temperature ?? "-"}
                        </td>
                        <td className="border border-slate-900 p-2 font-bold">
                          {reportDetails?.humidity ?? "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-8">
                    {textToParagraphs(reportDetails?.results_text ?? null).map(
                      (paragraph, index) => (
                        <p key={index} className="mb-3">
                          {paragraph}
                        </p>
                      )
                    )}
                  </div>
                </section>

                <section className="mt-12">
                  <table className="w-full border-collapse bg-white/80 text-center text-xs">
                    <thead>
                      <tr>
                        <th className="border border-slate-900 p-3">
                          Il Tecnico addetto alle prove
                        </th>
                        <th className="border border-slate-900 p-3">
                          Redatto verificato ed emesso
                        </th>
                        <th className="border border-slate-900 p-3">
                          Il Direttore di laboratorio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="h-24 align-bottom">
                        <td className="border border-slate-900 p-3">
                          {reportDetails?.technician_name ?? "-"}
                        </td>
                        <td className="border border-slate-900 p-3">
                          {reportDetails?.reviewer_name ?? "-"}
                        </td>
                        <td className="border border-slate-900 p-3">
                          {reportDetails?.director_name ?? "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">
                  <p>
                    <strong>Nota anteprima:</strong> l’allegato tecnico{" "}
                    <strong>{annexNumber}</strong> sarà aggiunto come pagina 5
                    del PDF finale.
                  </p>
                  <p className="mt-2">
                    Strumento: {instrumentName} {manufacturer} {model} —
                    Matricola: {serialNumber || "-"} — Campo: {range || "-"}
                  </p>
                </section>
              </main>

              <ReportFooter
                page={4}
                totalPages={totalPages}
                reportNumber={reportNumber}
                reportDate={reportDate}
              />
            </div>
          </ReportPage>
        </div>
      </div>
    </AppShell>
  );
}