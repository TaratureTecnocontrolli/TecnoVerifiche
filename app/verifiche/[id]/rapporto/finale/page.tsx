import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import MeasurementErrorChart from "@/components/MeasurementErrorChart";
import TemperatureErrorChart, { type TemperatureErrorMeasurement } from "@/components/TemperatureErrorChart";
import ReportPrintButton from "@/components/ReportPrintButton";
import FinalReportPhotosInline from "@/components/FinalReportPhotosInline";
import ReportStatusActions from "@/components/ReportStatusActions";
import AutoPaginatedReport from "@/components/AutoPaginatedReport";
import { hasValidChartMeasurements, type MeasurementLike } from "@/lib/chart-utils";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type GenericRecord = Record<string, any>;

type SignatureRow = {
  signature_role: string | null;
  display_name: string | null;
  signature_url_snapshot: string | null;
  sort_order: number | null;
};

type ChartPageInfo = {
  key: string;
  title: string;
  measurements: (MeasurementLike & { section: string | null })[];
};

type TemperatureChartPageInfo = {
  key: string;
  title: string;
  measurements: TemperatureErrorMeasurement[];
};

type ReportPhoto = {
  id: string;
  photo_category: string | null;
  photo_url: string;
  photo_path: string | null;
  file_name: string | null;
  caption: string | null;
  sort_order: number | null;
  created_at: string | null;
};

type ScalePlan = {
  scale: GenericRecord;
  scaleMeasurements: GenericRecord[];
  scaleReferenceSnapshot: GenericRecord;
  scaleReferenceSnapshots: GenericRecord[];
  chartPages: ChartPageInfo[];
};

type TechnicalPageInfo = {
  key: string;
  plan: ScalePlan;
  measurements: GenericRecord[];
  continuation: boolean;
  showMeasurementsTable: boolean;
  showEccentricityDiagram: boolean;
};

type TechnicalSheetInfo = {
  key: string;
  sections: TechnicalPageInfo[];
  showGlobalContext: boolean;
};

type PageDescriptor =
  | { type: "cover" }
  | { type: "text" }
  | { type: "execution" }
  | {
      type: "references";
      referenceSnapshots: GenericRecord[];
      referenceStartIndex: number;
      continuation: boolean;
      showResults: boolean;
    }
  | { type: "results" }
  | { type: "formula" }
  | { type: "technical"; sheet: TechnicalSheetInfo }
  | { type: "chart"; charts: ChartPageInfo[] }
  | { type: "temperature-chart"; chart: TemperatureChartPageInfo }
  | { type: "signature" };

const LETTERHEAD_IMAGE_SRC = "/carta_intestata_rev02.png";

function asObject(value: unknown): GenericRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as GenericRecord;
  }

  return {};
}

function textValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}


function normalizeUnit(value: unknown) {
  const unit = textValue(value, "").trim();

  if (!unit || unit === "-") {
    return "";
  }

  return unit;
}

function firstTextValueFromSources(
  sources: GenericRecord[],
  keys: string[],
  fallback = ""
) {
  for (const key of keys) {
    for (const source of sources) {
      const value = source[key];

      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }

  return fallback;
}


function safeFileNameSegment(value: unknown, fallback = "Senza_nome") {
  const rawValue = textValue(value, fallback);

  return (
    rawValue
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || fallback
  );
}

function formatDate(value: unknown) {
  if (!value) {
    return "-";
  }

  const text = String(value);
  const parts = text.split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(text));
}

function formatNumber(value: unknown, digits = 3) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(number);
}

function hasNumericValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  return Number.isFinite(Number(value));
}

function hasAnyNumericValue(measurements: GenericRecord[], field: string) {
  return measurements.some((measurement) => hasNumericValue(measurement[field]));
}

function maxAbsoluteValue(measurements: GenericRecord[], field: string) {
  const values = measurements
    .map((measurement) => measurement[field])
    .filter(hasNumericValue)
    .map((value) => Math.abs(Number(value)));

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function formatNumberWithUnit(value: unknown, unit: string) {
  const formattedValue = formatNumber(value);

  return formattedValue === "-" ? "-" : formattedValue + " " + unit;
}

function splitText(value: unknown) {
  const text = textValue(value, "");

  if (!text) {
    return ["-"];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isTestPhasePhoto(photo: ReportPhoto) {
  const category = String(photo.photo_category ?? "").trim().toLowerCase();

  return (
    category === "test_phase" ||
    category === "fase_prova" ||
    category === "fasi_prova" ||
    category === "prova" ||
    category.includes("fase")
  );
}

function isInstrumentPhoto(photo: ReportPhoto) {
  const category = String(photo.photo_category ?? "").trim().toLowerCase();

  if (!category) {
    return true;
  }

  return (
    category === "instrument" ||
    category === "instrument_photo" ||
    category === "strumento" ||
    category === "foto_strumento" ||
    category.includes("strumento")
  );
}

function getMeasurementUnit(input: {
  record?: GenericRecord;
  customerSnapshot?: GenericRecord;
  referenceSnapshots?: GenericRecord[];
  scale?: GenericRecord;
}) {
  const referenceSnapshots = input.referenceSnapshots ?? [];
  const scaleSource = input.scale ?? {};

  const scaleExplicitUnit = normalizeUnit(
    firstTextValueFromSources([scaleSource], [
      "unit",
      "measurement_unit",
      "unita_misura",
      "unit_of_measure",
    ])
  );
  const scaleRangeUnit = detectMassUnitFromText(scaleSource.scale_range);

  if (scaleExplicitUnit || scaleRangeUnit) {
    return scaleExplicitUnit || scaleRangeUnit;
  }

  const sources = [
    input.customerSnapshot ?? {},
    ...referenceSnapshots,
    input.record ?? {},
  ];

  const explicitUnit = normalizeUnit(
    firstTextValueFromSources(sources, [
      "unit",
      "measurement_unit",
      "unita_misura",
      "unit_of_measure",
    ])
  );

  const legacyMassUnit = inferLegacyMassUnit({
    scale: scaleSource,
    customerSnapshot: input.customerSnapshot ?? {},
    fallbackUnit: explicitUnit,
  });

  return legacyMassUnit || explicitUnit;
}

function maxNumberFromText(value: unknown) {
  const matches = String(value ?? "").match(/\d+(?:[.,]\d+)?/g) ?? [];
  const values = matches
    .map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item));

  return values.length > 0 ? Math.max(...values) : null;
}

function inferLegacyMassUnit(input: {
  scale: GenericRecord;
  customerSnapshot: GenericRecord;
  fallbackUnit: string;
}) {
  if (input.fallbackUnit.toLowerCase() !== "kg") {
    return "";
  }

  const scaleMaximum = maxNumberFromText(input.scale.scale_range);
  const instrumentDescription = [
    input.customerSnapshot.measurement_range,
    input.customerSnapshot.range,
    input.customerSnapshot.capacity,
    input.customerSnapshot.instrument_name,
  ]
    .filter(Boolean)
    .join(" ");
  const instrumentMaximum = maxNumberFromText(instrumentDescription);

  if (!scaleMaximum || !instrumentMaximum) {
    return "";
  }

  const conversionRatio = scaleMaximum / instrumentMaximum;

  return conversionRatio >= 999 && conversionRatio <= 1001 ? "g" : "";
}

function addUnitToNumberText(text: string, unit: string) {
  if (!text || !unit) {
    return text;
  }

  const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return text
    .replace(
      new RegExp(
        "(Fondo Scala di\\s+)(\\d+(?:[,.]\\d+)?)(?!\\s*" +
          escapedUnit +
          ")(\\s*)([.;,])",
        "gi"
      ),
      "$1$2 " + unit + "$4"
    )
    .replace(
      new RegExp(
        "(fondo scala/campo\\s+)(\\d+(?:[,.]\\d+)?)(?!\\s*" +
          escapedUnit +
          ")(\\s*)([.;,])",
        "gi"
      ),
      "$1$2 " + unit + "$4"
    )
    .replace(
      new RegExp(
        "(fondo scala\\s+)(\\d+(?:[,.]\\d+)?)(?!\\s*" +
          escapedUnit +
          ")(\\s*)([.;,])",
        "gi"
      ),
      "$1$2 " + unit + "$4"
    )
    .replace(
      new RegExp(
        "(campo\\s+)(\\d+(?:[,.]\\d+)?)(?!\\s*" +
          escapedUnit +
          ")(\\s*)([.;,])",
        "gi"
      ),
      "$1$2 " + unit + "$4"
    );
}

function apparatusDescriptionText() {
  return [
    "L'apparato di verifica è costituito dagli strumenti campione indicati nella sezione tecnica del rapporto e accessori necessari all'esecuzione della prova.",
    "I campioni utilizzati risultano identificati mediante codice interno, matricola, certificato e relativa scadenza, come riportato nello snapshot tecnico della verifica.",
  ];
}

function verifiedInstrumentDescription(customerSnapshot: GenericRecord, details: GenericRecord) {
  const parts = [
    firstTextValueFromSources([customerSnapshot, details], [
      "instrument_name",
      "name",
      "work_object",
    ]),
    firstTextValueFromSources([customerSnapshot, details], [
      "manufacturer",
      "instrument_manufacturer",
    ]),
    firstTextValueFromSources([customerSnapshot, details], [
      "model",
      "instrument_model",
    ]),
    firstTextValueFromSources([customerSnapshot, details], [
      "internal_code",
      "instrument_internal_code",
    ])
      ? "cod. " +
        firstTextValueFromSources([customerSnapshot, details], [
          "internal_code",
          "instrument_internal_code",
        ])
      : "",
    firstTextValueFromSources([customerSnapshot, details], [
      "serial_number",
      "instrument_serial",
      "serial",
    ])
      ? "matr. " +
        firstTextValueFromSources([customerSnapshot, details], [
          "serial_number",
          "instrument_serial",
          "serial",
        ])
      : "",
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  return parts.join(" ") || textValue(details.work_object, "strumento in verifica");
}

function isForceCompressionTrazione(record: GenericRecord) {
  const module = String(record.verification_module ?? "").toUpperCase();
  const mode = String(record.mode ?? "").toLowerCase();

  return (
    module === "CT_FORCE" ||
    module === "FORCE" ||
    module === "CT" ||
    mode === "compressione" ||
    mode === "trazione"
  );
}

function getTemperatureVariant(record: GenericRecord) {
  const procedureSnapshot = asObject(record.procedure_snapshot);
  const variant = String(procedureSnapshot.temperature_variant ?? "").trim();

  return variant === "instrument_calibration"
    ? "instrument_calibration"
    : "maturation_tank";
}

function isTemperatureInstrumentCalibration(record: GenericRecord) {
  const isTemperature =
    record.verification_module === "TEMPERATURE" || record.mode === "temperatura";

  return isTemperature && getTemperatureVariant(record) === "instrument_calibration";
}

function forcePremiseText(customerSnapshot: GenericRecord, details: GenericRecord) {
  return [
    "Su incarico del Committente è stata eseguita la verifica di taratura dello strumento indicato nel presente Rapporto di Prova.",
    "La verifica riguarda esclusivamente lo strumento sottoposto a prova, nelle condizioni e nei punti di misura riportati nella sezione tecnica che è parte integrante del presente Rapporto di Prova.",
    "Lo strumento sottoposto a verifica è: " +
      verifiedInstrumentDescription(customerSnapshot, details) +
      ".",
  ];
}

function forceScopeText() {
  return [
    "Lo scopo della verifica è valutare la risposta metrologica dello strumento mediante comparazione con idoneo sistema campione sui punti di carico previsti.",
    "La verifica viene eseguita sui ⅘ superiori della sua portata massima. Tale verifica è il procedimento di controllo per determinare gli errori della pressa.",
    "Gli errori si distinguono in:",
    "a) errore di ripetibilità;",
    "b) errore di accuratezza.",
  ];
}

function forceExecutionMethodText() {
  return [
    "La verifica è stata eseguita disponendo lo strumento campione tra le piastre della pressa. Prima dell'inizio della verifica il sistema è stato portato al suo carico massimo per due volte a temperatura ambiente. La verifica è stata effettuata sui ⅘ superiori della portata massima della pressa e in particolare su n. 5 punti regolarmente spaziati.",
    "La temperatura e l’umidità sono state verificate con un termo-igrometro.",
    "L'insieme di queste operazioni rappresenta una serie di prove.",
  ];
}

function labelWithUnit(label: string, unit: string) {
  return unit ? label + " (" + unit + ")" : label;
}

const MASS_ECCENTRICITY_ZONE_LABELS = ["Zona C", "Zona 3", "Zona 4", "Zona 1", "Zona 2"];

function detectMassUnitFromText(value: unknown) {
  const text = String(value ?? "").toLowerCase();

  if (/\bkg\b/.test(text)) {
    return "kg";
  }

  if (/\bg\b/.test(text)) {
    return "g";
  }

  return "";
}

function massScaleKind(scaleName: unknown) {
  const text = String(scaleName ?? "").toLowerCase();

  if (text.includes("eccentric")) {
    return "eccentricity";
  }

  if (text.includes("ripetibil")) {
    return "repeatability";
  }

  if (text.includes("linear")) {
    return "linearity";
  }

  return "";
}

function massReportPointLabel(scaleName: unknown, index: number, fallback: unknown) {
  const kind = massScaleKind(scaleName);

  if (kind === "eccentricity") {
    return MASS_ECCENTRICITY_ZONE_LABELS[index] || "Zona " + String(index + 1);
  }

  if (kind === "repeatability" || kind === "linearity") {
    return "Zona C";
  }

  return textValue(fallback);
}

function ReportPhotosInline({
  photos,
}: {
  title: string;
  photos: Array<{
    id: string;
    photo_url: string;
    file_name?: string | null;
    caption?: string | null;
  }>;
}) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 break-inside-avoid">
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo, index) => (
          <figure
            key={photo.id || String(index)}
            className="break-inside-avoid"
          >
            <div className="flex h-[190px] items-center justify-center">
              <img
                src={photo.photo_url}
                alt="Strumento in verifica"
                className="h-full w-full object-contain"
              />
            </div>

            <figcaption className="mt-1 text-center text-[8.5px] leading-tight text-slate-800">
              Strumento in verifica
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function buildCustomerFullAnagrafica(input: {
  details: GenericRecord;
  customerSnapshot: GenericRecord;
  customerMaster: GenericRecord;
}) {
  const sources = [input.details, input.customerSnapshot, input.customerMaster];

  function firstValue(keys: string[]) {
    for (const key of keys) {
      for (const source of sources) {
        const value = source[key];

        if (value !== null && value !== undefined && String(value).trim() !== "") {
          return String(value).trim();
        }
      }
    }

    return "";
  }

  const name = firstValue([
    "customer_name",
    "business_name",
    "company_name",
    "ragione_sociale",
    "name",
  ]);
  const vat = firstValue(["vat_number", "vat", "partita_iva", "p_iva", "piva"]);
  const taxCode = firstValue(["tax_code", "fiscal_code", "codice_fiscale", "cf"]);
  const address = firstValue(["address", "street", "via", "registered_office_address"]);
  const postalCode = firstValue(["postal_code", "zip", "cap"]);
  const city = firstValue(["city", "comune"]);
  const province = firstValue(["province", "provincia"]);
  const addressLine = [address, postalCode, city, province ? "(" + province + ")" : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  return [
    name,
    addressLine || null,
    vat ? "P. IVA " + vat : null,
    taxCode ? "C.F. " + taxCode : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function modeLabel(mode: unknown, verificationModule: unknown) {
  if (verificationModule === "PRESSURE" || mode === "pressione") {
    return "Pressione";
  }

  if (verificationModule === "TORQUE" || mode === "dinamometria") {
    return "Chiavi dinamometriche";
  }

  if (verificationModule === "FLOW" || mode === "portata") {
    return "Portata / contalitri";
  }

  if (verificationModule === "SCLEROMETRIC" || mode === "sclerometro") {
    return "Prove sclerometriche";
  }

  if (verificationModule === "MASS" || mode === "massa") {
    return "Massa / bilance";
  }

  if (verificationModule === "DIMENSIONAL" || mode === "dimensionale") {
    return "Dimensionale";
  }

  if (verificationModule === "TEMPERATURE" || mode === "temperatura") {
    return "Temperatura";
  }

  if (verificationModule === "PULLOFF" || mode === "pulloff") {
    return "Pull-off";
  }

  if (mode === "compressione") {
    return "Compressione";
  }

  if (mode === "trazione") {
    return "Trazione";
  }

  return textValue(mode);
}

function statusLabel(status: unknown) {
  if (status === "draft") return "Bozza";
  if (status === "issued") return "Emesso";
  if (status === "cancelled") return "Annullato";

  return textValue(status);
}

function DataCell({
  label,
  value,
  colSpan,
}: {
  label: string;
  value: unknown;
  colSpan?: number;
}) {
  return (
    <>
      <td className="border border-slate-300 bg-slate-100/75 px-2 py-0.5 font-bold text-slate-950">
        {label}
      </td>
      <td
        colSpan={colSpan}
        className="border border-slate-300 bg-white/55 px-2 py-0.5 text-slate-950"
      >
        {textValue(value)}
      </td>
    </>
  );
}

function PageShell({
  children,
  pageNumber,
  totalPages,
  reportNumber,
  reportDate,
}: {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  reportNumber: string;
  reportDate: unknown;
}) {
  return (
    <section
      className={
        "report-a4-page relative mx-auto h-[297mm] min-h-[297mm] w-[210mm] overflow-hidden bg-white shadow-lg print:shadow-none " +
        (pageNumber > 1 ? "print:break-before-page" : "")
      }
    >
      <img
        src={LETTERHEAD_IMAGE_SRC}
        alt="Carta intestata Tecnocontrolli"
        className="pointer-events-none absolute inset-0 z-0 block h-full w-full object-fill print:block"
      />

      <div className="relative z-10 flex h-full flex-col px-[60px] pb-[96px] pt-[132px]">
        {children}
      </div>

      <div className="absolute bottom-[28px] left-[60px] right-[60px] z-10 border-t border-slate-300 pt-2 text-center text-[10px] leading-tight text-slate-700">
        <p>
          Pagina <span data-report-page-number>{pageNumber}</span> di{" "}
          <span data-report-total-pages>{totalPages}</span> del Rapporto di Prova{" "}
          {reportNumber} del {formatDate(reportDate)}
        </p>
        <p>
          È vietata la riproduzione del rapporto di prova o di singole parti
          senza l&apos;approvazione del laboratorio Tecnocontrolli S.r.l.
        </p>
      </div>
    </section>
  );
}

function CoverPage({
  record,
  details,
  customerSnapshot,
  customerMaster,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  record: GenericRecord;
  details: GenericRecord;
  customerSnapshot: GenericRecord;
  customerMaster: GenericRecord;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  const customerNumber =
    details.customer_number ??
    customerSnapshot.customer_number ??
    customerSnapshot.customer_code ??
    "-";

  const customerName =
    details.customer_name ??
    customerSnapshot.customer_name ??
    customerSnapshot.business_name ??
    "-";

  const customerFullAnagrafica =
    buildCustomerFullAnagrafica({ details, customerSnapshot, customerMaster }) ||
    textValue(customerName);

  const acceptance = [
    details.acceptance_number,
    details.acceptance_date ? "del " + formatDate(details.acceptance_date) : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <div className="mt-6 text-right text-[13px] font-semibold text-slate-950">
        Calderara di Reno, {formatDate(reportDate)}
      </div>

      <table className="mt-8 w-full border-collapse text-[13px]">
        <tbody>
          <tr>
            <td className="w-[185px] border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Rapporto di prova
            </td>
            <td className="border border-slate-900 bg-white/60 px-3 py-4 font-black">
              {reportNumber}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Codice cliente
            </td>
            <td className="border border-slate-900 bg-white/60 px-3 py-4 font-black">
              {textValue(customerNumber)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Committente
            </td>
            <td className="whitespace-pre-line border border-slate-900 bg-white/60 px-3 py-3 text-[12px] font-black leading-4">
              {customerFullAnagrafica}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Oggetto dei lavori
            </td>
            <td className="border border-slate-900 bg-white/60 px-3 py-4 font-black">
              Verifica di taratura
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Luogo prove
            </td>
            <td className="border border-slate-900 bg-white/60 px-3 py-4 font-black">
              {textValue(details.site_description ?? record.location)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Prove richieste
            </td>
            <td className="border border-slate-900 bg-white/60 px-3 py-4 font-black">
              {textValue(details.requested_tests)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Data delle prove
            </td>
            <td className="border border-slate-900 bg-white/60 px-3 py-4 font-black">
              {formatDate(details.test_date ?? record.verification_date)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 bg-white/70 px-3 py-4 font-black uppercase">
              Accettazione int.
            </td>
            <td className="border border-slate-900 bg-white/60 px-3 py-4 font-black">
              {acceptance || "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-auto text-center text-[12px] font-bold">
        Questo rapporto di prova è composto da n. {" "}
        <span data-report-total-pages>{totalPages}</span> pagine.
      </p>
    </PageShell>
  );
}

function TextIntroPage({
  record,
  details,
  reportPhotos,
  customerSnapshot,
  measurementUnit,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  record: GenericRecord;
  details: GenericRecord;
  reportPhotos: ReportPhoto[];
  customerSnapshot: GenericRecord;
  measurementUnit: string;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  const isForceReport = isForceCompressionTrazione(record);

  const premiseParagraphs = isForceReport
    ? forcePremiseText(customerSnapshot, details)
    : splitText(
        addUnitToNumberText(textValue(details.premise_text, ""), measurementUnit)
      );

  const scopeParagraphs = isForceReport
    ? forceScopeText()
    : splitText(
        addUnitToNumberText(textValue(details.scope_text, ""), measurementUnit)
      );

  const instrumentPhotosFromTable = reportPhotos.filter(
    (photo) => isInstrumentPhoto(photo) || !isTestPhasePhoto(photo)
  );

  const legacyInstrumentPhoto =
    typeof details.instrument_photo_url === "string" &&
    details.instrument_photo_url.trim()
      ? [
          {
            id: "legacy-instrument-photo",
            photo_url: details.instrument_photo_url.trim(),
            file_name: "Foto strumento",
            caption: "Foto strumento",
          },
        ]
      : [];

  const instrumentPhotos =
    instrumentPhotosFromTable.length > 0
      ? instrumentPhotosFromTable
      : legacyInstrumentPhoto;

  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section className="space-y-4 text-justify text-[12px] leading-4 text-slate-950">
        <div data-report-flow-block>
          <h2 className="mt-10 mb-1 text-[15px] font-black uppercase">1. Premessa</h2>
          {premiseParagraphs.map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}

          <ReportPhotosInline
            title="Foto strumento"
            photos={instrumentPhotos}
          />
        </div>

        <div data-report-flow-block>
          <h2 className="mb-1 text-[15px] font-black uppercase">
            2. Scopo della prova
          </h2>
          {scopeParagraphs.map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}
        </div>

        <div data-report-flow-block>
          <h2 className="mb-1 text-[15px] font-black uppercase">
            3. Descrizione dell&apos;apparato di verifica
          </h2>
          {apparatusDescriptionText().map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}
        </div>

      </section>
    </PageShell>
  );
}


function ExecutionTextPage({
  record,
  details,
  referenceSnapshots,
  includeTailSections,
  includeResultsAfterReferences,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  record: GenericRecord;
  details: GenericRecord;
  referenceSnapshots: GenericRecord[];
  includeTailSections: boolean;
  includeResultsAfterReferences: boolean;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  const isForceReport = isForceCompressionTrazione(record);

  const executionMethodParagraphs = isForceReport
    ? forceExecutionMethodText()
    : splitText(details.execution_method);

  const isPressure =
    record.verification_module === "PRESSURE" || record.mode === "pressione";
  const isTorque =
    record.verification_module === "TORQUE" || record.mode === "dinamometria";
  const isFlow = record.verification_module === "FLOW" || record.mode === "portata";
  const isSclerometric =
    record.verification_module === "SCLEROMETRIC" || record.mode === "sclerometro";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";
  const isDimensional =
    record.verification_module === "DIMENSIONAL" || record.mode === "dimensionale";
  const isTemperature =
    record.verification_module === "TEMPERATURE" || record.mode === "temperatura";

  const isPullOff =
    record.verification_module === "PULLOFF" || record.mode === "pulloff";

  let formulaText: string[] = [
    "La verifica del punto di gradazione della scala viene effettuata leggendo il corrispondente valore effettivo sul dispositivo di verifica, con carico di prova crescente, quando i sistemi sono in equilibrio.",
    "Per ogni livello di carico l'errore relativo di accuratezza, espresso in percentuale, viene determinato confrontando il carico indicato dalla macchina con la media delle letture del dispositivo campione.",
    "L'errore relativo di ripetibilità è determinato a partire dalla differenza tra il valore massimo e il valore minimo delle letture rilevate.",
  ];

  if (isPressure) {
    formulaText = [
      "La verifica viene eseguita confrontando i valori indicati dallo strumento in prova con i valori applicati tramite lo strumento campione.",
      "Per ogni punto vengono rilevate due letture dello strumento in prova.",
      "Errore medio = Media letture - Carico applicato.",
      "Errore accuratezza % = [(Media letture - Carico applicato) / Carico applicato] × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
    ];
  }

  if (isTorque) {
    formulaText = [
      "La verifica viene eseguita applicando i punti di coppia previsti e rilevando tre letture consecutive dello strumento in prova.",
      "Errore medio = Coppia applicata - Media letture.",
      "Errore accuratezza % = [(Coppia applicata - Media letture) / Coppia applicata] × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
    ];
  }

  if (isFlow) {
    formulaText = [
      "La verifica viene eseguita impostando sullo strumento in prova i volumi nominali previsti e rilevando tre letture per ciascun punto.",
      "Errore = Media letture - Volume impostato.",
      "Errore % = Errore / Volume impostato × 100.",
    ];
  }

  if (isSclerometric) {
    formulaText = [
      "La verifica viene eseguita effettuando un numero prestabilito di battute sull'incudine di riferimento a valore nominale fisso, rilevando tre letture per ciascuna battuta.",
      "Errore medio = Media letture - Valore nominale incudine.",
      "Errore % = Errore medio / Valore nominale incudine × 100.",
    ];
  }

  if (isMass) {
    formulaText = [
      "La verifica è composta da tre prove distinte: ripetibilità (un punto, tre letture), eccentricità (cinque zone del piatto di pesata, tre letture ciascuna) e linearità (più punti sull'intero campo di pesata, tre letture ciascuno).",
      "Errore = Media letture - Peso nominale.",
      "Errore % (prove di eccentricità e linearità) = (Media letture / Peso nominale - 1) × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
      "Eccentricità (zona centrale) = Media delle ripetibilità delle cinque zone - Ripetibilità della zona centrale.",
    ];
  }

  if (isDimensional) {
    formulaText = [
      "La verifica viene eseguita confrontando lo strumento in prova con i campioni di riferimento sui punti previsti, rilevando tre scostamenti consecutivi per ciascun punto.",
      "Errore medio = Valore nominale - Media scostamenti.",
      "Errore accuratezza % = [(Valore nominale - Media scostamenti) / Valore nominale] × 100.",
      "Errore ripetibilità % = [(Scostamento massimo - Scostamento minimo) / Media scostamenti] × 100.",
      "Incertezza strumentale = |Errore medio| × 2.",
    ];
  }

  if (isTemperature) {
    formulaText = isTemperatureInstrumentCalibration(record)
      ? [
          "La verifica viene eseguita sui punti di temperatura previsti confrontando lo strumento o l'apparecchiatura in prova con uno o più strumenti campione di riferimento.",
          "Per ciascun punto vengono rilevate due letture consecutive dello strumento in prova.",
          "Media letture = (I ciclo + II ciclo) / 2.",
          "Errore (°C) = Temperatura applicata - Media letture.",
        ]
      : [
          "La verifica viene eseguita rilevando, a orari prefissati, la temperatura indicata dallo strumento in prova e la temperatura indicata dal termometro/termostato di riferimento.",
          "I valori sono riportati come rilevati, senza calcolo di errore o esito automatico.",
        ];
  }

  if (isPullOff) {
    formulaText = [
      "La verifica viene eseguita applicando i punti di carico previsti tramite la cella di carico campione e rilevando, per ciascun punto, tre letture consecutive dello strumento in prova.",
      "Errore medio = Carico applicato - Media letture.",
      "Errore accuratezza % = [(Carico applicato - Media letture) / Carico applicato] × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
    ];
  }

  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section className="space-y-4 text-justify text-[11px] leading-4 text-slate-950">
        <div data-report-flow-block>
          <h2 className="mt-8 mb-2 text-[15px] font-black uppercase">
            4. Descrizione e modalità di esecuzione della verifica di taratura
          </h2>
          {executionMethodParagraphs.map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}

          <FinalReportPhotosInline
            recordId={String(record.id)}
            category="test_phase"
            title="Foto fasi prova"
          />
        </div>

        <div data-report-flow-block>
          <h2 className="mb-2 text-[15px] font-black uppercase">
            5. Espressione dei risultati
          </h2>

          {formulaText.map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}
        </div>

        {includeTailSections ? (
          <div className="space-y-4">
            <div className="break-inside-avoid">
              <h2 data-report-flow-block data-report-flow-group="reference-start" className="mb-2 text-[15px] font-black uppercase">
                6. Strumenti campione utilizzati
              </h2>
              <p data-report-flow-block data-report-flow-group="reference-start" className="mb-2 text-justify text-[11px] leading-4">
                Per l&apos;esecuzione delle verifiche sono stati utilizzati gli
                strumenti campione di seguito identificati.
              </p>
              {referenceSnapshots.map((referenceSnapshot, referenceIndex) => (
                <table
                  key={referenceIndex}
                  data-report-flow-block
                  data-report-flow-group={referenceIndex === 0 ? "reference-start" : undefined}
                  className="mb-2 w-full border-collapse text-[9px] leading-tight"
                >
                  <thead>
                    <tr className="bg-slate-700/65 text-left text-slate-950">
                      <th colSpan={4} className="border border-slate-900 px-2 py-0.5">
                        Strumento campione {referenceIndex + 1}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <DataCell label="Strumento" value={referenceSnapshot.name} />
                      <DataCell label="Costruttore" value={referenceSnapshot.manufacturer} />
                    </tr>
                    <tr>
                      <DataCell label="Modello" value={referenceSnapshot.model} />
                      <DataCell label="Matricola" value={referenceSnapshot.serial_number} />
                    </tr>
                    <tr>
                      <DataCell label="Cod. int." value={referenceSnapshot.internal_code} />
                      <DataCell
                        label="Fondo scala"
                        value={[
                          textValue(referenceSnapshot.measurement_range, ""),
                          normalizeUnit(referenceSnapshot.unit),
                        ].filter(Boolean).join(" ") || "-"}
                      />
                    </tr>
                    <tr>
                      <DataCell label="Certificato" value={referenceSnapshot.certificate_number} />
                      <DataCell label="Scadenza" value={formatDate(referenceSnapshot.certificate_expiry)} />
                    </tr>
                  </tbody>
                </table>
              ))}
            </div>

            {includeResultsAfterReferences ? <div data-report-flow-block className="break-inside-avoid">
              <h2 className="mb-2 text-[15px] font-black uppercase">
                7. Risultati della verifica
              </h2>
              <table className="w-full border-collapse text-center text-[10px]">
                <thead>
                  <tr className="bg-slate-700/65 text-slate-950">
                    <th className="border border-slate-900 px-2 py-0.5">Temperatura ambientale (°C)</th>
                    <th className="border border-slate-900 px-2 py-0.5">Umidità ambientale (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-900 px-2 py-1 font-bold">{textValue(details.temperature)}</td>
                    <td className="border border-slate-900 px-2 py-1 font-bold">{textValue(details.humidity)}</td>
                  </tr>
                </tbody>
              </table>
            </div> : null}
          </div>
        ) : null}

      </section>
    </PageShell>
  );
}

function ReferenceInstrumentTable({
  referenceSnapshot,
  referenceNumber,
  flowBlock = false,
}: {
  referenceSnapshot: GenericRecord;
  referenceNumber: number;
  flowBlock?: boolean;
}) {
  return (
    <table
    data-report-flow-block={flowBlock ? true : undefined}
    className={
    (flowBlock ? "mt-3 " : "") +
    "w-full border-collapse text-[9px]"
    }
  >
      <thead>
        <tr className="bg-slate-700/65 text-left text-slate-950">
          <th colSpan={4} className="border border-slate-900 px-2 py-1">
            Strumento campione {referenceNumber}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <DataCell label="Strumento" value={referenceSnapshot.name} />
          <DataCell
            label="Costruttore"
            value={referenceSnapshot.manufacturer}
          />
        </tr>
        <tr>
          <DataCell label="Modello" value={referenceSnapshot.model} />
          <DataCell label="Matricola" value={referenceSnapshot.serial_number} />
        </tr>
        <tr>
          <DataCell label="Cod. int." value={referenceSnapshot.internal_code} />
          <DataCell
            label="Fondo scala"
            value={[
              textValue(referenceSnapshot.measurement_range, ""),
              normalizeUnit(referenceSnapshot.unit),
            ]
              .filter(Boolean)
              .join(" ") || "-"}
          />
        </tr>
        <tr>
          <DataCell
            label="Certificato"
            value={referenceSnapshot.certificate_number}
          />
          <DataCell
            label="Scadenza"
            value={formatDate(referenceSnapshot.certificate_expiry)}
          />
        </tr>
      </tbody>
    </table>
  );
}

function ReferenceInstrumentsPage({
  referenceSnapshots,
  details,
  showResults,
  continuation,
  referenceStartIndex,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  referenceSnapshots: GenericRecord[];
  details: GenericRecord;
  showResults: boolean;
  continuation: boolean;
  referenceStartIndex: number;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section className="text-slate-950">
        <div data-report-flow-block className="break-inside-avoid">
          <h2
            className={
              (continuation ? "mt-2 mb-1" : "mt-5 mb-2") +
              " text-[15px] font-black uppercase"
            }
          >
            6. Strumenti campione utilizzati
            {continuation ? " - continua" : ""}
          </h2>

          {!continuation ? (
            <p className="mb-2 text-justify text-[11px] leading-4">
              Per l&apos;esecuzione delle verifiche sono stati utilizzati gli
              strumenti campione di seguito identificati.
            </p>
          ) : null}

          {referenceSnapshots[0] ? (
            <ReferenceInstrumentTable
              referenceSnapshot={referenceSnapshots[0]}
              referenceNumber={referenceStartIndex + 1}
            />
          ) : (
            <div className="rounded-sm border border-slate-900 bg-white/40 p-4 text-center text-[11px]">
              Nessuno strumento campione associato alla verifica.
            </div>
          )}
        </div>

        <div>
          {referenceSnapshots.slice(1).map((referenceSnapshot, referenceIndex) => (
            <ReferenceInstrumentTable
              key={referenceIndex + 1}
              referenceSnapshot={referenceSnapshot}
              referenceNumber={referenceStartIndex + referenceIndex + 2}
              flowBlock
            />
          ))}
        </div>

        {showResults ? <div data-report-flow-block className="mt-6 break-inside-avoid">
          <h2 className="mb-3 text-[15px] font-black uppercase">
            7. Risultati della verifica
          </h2>

          <table className="w-full border-collapse text-center text-[12px]">
            <thead>
              <tr className="bg-slate-700/65 text-slate-950">
                <th className="border border-slate-900 px-2 py-1">
                  Temperatura ambientale (°C)
                </th>
                <th className="border border-slate-900 px-2 py-1">
                  Umidità ambientale (%)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-900 px-2 py-2 font-bold">
                  {textValue(details.temperature)}
                </td>
                <td className="border border-slate-900 px-2 py-2 font-bold">
                  {textValue(details.humidity)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 rounded-lg border border-slate-200 p-3 text-[11px] leading-5">
            Nota: la sezione tecnica di verifica taratura costituisce parte
            integrante del presente Rapporto di Prova ed è riportata di seguito
            prima della sottoscrizione finale.
          </div>
        </div> : null}
      </section>
    </PageShell>
  );
}

function ResultsPage({
  details,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  details: GenericRecord;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section data-report-flow-block className="text-slate-950">
        <h2 className="mt-8 mb-4 text-[15px] font-black uppercase">
          7. Risultati della verifica
        </h2>

        <table className="w-full border-collapse text-center text-[12px]">
          <thead>
            <tr className="bg-slate-700/65 text-slate-950">
              <th className="border border-slate-900 px-2 py-1">
                Temperatura ambientale (°C)
              </th>
              <th className="border border-slate-900 px-2 py-1">
                Umidità ambientale (%)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-900 px-2 py-2 font-bold">
                {textValue(details.temperature)}
              </td>
              <td className="border border-slate-900 px-2 py-2 font-bold">
                {textValue(details.humidity)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8 rounded-lg border border-slate-200 p-4 text-[12px] leading-6">
          Nota: la sezione tecnica di verifica taratura costituisce parte
          integrante del presente Rapporto di Prova ed è riportata nelle pagine
          successive prima della sottoscrizione finale.
        </div>
      </section>
    </PageShell>
  );
}

function FormulaPage({
  record,
  details,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  record: GenericRecord;
  details: GenericRecord;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  const isPressure =
    record.verification_module === "PRESSURE" || record.mode === "pressione";
  const isTorque =
    record.verification_module === "TORQUE" || record.mode === "dinamometria";
  const isFlow = record.verification_module === "FLOW" || record.mode === "portata";
  const isSclerometric =
    record.verification_module === "SCLEROMETRIC" || record.mode === "sclerometro";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";
  const isDimensional =
    record.verification_module === "DIMENSIONAL" || record.mode === "dimensionale";
  const isTemperature =
    record.verification_module === "TEMPERATURE" || record.mode === "temperatura";

  const isPullOff =
    record.verification_module === "PULLOFF" || record.mode === "pulloff";

  let formulaText: string[] = [
    "La verifica del punto di gradazione della scala viene effettuata leggendo il corrispondente valore effettivo sul dispositivo di verifica, con carico di prova crescente, quando i sistemi sono in equilibrio.",
    "Per ogni livello di carico l'errore relativo di accuratezza, espresso in percentuale, viene determinato confrontando il carico indicato dalla macchina con la media delle letture del dispositivo campione.",
    "L'errore relativo di ripetibilità è determinato a partire dalla differenza tra il valore massimo e il valore minimo delle letture rilevate.",
  ];

  if (isPressure) {
    formulaText = [
      "La verifica viene eseguita confrontando i valori indicati dallo strumento in prova con i valori applicati tramite lo strumento campione.",
      "Per ogni punto vengono rilevate due letture dello strumento in prova.",
      "Errore medio = Media letture - Carico applicato.",
      "Errore accuratezza % = [(Media letture - Carico applicato) / Carico applicato] × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
    ];
  }

  if (isTorque) {
    formulaText = [
      "La verifica viene eseguita applicando i punti di coppia previsti e rilevando tre letture consecutive dello strumento in prova.",
      "Errore medio = Coppia applicata - Media letture.",
      "Errore accuratezza % = [(Coppia applicata - Media letture) / Coppia applicata] × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
    ];
  }

  if (isFlow) {
    formulaText = [
      "La verifica viene eseguita impostando sullo strumento in prova i volumi nominali previsti e rilevando tre letture per ciascun punto.",
      "Errore = Media letture - Volume impostato.",
      "Errore % = Errore / Volume impostato × 100.",
    ];
  }

  if (isSclerometric) {
    formulaText = [
      "La verifica viene eseguita effettuando un numero prestabilito di battute sull'incudine di riferimento a valore nominale fisso, rilevando tre letture per ciascuna battuta.",
      "Errore medio = Media letture - Valore nominale incudine.",
      "Errore % = Errore medio / Valore nominale incudine × 100.",
    ];
  }

  if (isMass) {
    formulaText = [
      "La verifica è composta da tre prove distinte: ripetibilità (un punto, tre letture), eccentricità (cinque zone del piatto di pesata, tre letture ciascuna) e linearità (più punti sull'intero campo di pesata, tre letture ciascuno).",
      "Errore = Media letture - Peso nominale.",
      "Errore % (prove di eccentricità e linearità) = (Media letture / Peso nominale - 1) × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
      "Eccentricità (zona centrale) = Media delle ripetibilità delle cinque zone - Ripetibilità della zona centrale.",
    ];
  }

  if (isDimensional) {
    formulaText = [
      "La verifica viene eseguita confrontando lo strumento in prova con i campioni di riferimento sui punti previsti, rilevando tre scostamenti consecutivi per ciascun punto.",
      "Errore medio = Valore nominale - Media scostamenti.",
      "Errore accuratezza % = [(Valore nominale - Media scostamenti) / Valore nominale] × 100.",
      "Errore ripetibilità % = [(Scostamento massimo - Scostamento minimo) / Media scostamenti] × 100.",
      "Incertezza strumentale = |Errore medio| × 2.",
    ];
  }

  if (isTemperature) {
    formulaText = isTemperatureInstrumentCalibration(record)
      ? [
          "La verifica viene eseguita sui punti di temperatura previsti confrontando lo strumento o l'apparecchiatura in prova con uno o più strumenti campione di riferimento.",
          "Per ciascun punto vengono rilevate due letture consecutive dello strumento in prova.",
          "Media letture = (I ciclo + II ciclo) / 2.",
          "Errore (°C) = Temperatura applicata - Media letture.",
        ]
      : [
          "La verifica viene eseguita rilevando, a orari prefissati, la temperatura indicata dallo strumento in prova e la temperatura indicata dal termometro/termostato di riferimento.",
          "I valori sono riportati come rilevati, senza calcolo di errore o esito automatico.",
        ];
  }

  if (isPullOff) {
    formulaText = [
      "La verifica viene eseguita applicando i punti di carico previsti tramite la cella di carico campione e rilevando, per ciascun punto, tre letture consecutive dello strumento in prova.",
      "Errore medio = Carico applicato - Media letture.",
      "Errore accuratezza % = [(Carico applicato - Media letture) / Carico applicato] × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
    ];
  }

  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section data-report-flow-block className="space-y-6 text-justify text-[13px] leading-5 text-slate-950">
        <div>
          <h2 className="mt-5 mb-2 text-[15px] font-black uppercase">
            5. Espressione dei risultati
          </h2>

          {formulaText.map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h2 className="mb-4 text-[15px] font-black uppercase">
            7. Risultati della verifica
          </h2>

          <table className="w-full border-collapse text-center text-[12px]">
            <thead>
              <tr className="bg-slate-700/65 text-slate-950">
                <th className="border border-slate-900 px-2 py-0.5">
                  Temperatura ambientale (°C)
                </th>
                <th className="border border-slate-900 px-2 py-0.5">
                  Umidità ambientale (%)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-900 px-2 py-1 font-bold">
                  {textValue(details.temperature)}
                </td>
                <td className="border border-slate-900 px-2 py-1 font-bold">
                  {textValue(details.humidity)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 rounded-lg border border-slate-200 p-4 text-[12px] leading-6">
            Nota: la sezione tecnica di verifica taratura costituisce
            parte integrante del presente Rapporto di Prova ed è riportata nelle
            pagine successive prima della sottoscrizione finale.
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function TemperatureInstrumentMeasurementsTable({
  measurements,
}: {
  measurements: GenericRecord[];
}) {
  return (
    <table className="w-full border-collapse bg-white/35 text-center text-[9px]">
      <thead>
        <tr className="bg-slate-700/65 text-slate-950">
          <th className="border border-slate-600 px-1 py-0.5">Punto</th>
          <th className="border border-slate-600 px-1 py-0.5">
            Temperatura applicata (°C)
          </th>
          <th className="border border-slate-600 px-1 py-0.5">
            Lettura I° ciclo (°C)
          </th>
          <th className="border border-slate-600 px-1 py-0.5">
            Lettura II° ciclo (°C)
          </th>
          <th className="border border-slate-600 px-1 py-0.5">
            Media letture (°C)
          </th>
          <th className="border border-slate-600 px-1 py-0.5">
            Errore (°C)
          </th>
        </tr>
      </thead>
      <tbody>
        {measurements.length === 0 ? (
          <tr className="bg-white/65">
            <td colSpan={6} className="border border-slate-300 px-2 py-1">
              Nessun punto di misura salvato.
            </td>
          </tr>
        ) : (
          measurements.map((measurement, index) => (
            <tr
              key={measurement.id}
              className={index % 2 === 0 ? "bg-white/65" : "bg-slate-100/55"}
            >
              <td className="border border-slate-300 px-1 py-0.5">
                {textValue(measurement.point_order)}
              </td>
              <td className="border border-slate-300 px-1 py-0.5">
                {formatNumber(measurement.applied_value)}
              </td>
              <td className="border border-slate-300 px-1 py-0.5">
                {formatNumber(measurement.cycle_1)}
              </td>
              <td className="border border-slate-300 px-1 py-0.5">
                {formatNumber(measurement.cycle_2)}
              </td>
              <td className="border border-slate-300 px-1 py-0.5 font-bold">
                {formatNumber(measurement.average_value)}
              </td>
              <td className="border border-slate-300 px-1 py-0.5">
                {formatNumber(measurement.mean_error)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function TechnicalTable({
  measurements,
  showNominalColumn,
  showUncertaintyColumn,
  showThirdCycleColumn = true,
  nominalLabel = "Volume nominale",
  appliedLabel = "Carico applicato",
  measurementUnit = "",
  firstColumnLabel = "Punto di verifica",
  firstColumnHasUnit = true,
  pointLabelResolver,
}: {
  measurements: GenericRecord[];
  showNominalColumn: boolean;
  showUncertaintyColumn?: boolean;
  showThirdCycleColumn?: boolean;
  nominalLabel?: string;
  appliedLabel?: string;
  measurementUnit?: string;
  firstColumnLabel?: string;
  firstColumnHasUnit?: boolean;
  pointLabelResolver?: (measurement: GenericRecord, index: number) => string;
}) {
  const showThirdCycle =
    showThirdCycleColumn && hasAnyNumericValue(measurements, "cycle_3");
  const showMaxColumn = hasAnyNumericValue(measurements, "max_value");
  const showMinColumn = hasAnyNumericValue(measurements, "min_value");
  const showAverageColumn = hasAnyNumericValue(measurements, "average_value");
  const showMeanErrorColumn = hasAnyNumericValue(measurements, "mean_error");
  const showAccuracyColumn = hasAnyNumericValue(
    measurements,
    "accuracy_error_percent"
  );
  const showRepeatabilityColumn = hasAnyNumericValue(
    measurements,
    "repeatability_error_percent"
  );
  const showInstrumentalUncertaintyColumn =
    Boolean(showUncertaintyColumn) &&
    hasAnyNumericValue(measurements, "instrumental_uncertainty");

  const columnCount =
    3 +
    (showNominalColumn ? 1 : 0) +
    (showThirdCycle ? 1 : 0) +
    (showMaxColumn ? 1 : 0) +
    (showMinColumn ? 1 : 0) +
    (showAverageColumn ? 1 : 0) +
    (showMeanErrorColumn ? 1 : 0) +
    (showAccuracyColumn ? 1 : 0) +
    (showRepeatabilityColumn ? 1 : 0) +
    (showInstrumentalUncertaintyColumn ? 1 : 0);

  return (
    <table className="w-full border-collapse bg-white/35 text-center text-[9px]">
      <thead>
        <tr className="bg-slate-700/65 text-slate-950">
          <th className="border border-slate-600 px-1 py-0.5">
            {firstColumnHasUnit
              ? labelWithUnit(firstColumnLabel, measurementUnit)
              : firstColumnLabel}
          </th>
          {showNominalColumn && (
            <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit(nominalLabel, measurementUnit)}</th>
          )}
          <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit(appliedLabel, measurementUnit)}</th>
          <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit("Lettura I° ciclo", measurementUnit)}</th>
          <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit("Lettura II° ciclo", measurementUnit)}</th>
          {showThirdCycle && (
            <th className="border border-slate-600 px-1 py-0.5">
              {labelWithUnit("Lettura III° ciclo", measurementUnit)}
            </th>
          )}
          {showMaxColumn && <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit("Lettura massima", measurementUnit)}</th>}
          {showMinColumn && <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit("Lettura minima", measurementUnit)}</th>}
          {showAverageColumn && <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit("Media letture", measurementUnit)}</th>}
          {showMeanErrorColumn && <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit("Errore medio", measurementUnit)}</th>}
          {showAccuracyColumn && <th className="border border-slate-600 px-1 py-0.5">Errore accuratezza %</th>}
          {showRepeatabilityColumn && (
            <th className="border border-slate-600 px-1 py-0.5">
              Errore ripetibilità %
            </th>
          )}
          {showInstrumentalUncertaintyColumn && (
            <th className="border border-slate-600 px-1 py-0.5">
              {labelWithUnit("Incertezza strumentale", measurementUnit)}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {measurements.length === 0 ? (
          <tr className="bg-white/65">
            <td colSpan={columnCount} className="border border-slate-300 px-2 py-1">
              Nessun punto di misura salvato per questa scala.
            </td>
          </tr>
        ) : (
          measurements.map((measurement, index) => (
            <tr
              key={measurement.id}
              className={index % 2 === 0 ? "bg-white/65" : "bg-slate-100/55"}
            >
              <td className="border border-slate-300 px-1 py-0.5">
                {pointLabelResolver
                  ? pointLabelResolver(measurement, index)
                  : textValue(measurement.point_order)}
              </td>
              {showNominalColumn && (
                <td className="border border-slate-300 px-1 py-0.5">
                  {formatNumber(measurement.nominal_value)}
                </td>
              )}
              <td className="border border-slate-300 px-1 py-0.5">
                {formatNumber(measurement.applied_value)}
              </td>
              <td className="border border-slate-300 px-1 py-0.5">
                {formatNumber(measurement.cycle_1)}
              </td>
              <td className="border border-slate-300 px-1 py-0.5">
                {formatNumber(measurement.cycle_2)}
              </td>
              {showThirdCycle && (
                <td className="border border-slate-300 px-1 py-0.5">
                  {formatNumber(measurement.cycle_3)}
                </td>
              )}
              {showMaxColumn && <td className="border border-slate-300 px-1 py-0.5">{formatNumber(measurement.max_value)}</td>}
              {showMinColumn && <td className="border border-slate-300 px-1 py-0.5">{formatNumber(measurement.min_value)}</td>}
              {showAverageColumn && <td className="border border-slate-300 p-1 font-bold">{formatNumber(measurement.average_value)}</td>}
              {showMeanErrorColumn && <td className="border border-slate-300 px-1 py-0.5">{formatNumber(measurement.mean_error)}</td>}
              {showAccuracyColumn && <td className="border border-slate-300 px-1 py-0.5">{formatNumber(measurement.accuracy_error_percent)}</td>}
              {showRepeatabilityColumn && <td className="border border-slate-300 px-1 py-0.5">{formatNumber(measurement.repeatability_error_percent)}</td>}
              {showInstrumentalUncertaintyColumn && (
                <td className="border border-slate-300 px-1 py-0.5">
                  {formatNumber(measurement.instrumental_uncertainty)}
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function TechnicalPage({
  record,
  details,
  scale,
  measurements,
  summaryMeasurements,
  customerSnapshot,
  referenceSnapshots,
  procedureSnapshot,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
  continuation = false,
  showMeasurementsTable = true,
  showEccentricityDiagram = false,
}: {
  record: GenericRecord;
  details: GenericRecord;
  scale: GenericRecord;
  measurements: GenericRecord[];
  summaryMeasurements?: GenericRecord[];
  customerSnapshot: GenericRecord;
  referenceSnapshots: GenericRecord[];
  procedureSnapshot: GenericRecord;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
  continuation?: boolean;
  showMeasurementsTable?: boolean;
  showEccentricityDiagram?: boolean;
}) {
  const isPressure =
    record.verification_module === "PRESSURE" || record.mode === "pressione";
  const isFlow = record.verification_module === "FLOW" || record.mode === "portata";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";
  const isCompactMassEccentricity =
    isMass && massScaleKind(scale.scale_name) === "eccentricity";
  const isDimensional =
    record.verification_module === "DIMENSIONAL" || record.mode === "dimensionale";
  const showNominalColumn = isFlow;
  const nominalLabel = "Volume nominale";
  const appliedLabel = isFlow
    ? "Volume impostato"
    : isMass
      ? "Peso nominale"
      : isDimensional
        ? "Valore nominale"
        : "Carico applicato";
  const measurementUnit = getMeasurementUnit({
    record,
    customerSnapshot,
    referenceSnapshots,
    scale,
  });

  const measurementsForSummary = summaryMeasurements ?? measurements;
  const maxAccuracy = maxAbsoluteValue(
    measurementsForSummary,
    "accuracy_error_percent"
  );

  const maxRepeatability = maxAbsoluteValue(
    measurementsForSummary,
    "repeatability_error_percent"
  );

  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <div
        className={
          (isCompactMassEccentricity ? "mt-3" : "mt-10") +
          " text-right text-[11px] font-semibold text-slate-900"
        }
      >
        Sezione tecnica integrante del Rapporto di Prova {reportNumber}
      </div>

      <h2
        className={
          (isCompactMassEccentricity
            ? "mt-2 text-[16px]"
            : "mt-6 text-[18px]") +
          " text-center font-black uppercase tracking-wide"
        }
      >
        Sezione tecnica di verifica di taratura
      </h2>

      <p
        className={
          (isCompactMassEccentricity ? "mt-1" : "mt-2") +
          " text-center text-[12px] font-bold"
        }
      >
        {textValue(scale.scale_name)}
      </p>

      {continuation && (
        <p className="mt-1 text-center text-[10px] font-semibold text-slate-700">
          Continuazione risultati di misura
        </p>
      )}

      {!continuation && <div className={(isCompactMassEccentricity ? "mt-2" : "mt-5") + " text-[9px]"}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-700/65 text-left text-slate-950">
              <th colSpan={2} className="border border-slate-900 px-2 py-0.5">
                Dati generali
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <DataCell
                label="Codice cliente"
                value={customerSnapshot.customer_number}
              />
            </tr>
            <tr>
              <DataCell label="Cliente" value={customerSnapshot.customer_name} />
            </tr>
            <tr>
              <DataCell
                label="Luogo prove"
                value={details.site_description ?? record.location}
              />
            </tr>
            <tr>
              <DataCell
                label="Data verifica"
                value={formatDate(details.test_date ?? record.verification_date)}
              />
            </tr>
            <tr>
              <DataCell
                label="Tipo"
                value={modeLabel(record.mode, record.verification_module)}
              />
            </tr>
           </tbody>
        </table>
       </div>}

      {!continuation && <table className={(isCompactMassEccentricity ? "mt-1.5" : "mt-3") + " w-full border-collapse text-[9px]"}>
        <thead>
          <tr className="bg-slate-700/65 text-left text-slate-950">
            <th colSpan={4} className="border border-slate-900 px-2 py-0.5">
              Strumento in prova
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <DataCell label="Strumento" value={customerSnapshot.instrument_name} />
            <DataCell label="Costruttore" value={customerSnapshot.manufacturer} />
          </tr>
          <tr>
            <DataCell label="Modello" value={customerSnapshot.model} />
            <DataCell label="Matricola" value={customerSnapshot.serial_number} />
          </tr>
        </tbody>
      </table>}

      {!continuation && <table className={(isCompactMassEccentricity ? "mt-1.5" : "mt-3") + " w-full border-collapse text-[9px]"}>
        <thead>
          <tr className="bg-slate-700/65 text-left text-slate-950">
            <th colSpan={4} className="border border-slate-900 px-2 py-0.5">
              Scala verificata
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <DataCell label="Scala" value={scale.scale_name} />
            <DataCell
              label="Fondo scala"
              value={formatNumberWithUnit(scale.scale_range, measurementUnit)}
            />
          </tr>
          <tr>
            <DataCell
              label="Errore accuratezza max"
              value={formatNumberWithUnit(maxAccuracy, "%")}
            />
            <DataCell
              label="Errore ripetibilità max"
              value={formatNumberWithUnit(maxRepeatability, "%")}
            />
          </tr>
        </tbody>
      </table>}

      {showEccentricityDiagram &&
        isMass &&
        massScaleKind(scale.scale_name) === "eccentricity" && (
        <div className={(isCompactMassEccentricity ? "mt-1.5 px-3 py-1" : "mt-3 px-4 py-2") + " flex items-center justify-center gap-4 rounded-sm border border-slate-300 bg-white/45"}>
          <img
            src="/eccentricita.png"
            alt="Schema delle posizioni per la prova di eccentricità"
            className={
              (isCompactMassEccentricity ? "h-[68px]" : "h-[92px]") +
              " w-auto object-contain"
            }
          />
          <div className="min-w-0 flex-1 whitespace-nowrap text-[9px] leading-snug text-slate-800">
            <p className="font-bold">Schema prova di eccentricità</p>
            <p className="mt-1">
              Posizioni di applicazione del carico: zona centrale C e zone
              periferiche 1, 2, 3 e 4.
            </p>
          </div>
        </div>
      )}

      {showMeasurementsTable && (
      <div className={(isCompactMassEccentricity ? "mt-1.5" : "mt-3") + " technical-table-container min-w-0"}>
        <TechnicalTable
          measurements={measurements}
          showNominalColumn={showNominalColumn}
          showUncertaintyColumn={isDimensional}
          nominalLabel={nominalLabel}
          appliedLabel={appliedLabel}
          measurementUnit={measurementUnit}
          showThirdCycleColumn={!isPressure && !isFlow}
          firstColumnLabel={isMass ? "Zona" : "Punto di verifica"}
          firstColumnHasUnit={!isMass}
          pointLabelResolver={
            isMass
              ? (measurement, index) =>
                  massReportPointLabel(
                    scale.scale_name || measurement.section,
                    index,
                    measurement.point_order
                  )
              : undefined
          }
        />
      </div>
      )}
    </PageShell>
  );
}

function TechnicalScaleSection({
  record,
  pageInfo,
  customerSnapshot,
  flowBlock = true,
}: {
  record: GenericRecord;
  pageInfo: TechnicalPageInfo;
  customerSnapshot: GenericRecord;
  flowBlock?: boolean;
}) {
  const { plan, measurements, continuation } = pageInfo;
  const { scale, scaleMeasurements, scaleReferenceSnapshots } = plan;
  const isPressure =
    record.verification_module === "PRESSURE" || record.mode === "pressione";
  const isFlow = record.verification_module === "FLOW" || record.mode === "portata";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";
  const isDimensional =
    record.verification_module === "DIMENSIONAL" || record.mode === "dimensionale";
  const isTemperature =
    record.verification_module === "TEMPERATURE" || record.mode === "temperatura";
  const isTemperatureInstrument =
    isTemperature && isTemperatureInstrumentCalibration(record);
  const measurementUnit = getMeasurementUnit({
    record,
    customerSnapshot,
    referenceSnapshots: scaleReferenceSnapshots,
    scale,
  });
  const maxAccuracy = maxAbsoluteValue(
    scaleMeasurements,
    "accuracy_error_percent"
  );
  const maxRepeatability = maxAbsoluteValue(
    scaleMeasurements,
    "repeatability_error_percent"
  );
  const maxTemperatureError = maxAbsoluteValue(
    scaleMeasurements,
    "mean_error"
  );
  const appliedLabel = isFlow
    ? "Volume impostato"
    : isMass
      ? "Peso nominale"
      : isDimensional
        ? "Valore nominale"
        : "Carico applicato";

  return (
    <section
      data-report-flow-block={flowBlock ? true : undefined}
      className="mt-3 break-inside-avoid"
    >
      <div className="mb-1 flex items-end justify-between gap-3">
        <h3 className="text-[12px] font-black uppercase">
          {textValue(scale.scale_name)}
        </h3>
        {continuation && (
          <span className="text-[8px] font-semibold text-slate-600">
            Continuazione
          </span>
        )}
      </div>

      <table className="mb-2 w-full border-collapse text-[9px]">
        <tbody>
          <tr>
            <DataCell label="Scala" value={scale.scale_name} />
            <DataCell
              label="Fondo scala"
              value={formatNumberWithUnit(scale.scale_range, measurementUnit)}
            />
          </tr>
          {isTemperatureInstrument ? (
            <tr>
              <DataCell
                label="Errore max assoluto"
                value={formatNumberWithUnit(maxTemperatureError, "°C")}
              />
              <DataCell
                label="N. punti"
                value={String(scaleMeasurements.length)}
              />
            </tr>
          ) : (
            <tr>
              <DataCell
                label="Errore accuratezza max"
                value={formatNumberWithUnit(maxAccuracy, "%")}
              />
              <DataCell
                label="Errore ripetibilità max"
                value={formatNumberWithUnit(maxRepeatability, "%")}
              />
            </tr>
          )}
        </tbody>
      </table>

      {pageInfo.showEccentricityDiagram && (
        <div className="mb-2 flex items-center justify-center gap-3 rounded-sm border border-slate-300 bg-white/45 px-3 py-1">
          <img
            src="/eccentricita.png"
            alt="Schema delle posizioni per la prova di eccentricità"
            className="h-[60px] w-auto object-contain"
          />
          <p className="min-w-0 flex-1 whitespace-nowrap text-[9px] leading-snug">
            <strong>Schema prova di eccentricità.</strong> Zona centrale C e
            zone periferiche 1, 2, 3 e 4.
          </p>
        </div>
      )}

      {isTemperatureInstrument ? (
        <TemperatureInstrumentMeasurementsTable measurements={measurements} />
      ) : (
        <TechnicalTable
          measurements={measurements}
          showNominalColumn={isFlow}
          showUncertaintyColumn={isDimensional}
          nominalLabel="Volume nominale"
          appliedLabel={appliedLabel}
          measurementUnit={measurementUnit}
          showThirdCycleColumn={!isPressure && !isFlow}
          firstColumnLabel={isMass ? "Zona" : "Punto di verifica"}
          firstColumnHasUnit={!isMass}
          pointLabelResolver={
            isMass
              ? (measurement, index) =>
                  massReportPointLabel(
                    scale.scale_name || measurement.section,
                    index,
                    measurement.point_order
                  )
              : undefined
          }
        />
      )}
    </section>
  );
}

function TechnicalFlowPage({
  record,
  details,
  sheet,
  customerSnapshot,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  record: GenericRecord;
  details: GenericRecord;
  sheet: TechnicalSheetInfo;
  customerSnapshot: GenericRecord;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <div
        data-report-flow-block
        data-report-page-break-before="true"
        className="break-inside-avoid"
      >
        <div className="mt-4 text-right text-[10px] font-semibold text-slate-900">
          Sezione tecnica integrante del Rapporto di Prova {reportNumber}
        </div>

        <h2 className="mt-2 text-center text-[16px] font-black uppercase tracking-wide">
          Sezione tecnica di verifica di taratura
        </h2>

        {sheet.showGlobalContext && (
          <div className="mt-3 space-y-2 text-[9px]">
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <DataCell
                    label="Codice cliente"
                    value={customerSnapshot.customer_number}
                  />
                  <DataCell
                    label="Cliente"
                    value={customerSnapshot.customer_name}
                  />
                </tr>
                <tr>
                  <DataCell
                    label="Luogo prove"
                    value={details.site_description ?? record.location}
                  />
                  <DataCell
                    label="Data verifica"
                    value={formatDate(
                      details.test_date ?? record.verification_date
                    )}
                  />
                </tr>
              </tbody>
            </table>

            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <DataCell
                    label="Strumento in prova"
                    value={customerSnapshot.instrument_name}
                  />
                  <DataCell
                    label="Costruttore"
                    value={customerSnapshot.manufacturer}
                  />
                </tr>
                <tr>
                  <DataCell label="Modello" value={customerSnapshot.model} />
                  <DataCell
                    label="Matricola"
                    value={customerSnapshot.serial_number}
                  />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {sheet.sections[0] ? (
          <TechnicalScaleSection
            record={record}
            pageInfo={sheet.sections[0]}
            customerSnapshot={customerSnapshot}
            flowBlock={false}
          />
        ) : null}
      </div>

      <div className="mt-2">
        {sheet.sections.slice(1).map((section) => (
          <TechnicalScaleSection
            key={section.key}
            record={record}
            pageInfo={section}
            customerSnapshot={customerSnapshot}
          />
        ))}
      </div>
    </PageShell>
  );
}

function ChartPage({
  charts,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  charts: ChartPageInfo[];
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <div data-report-flow-block className="break-inside-avoid">
        <div className="mt-6 text-right text-[11px] font-semibold text-slate-900">
          Sezione tecnica integrante del Rapporto di Prova {reportNumber}
        </div>

        {charts[0] ? (
          <div
            className={
              (charts.length > 1 ? "mt-4" : "mt-6") +
              " rounded-2xl bg-white/45 p-1 [&_svg]:!h-[260px] [&>div]:!p-3"
            }
          >
            <MeasurementErrorChart
              measurements={charts[0].measurements}
              title={charts[0].title}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {charts.slice(1).map((chart) => (
          <div
            key={chart.key}
            data-report-flow-block
            className={
              "rounded-2xl bg-white/45 p-1 [&_svg]:!h-[260px] [&>div]:!p-3"
            }
          >
            <MeasurementErrorChart
              measurements={chart.measurements}
              title={chart.title}
            />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function TemperatureChartPage({
  chart,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  chart: TemperatureChartPageInfo;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <div data-report-flow-block className="break-inside-avoid">
        <div className="mt-6 text-right text-[11px] font-semibold text-slate-900">
          Sezione tecnica integrante del Rapporto di Prova {reportNumber}
        </div>

        <div className="mt-6 rounded-2xl bg-white/45 p-1 [&_svg]:!h-[300px] [&>div]:!p-3">
          <TemperatureErrorChart
            measurements={chart.measurements}
            title={chart.title}
          />
        </div>
      </div>
    </PageShell>
  );
}

function SignatureEntryCard({ entry }: { entry: SignatureRow }) {
  return (
    <div className="flex min-h-[96px] min-w-[150px] flex-1 flex-col items-center justify-end rounded-lg border border-slate-200/70 bg-white/25 px-3 py-2">
      {entry.signature_url_snapshot ? (
        <img
          src={entry.signature_url_snapshot}
          alt={entry.display_name ?? "Firma"}
          className="mb-1 h-14 max-w-[150px] object-contain mix-blend-multiply opacity-75"
        />
      ) : (
        <div className="mb-1 h-14 w-full border-b border-slate-300" />
      )}

      <span className="text-center text-[10px] leading-tight">
        {textValue(entry.display_name)}
      </span>
    </div>
  );
}

function SignatureRoleSection({
  title,
  entries,
  fallbackText,
}: {
  title: string;
  entries: SignatureRow[];
  fallbackText: unknown;
}) {
  const fallback = textValue(fallbackText, "");

  return (
    <div className="overflow-hidden rounded-sm border border-slate-900 bg-white/35">
      <div className="bg-slate-700/65 px-3 py-1 text-center text-[10px] font-bold text-slate-950">
        {title}
      </div>

      <div className="bg-white/10 p-3">
        {entries.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3">
            {entries.map((entry, index) => (
              <SignatureEntryCard key={index} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[96px] items-end justify-center px-3 py-2">
            <div className="w-[210px] border-b border-slate-300 pb-2 text-center text-[10px] leading-tight">
              {fallback || "-"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoDocumentationPage({
  photos,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  photos: ReportPhoto[];
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section className="text-slate-950">
        <h2 className="mt-5 mb-4 text-[15px] font-black uppercase">
          Documentazione fotografica
        </h2>

        {photos.length === 0 ? (
          <p className="text-[12px]">Nessuna foto allegata al rapporto.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {photos.map((photo, index) => (
              <figure
                key={photo.id || String(index)}
                className="break-inside-avoid rounded-sm border border-slate-300 bg-white/70 p-2"
              >
                <div className="flex h-[245px] items-center justify-center border border-slate-200 bg-white">
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || photo.file_name || "Foto rapporto"}
                    className="h-full w-full object-contain"
                  />
                </div>
                <figcaption className="mt-1 text-center text-[8.5px] leading-tight text-slate-800">
                  {photo.caption ||
                    (photo.photo_category === "test_phase"
                      ? "Foto fase prova"
                      : "Foto strumento")}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function SignaturePage({
  details,
  testingSignatures,
  reviewerSignatures,
  directorSignature,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  details: GenericRecord;
  testingSignatures: SignatureRow[];
  reviewerSignatures: SignatureRow[];
  directorSignature: SignatureRow | null;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section className="text-[13px] leading-5 text-slate-950">
        <h2 className="mt-10 mb-2 text-[15px] font-black uppercase">
          8. Sottoscrizione del rapporto
        </h2>

        <p>
          Il presente Rapporto di Prova, comprensivo della sezione tecnica di
          verifica della taratura, viene redatto, verificato ed emesso dal
          Laboratorio Tecnocontrolli S.r.l. secondo le procedure interne
          applicabili.
        </p>

        <div className="mt-10 space-y-5 text-center text-[11px]">
          <SignatureRoleSection
            title="Tecnico/i addetto/i alle prove"
            entries={testingSignatures}
            fallbackText={details.technician_name}
          />

          <SignatureRoleSection
            title="Redatto / verificato"
            entries={reviewerSignatures}
            fallbackText={details.reviewer_name}
          />

          <SignatureRoleSection
            title="Direttore di laboratorio"
            entries={directorSignature ? [directorSignature] : []}
            fallbackText={details.director_name}
          />
        </div>
      </section>
    </PageShell>
  );
}

export default async function FinalReportPage({ params }: PageProps) {
  const { id } = await params;

  
  const supabase = await createServerSupabaseClient();
const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select("*")
    .eq("id", id)
    .single();

  if (recordError || !recordData) {
    notFound();
  }

  const record = recordData as GenericRecord;

  const { data: detailsData } = await supabase
    .from("calibration_report_details")
    .select("*")
    .eq("calibration_record_id", id)
    .maybeSingle();

  const { data: scalesData } = await supabase
    .from("calibration_record_scales")
    .select("*")
    .eq("calibration_record_id", id)
    .order("scale_order", { ascending: true });

  const { data: measurementsData } = await supabase
    .from("calibration_measurements")
    .select("*")
    .eq("calibration_record_id", id)
    .order("point_order", { ascending: true });

  const { data: signaturesData } = await supabase
    .from("calibration_report_signatures")
    .select("signature_role, display_name, signature_url_snapshot, sort_order")
    .eq("calibration_record_id", id)
    .order("sort_order", { ascending: true });

  const { data: reportPhotosData } = await supabase
    .from("calibration_report_photos")
    .select(
      "id, photo_category, photo_url, photo_path, file_name, caption, sort_order, created_at"
    )
    .eq("calibration_record_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const details = asObject(detailsData);
  const scales = (scalesData ?? []) as GenericRecord[];
  const measurements = (measurementsData ?? []) as GenericRecord[];
  const signatureRows = (signaturesData ?? []) as SignatureRow[];
  const reportPhotos = (reportPhotosData ?? []) as ReportPhoto[];

  const testingSignatures = signatureRows.filter(
    (row) => row.signature_role === "testing_technician"
  );
  const reviewerSignatures = signatureRows.filter(
    (row) => row.signature_role === "reviewer"
  );
  const directorSignature =
    signatureRows.find((row) => row.signature_role === "director") ?? null;

  const customerSnapshot = asObject(record.customer_instrument_snapshot);

  const customerIdFromSnapshot =
    typeof customerSnapshot.customer_id === "string"
      ? customerSnapshot.customer_id
      : typeof record.customer_id === "string"
        ? record.customer_id
        : "";

  const { data: customerMasterData } = customerIdFromSnapshot
    ? await supabase
        .from("customers")
        .select("*")
        .eq("id", customerIdFromSnapshot)
        .maybeSingle()
    : { data: null };

  const customerMaster = asObject(customerMasterData);
  const referenceSnapshot = asObject(record.reference_instrument_snapshot);
  const mainMeasurementUnit = getMeasurementUnit({
    record,
    customerSnapshot,
    referenceSnapshots: [referenceSnapshot],
  });

  const reportNumber =
    textValue(details.main_report_number, "") ||
    textValue(record.record_number, "") ||
    "SENZA NUMERO";

  const reportDate = details.report_date ?? new Date().toISOString().slice(0, 10);

  const reportCustomerName =
    textValue(details.customer_name, "") ||
    textValue(customerSnapshot.customer_name, "") ||
    textValue(customerSnapshot.business_name, "") ||
    "Cliente";

  const reportFileName =
    "RdP_" +
    safeFileNameSegment(reportNumber, "Senza_numero") +
    "_" +
    safeFileNameSegment(reportCustomerName, "Cliente");

  const isPressure =
    record.verification_module === "PRESSURE" || record.mode === "pressione";
  const isTemperature =
    record.verification_module === "TEMPERATURE" || record.mode === "temperatura";
  const temperatureInstrumentCalibration =
    isTemperature && isTemperatureInstrumentCalibration(record);
  const isSclerometric =
    record.verification_module === "SCLEROMETRIC" || record.mode === "sclerometro";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";

  const scalePlans: ScalePlan[] = scales.map((scale) => {
    const scaleMeasurements = measurements.filter(
      (measurement) => measurement.scale_id === scale.id
    );

    const scaleReferenceSnapshot =
      asObject(scale.reference_instrument_snapshot).name ||
      asObject(scale.reference_instrument_snapshot).instrument_id
        ? asObject(scale.reference_instrument_snapshot)
        : referenceSnapshot;

    const rawReferenceSnapshots = Array.isArray(
      scale.reference_instruments_snapshot
    )
      ? (scale.reference_instruments_snapshot as unknown[])
          .map((item) => asObject(item))
          .filter((item) => item.name || item.instrument_id)
      : [];

    const scaleReferenceSnapshots =
      rawReferenceSnapshots.length > 0
        ? rawReferenceSnapshots
        : [scaleReferenceSnapshot];

    const chartMeasurements: (MeasurementLike & { section: string | null })[] =
      scaleMeasurements.map((measurement) => ({
        id: String(measurement.id),
        point_order: Number(measurement.point_order) || 0,
        nominal_value:
          measurement.nominal_value === null ||
          measurement.nominal_value === undefined
            ? null
            : Number(measurement.nominal_value),
        applied_value:
          measurement.applied_value === null ||
          measurement.applied_value === undefined
            ? null
            : Number(measurement.applied_value),
        accuracy_error_percent:
          measurement.accuracy_error_percent === null ||
          measurement.accuracy_error_percent === undefined
            ? null
            : Number(measurement.accuracy_error_percent),
        section: measurement.section ?? null,
      }));

    const chartPages: ChartPageInfo[] = [];

    if (!isTemperature && !isSclerometric) {
      if (isPressure) {
        const carico = chartMeasurements.filter(
          (measurement) => measurement.section?.toLowerCase() !== "scarico"
        );
        const scarico = chartMeasurements.filter(
          (measurement) => measurement.section?.toLowerCase() === "scarico"
        );

        if (hasValidChartMeasurements(carico)) {
          chartPages.push({
            key: scale.id + "-carico",
            title: "Grafico errore accuratezza % - Prova in carico",
            measurements: carico,
          });
        }

        if (hasValidChartMeasurements(scarico)) {
          chartPages.push({
            key: scale.id + "-scarico",
            title: "Grafico errore accuratezza % - Prova in scarico",
            measurements: scarico,
          });
        }
      } else if (
        (!isMass || massScaleKind(scale.scale_name) === "linearity") &&
        hasValidChartMeasurements(chartMeasurements)
      ) {
        chartPages.push({
          key: scale.id + "-chart",
          title:
            "Grafico errore accuratezza % - " + textValue(scale.scale_name),
          measurements: chartMeasurements,
        });
      }
    }

    return {
      scale,
      scaleMeasurements,
      scaleReferenceSnapshot,
      scaleReferenceSnapshots,
      chartPages,
    };
  });

  const uniqueReferenceSnapshots = Array.from(
    new Map(
      scalePlans
        .flatMap((plan) => plan.scaleReferenceSnapshots)
        .filter(
          (snapshot) =>
            snapshot.name ||
            snapshot.instrument_id ||
            snapshot.internal_code ||
            snapshot.serial_number
        )
        .map((snapshot, index) => {
          const identity =
            textValue(snapshot.instrument_id, "") ||
            textValue(snapshot.internal_code, "") ||
            textValue(snapshot.serial_number, "") ||
            [
              textValue(snapshot.name, ""),
              textValue(snapshot.certificate_number, ""),
            ].join("|") ||
            "reference-" + String(index);

          return [identity, snapshot] as const;
        })
    ).values()
  );

  const technicalSheets: TechnicalSheetInfo[] = [];
  const remainingBudgetBySheet: number[] = [];
  const firstSheetBudget = 675;
  const continuationSheetBudget = 810;
  const measurementRowCost = 16;
  const scaleSectionCost = 78;
  const eccentricityDiagramCost = 72;

  function createTechnicalSheet() {
    const sheetIndex = technicalSheets.length;
    const showGlobalContext = sheetIndex === 0;

    technicalSheets.push({
      key: "technical-sheet-" + String(sheetIndex + 1),
      sections: [],
      showGlobalContext,
    });
    remainingBudgetBySheet.push(
      showGlobalContext ? firstSheetBudget : continuationSheetBudget
    );

    return sheetIndex;
  }

  if (scalePlans.length > 0) {
    createTechnicalSheet();
  }

  scalePlans.forEach((plan) => {
    const allMeasurements = plan.scaleMeasurements;
    const isEccentricity =
      massScaleKind(plan.scale.scale_name) === "eccentricity";
    let measurementOffset = 0;
    let chunkIndex = 0;
    let needsEmptySection = allMeasurements.length === 0;

    while (measurementOffset < allMeasurements.length || needsEmptySection) {
      let sheetIndex = technicalSheets.length - 1;
      const showDiagram = isEccentricity && chunkIndex === 0;
      const fixedCost =
        scaleSectionCost + (showDiagram ? eccentricityDiagramCost : 0);
      const minimumCost = fixedCost + (needsEmptySection ? 0 : measurementRowCost);

      if (
        remainingBudgetBySheet[sheetIndex] < minimumCost &&
        technicalSheets[sheetIndex].sections.length > 0
      ) {
        sheetIndex = createTechnicalSheet();
      }

      const availableForRows = Math.max(
        measurementRowCost,
        remainingBudgetBySheet[sheetIndex] - fixedCost
      );
      const rowsThatFit = needsEmptySection
        ? 0
        : Math.max(1, Math.floor(availableForRows / measurementRowCost));
      const chunk = allMeasurements.slice(
        measurementOffset,
        measurementOffset + rowsThatFit
      );

      technicalSheets[sheetIndex].sections.push({
        key:
          String(plan.scale.id) +
          "-chunk-" +
          String(chunkIndex + 1),
        plan,
        measurements: chunk,
        continuation: chunkIndex > 0,
        showMeasurementsTable: true,
        showEccentricityDiagram: showDiagram,
      });

      remainingBudgetBySheet[sheetIndex] -=
        fixedCost + chunk.length * measurementRowCost;
      measurementOffset += chunk.length;
      chunkIndex += 1;
      needsEmptySection = false;
    }
  });

  const referenceDescriptors: PageDescriptor[] = [
    {
      type: "references",
      referenceSnapshots: uniqueReferenceSnapshots,
      referenceStartIndex: 0,
      continuation: false,
      showResults: true,
    },
  ];
  const inlineReferenceSnapshots: GenericRecord[] = [];
  const showInlineTail = false;
  const showInlineResults = false;
  const allChartPages = scalePlans.flatMap((plan) => plan.chartPages);
  const chartDescriptors: PageDescriptor[] = [];
  const temperatureChartMeasurements: TemperatureErrorMeasurement[] =
    temperatureInstrumentCalibration
      ? measurements
          .filter(
            (measurement) =>
              hasNumericValue(measurement.applied_value) &&
              hasNumericValue(measurement.mean_error)
          )
          .map((measurement) => ({
            id: String(measurement.id),
            point_order: Number(measurement.point_order) || 0,
            applied_value: Number(measurement.applied_value),
            mean_error: Number(measurement.mean_error),
          }))
      : [];
  const temperatureChartDescriptors: PageDescriptor[] =
    temperatureChartMeasurements.length > 0
      ? [
          {
            type: "temperature-chart",
            chart: {
              key: "temperature-error-chart",
              title: "Grafico errore di temperatura",
              measurements: temperatureChartMeasurements,
            },
          },
        ]
      : [];
  const continuousTechnicalSheets: TechnicalSheetInfo[] =
    technicalSheets.length > 0
      ? [
          {
            key: "technical-continuous-flow",
            showGlobalContext: true,
            sections: technicalSheets.flatMap((sheet) => sheet.sections),
          },
        ]
      : [];

  for (let index = 0; index < allChartPages.length; index += 2) {
    chartDescriptors.push({
      type: "chart",
      charts: allChartPages.slice(index, index + 2),
    });
  }

  const pageDescriptors: PageDescriptor[] = [
    { type: "cover" },
    { type: "text" },
    { type: "execution" },
    ...referenceDescriptors,
    ...continuousTechnicalSheets.map(
      (sheet): PageDescriptor => ({ type: "technical", sheet })
    ),
    ...chartDescriptors,
    ...temperatureChartDescriptors,
    { type: "signature" },
  ];

  const totalPages = pageDescriptors.length;
  return (
    <AppShell>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm;
            min-height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .print-hidden,
          .print\:hidden {
            display: none !important;
          }

          .report-a4-page {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            break-inside: avoid-page;
          }

          .report-a4-page + .report-a4-page {
            page-break-before: always;
            break-before: page;
          }

          .technical-table-container {
            overflow: visible !important;
          }
        }

        .auto-report-content table th,
        .auto-report-content table td {
          padding-top: 1px !important;
          padding-bottom: 1px !important;
          line-height: 1.15 !important;
        }

        .auto-report-content p:not(.text-center):not(.text-right) {
          text-align: justify;
        }
      `}</style>

      <div className="space-y-8 bg-slate-100 p-6 print:space-y-0 print:bg-white print:p-0">
        <div className="print-hidden mb-2 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/verifiche/${id}/rapporto`}
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna ai dati rapporto
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <ReportPrintButton
              fileName={reportFileName}
            />
          </div>
        </div>

        <div className="print-hidden">
          <ReportStatusActions
            recordId={id}
            initialStatus={typeof record.report_status === "string" ? record.report_status : "draft"}
            issuedAt={typeof record.issued_at === "string" ? record.issued_at : null}
            reopenedAt={typeof record.reopened_at === "string" ? record.reopened_at : null}
            documentLabel="rapporto VT"
          />
        </div>

        <CoverPage
          record={record}
          details={details}
          customerSnapshot={customerSnapshot}
          customerMaster={customerMaster}
          reportNumber={reportNumber}
          reportDate={reportDate}
          pageNumber={1}
          totalPages={totalPages}
        />

        <AutoPaginatedReport
          letterheadSrc={LETTERHEAD_IMAGE_SRC}
          reportNumber={reportNumber}
          reportDateLabel={formatDate(reportDate)}
        >
        {pageDescriptors
          .filter(
            (descriptor) =>
              descriptor.type !== "cover" && descriptor.type !== "signature"
          )
          .map((descriptor, index) => {
          const pageNumber = index + 2;

          if (descriptor.type === "text") {
            return (
              <TextIntroPage
                key="text"
                record={record}
                details={details}
                reportPhotos={reportPhotos}
                customerSnapshot={customerSnapshot}
                measurementUnit={mainMeasurementUnit}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "execution") {
            return (
              <ExecutionTextPage
                key="execution"
                record={record}
                details={details}
                referenceSnapshots={inlineReferenceSnapshots}
                includeTailSections={showInlineTail}
                includeResultsAfterReferences={showInlineResults}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "references") {
            return (
              <ReferenceInstrumentsPage
                key="references"
                referenceSnapshots={descriptor.referenceSnapshots}
                details={details}
                showResults={descriptor.showResults}
                continuation={descriptor.continuation}
                referenceStartIndex={descriptor.referenceStartIndex}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "results") {
            return (
              <ResultsPage
                key="results"
                details={details}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "formula") {
            return (
              <FormulaPage
                key="formula"
                record={record}
                details={details}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "technical") {
            return (
              <TechnicalFlowPage
                key={descriptor.sheet.key}
                record={record}
                details={details}
                sheet={descriptor.sheet}
                customerSnapshot={customerSnapshot}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "chart") {
            return (
              <ChartPage
                key={"chart-" + descriptor.charts.map((chart) => chart.key).join("-")}
                charts={descriptor.charts}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "temperature-chart") {
            return (
              <TemperatureChartPage
                key={descriptor.chart.key}
                chart={descriptor.chart}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          return null;
        })}
        </AutoPaginatedReport>

        <SignaturePage
          details={details}
          testingSignatures={testingSignatures}
          reviewerSignatures={reviewerSignatures}
          directorSignature={directorSignature}
          reportNumber={reportNumber}
          reportDate={reportDate}
          pageNumber={totalPages}
          totalPages={totalPages}
        />
      </div>
    </AppShell>
  );
}