import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import MeasurementErrorChart from "@/components/MeasurementErrorChart";
import ReportPrintButton from "@/components/ReportPrintButton";
import FinalReportPhotosInline from "@/components/FinalReportPhotosInline";
import ReportStatusActions from "@/components/ReportStatusActions";
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

type PageDescriptor =
  | { type: "cover" }
  | { type: "text" }
  | { type: "formula" }
  | { type: "technical"; plan: ScalePlan }
  | { type: "chart"; chart: ChartPageInfo }
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
  const sources = [
    input.customerSnapshot ?? {},
    input.scale ?? {},
    ...referenceSnapshots,
    input.record ?? {},
  ];

  return normalizeUnit(
    firstTextValueFromSources(sources, [
      "unit",
      "measurement_unit",
      "unita_misura",
      "unit_of_measure",
    ])
  );
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

function ReportPhotosInline({
  title,
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
      <h3 className="mb-2 text-[12px] font-black uppercase">{title}</h3>

      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo, index) => (
          <figure
            key={photo.id || String(index)}
            className="break-inside-avoid rounded-sm border border-slate-300 bg-white/70 p-2"
          >
            <div className="flex h-[190px] items-center justify-center border border-slate-200 bg-white">
              <img
                src={photo.photo_url}
                alt={photo.caption || photo.file_name || title}
                className="h-full w-full object-contain"
              />
            </div>

            <figcaption className="mt-1 text-center text-[8.5px] leading-tight text-slate-800">
              {photo.caption || photo.file_name || title}
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
  const email = firstValue(["email", "mail"]);
  const pec = firstValue(["pec", "certified_email"]);
  const phone = firstValue(["phone", "telephone", "telefono"]);

  const addressLine = [address, postalCode, city, province ? "(" + province + ")" : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  return [
    name,
    vat ? "P. IVA " + vat : null,
    taxCode ? "C.F. " + taxCode : null,
    addressLine || null,
    pec ? "PEC " + pec : null,
    email && email !== pec ? "Email " + email : null,
    phone ? "Tel. " + phone : null,
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
        "relative mx-auto min-h-[1123px] w-[794px] overflow-hidden bg-white shadow-lg print:shadow-none " +
        (pageNumber > 1 ? "print:break-before-page" : "")
      }
    >
      <img
        src={LETTERHEAD_IMAGE_SRC}
        alt="Carta intestata Tecnocontrolli"
        className="pointer-events-none absolute inset-0 z-0 block h-full w-full object-fill print:block"
      />

      <div className="relative z-10 px-[60px] pb-16 pt-[132px]">
        {children}
      </div>

      <div className="absolute bottom-[28px] left-[60px] right-[60px] z-10 border-t border-slate-300 pt-2 text-center text-[10px] leading-tight text-slate-700">
        <p>
          Pagina {pageNumber} di {totalPages} del Rapporto di Prova{" "}
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

      <p className="mt-90 text-center text-[12px] font-bold">
        Questo rapporto di prova è composto da n. {totalPages} pagine.
      </p>
    </PageShell>
  );
}

function TextPage({
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

  const executionMethodParagraphs = isForceReport
    ? forceExecutionMethodText()
    : splitText(details.execution_method);

  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <section className="space-y-6 text-justify text-[13px] leading-5 text-slate-950">
        <div>
          <h2 className="mt-10 mb-1 text-[15px] font-black uppercase">1. Premessa</h2>
          {premiseParagraphs.map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}

          <FinalReportPhotosInline
            recordId={String(record.id)}
            category="instrument"
            title="Foto strumento"
            variant="clean-large"
          />
        </div>

        <div>
          <h2 className="mb-3 text-[15px] font-black uppercase">
            2. Scopo della prova
          </h2>
          {scopeParagraphs.map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-[15px] font-black uppercase">
            3. Descrizione dell&apos;apparato di verifica
          </h2>
          {apparatusDescriptionText().map((paragraph, index) => (
            <p key={index} className="mb-0.5 text-justify">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-[15px] font-black uppercase">
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
      "Errore % (solo prova di linearità) = (Media letture / Peso nominale - 1) × 100.",
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
    formulaText = [
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
      <section className="space-y-6 text-justify text-[13px] leading-5 text-slate-950">
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
            6. Risultati della verifica
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

function TechnicalTable({
  measurements,
  showNominalColumn,
  showUncertaintyColumn,
  showThirdCycleColumn = true,
  nominalLabel = "Volume nominale",
  appliedLabel = "Carico applicato",
  measurementUnit = "",
}: {
  measurements: GenericRecord[];
  showNominalColumn: boolean;
  showUncertaintyColumn?: boolean;
  showThirdCycleColumn?: boolean;
  nominalLabel?: string;
  appliedLabel?: string;
  measurementUnit?: string;
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
    <table className="w-full border-collapse bg-white/35 text-center text-[8px]">
      <thead>
        <tr className="bg-slate-700/65 text-slate-950">
          <th className="border border-slate-600 px-1 py-0.5">{labelWithUnit("Punto di verifica", measurementUnit)}</th>
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
                {textValue(measurement.point_order)}
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
  customerSnapshot,
  referenceSnapshots,
  procedureSnapshot,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  record: GenericRecord;
  details: GenericRecord;
  scale: GenericRecord;
  measurements: GenericRecord[];
  customerSnapshot: GenericRecord;
  referenceSnapshots: GenericRecord[];
  procedureSnapshot: GenericRecord;
  reportNumber: string;
  reportDate: unknown;
  pageNumber: number;
  totalPages: number;
}) {
  const isPressure =
    record.verification_module === "PRESSURE" || record.mode === "pressione";
  const isFlow = record.verification_module === "FLOW" || record.mode === "portata";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";
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

  const maxAccuracy = maxAbsoluteValue(measurements, "accuracy_error_percent");

  const maxRepeatability = maxAbsoluteValue(
    measurements,
    "repeatability_error_percent"
  );

  return (
    <PageShell
      pageNumber={pageNumber}
      totalPages={totalPages}
      reportNumber={reportNumber}
      reportDate={reportDate}
    >
      <div className="mt-10 text-right text-[11px] font-semibold text-slate-900">
        Sezione tecnica integrante del Rapporto di Prova {reportNumber}
      </div>

      <h2 className="mt-6 text-center text-[18px] font-black uppercase tracking-wide">
        Sezione tecnica di verifica di taratura
      </h2>

      <p className="mt-2 text-center text-[12px] font-bold">
        {textValue(scale.scale_name)}
      </p>

      <div className="mt-5 text-[9px]">
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
       </div>

      <table className="mt-3 w-full border-collapse text-[9px]">
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
      </table>

      <table className="mt-3 w-full border-collapse text-[9px]">
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
            <DataCell label="Fondo scala" value={scale.scale_range} />
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
      </table>

      {referenceSnapshots.map((referenceSnapshot, referenceIndex) => (
        <table
          key={referenceIndex}
          className="mt-3 w-full border-collapse text-[9px]"
        >
          <thead>
            <tr className="bg-slate-700/65 text-left text-slate-950">
              <th colSpan={4} className="border border-slate-900 px-2 py-0.5">
                {referenceSnapshots.length > 1
                  ? "Strumento campione usato " + String(referenceIndex + 1)
                  : "Strumento campione usato"}
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
              <DataCell
                label="Matricola"
                value={referenceSnapshot.serial_number}
              />
            </tr>
            <tr>
              <DataCell
                label="Cod. int."
                value={referenceSnapshot.internal_code}
              />
              <DataCell
                label="Fondo scala"
                value={
                  [
                    textValue(referenceSnapshot.measurement_range, ""),
                    normalizeUnit(
                      firstTextValueFromSources([referenceSnapshot], [
                        "unit",
                        "measurement_unit",
                        "unita_misura",
                        "unit_of_measure",
                      ])
                    ),
                  ]
                    .filter(Boolean)
                    .join(" ") || "-"
                }
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
      ))}

      <div className="mt-3 overflow-x-auto">
        <TechnicalTable
          measurements={measurements}
          showNominalColumn={showNominalColumn}
          showUncertaintyColumn={isDimensional}
          nominalLabel={nominalLabel}
          appliedLabel={appliedLabel}
          measurementUnit={measurementUnit}
          showThirdCycleColumn={!isPressure}
        />
      </div>
    </PageShell>
  );
}

function ChartPage({
  measurements,
  title,
  reportNumber,
  reportDate,
  pageNumber,
  totalPages,
}: {
  measurements: MeasurementLike[];
  title: string;
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
      <div className="mt-10 text-right text-[11px] font-semibold text-slate-900">
        Sezione tecnica integrante del Rapporto di Prova {reportNumber}
      </div>

      <div className="mt-8 rounded-2xl bg-white/45 p-2">
        <MeasurementErrorChart measurements={measurements} title={title} />
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
          7. Sottoscrizione del rapporto
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
  const procedureSnapshot = asObject(record.procedure_snapshot);
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
  const isSclerometric =
    record.verification_module === "SCLEROMETRIC" || record.mode === "sclerometro";

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
      } else if (hasValidChartMeasurements(chartMeasurements)) {
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

  const pageDescriptors: PageDescriptor[] = [
    { type: "cover" },
    { type: "text" },
    { type: "formula" },
    ...scalePlans.flatMap((plan): PageDescriptor[] => [
      { type: "technical", plan },
      ...plan.chartPages.map(
        (chart): PageDescriptor => ({ type: "chart", chart })
      ),
    ]),
    { type: "signature" },
  ];

  const totalPages = pageDescriptors.length;
  return (
    <AppShell>
      <div className="space-y-8 bg-slate-100 p-6 print:bg-white print:p-0">
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

        <ReportStatusActions
          recordId={id}
          initialStatus={typeof record.report_status === "string" ? record.report_status : "draft"}
          issuedAt={typeof record.issued_at === "string" ? record.issued_at : null}
          reopenedAt={typeof record.reopened_at === "string" ? record.reopened_at : null}
          documentLabel="rapporto VT"
        />

        {pageDescriptors.map((descriptor, index) => {
          const pageNumber = index + 1;

          if (descriptor.type === "cover") {
            return (
              <CoverPage
                key="cover"
                record={record}
                details={details}
                customerSnapshot={customerSnapshot}
                customerMaster={customerMaster}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          if (descriptor.type === "text") {
            return (
              <TextPage
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
              <TechnicalPage
                key={"technical-" + descriptor.plan.scale.id}
                record={record}
                details={details}
                scale={descriptor.plan.scale}
                measurements={descriptor.plan.scaleMeasurements}
                customerSnapshot={customerSnapshot}
                referenceSnapshots={descriptor.plan.scaleReferenceSnapshots}
                procedureSnapshot={procedureSnapshot}
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
                key={"chart-" + descriptor.chart.key}
                measurements={descriptor.chart.measurements}
                title={descriptor.chart.title}
                reportNumber={reportNumber}
                reportDate={reportDate}
                pageNumber={pageNumber}
                totalPages={totalPages}
              />
            );
          }

          return (
            <SignaturePage
              key="signature"
              details={details}
              testingSignatures={testingSignatures}
              reviewerSignatures={reviewerSignatures}
              directorSignature={directorSignature}
              reportNumber={reportNumber}
              reportDate={reportDate}
              pageNumber={pageNumber}
              totalPages={totalPages}
            />
          );
        })}
      </div>
    </AppShell>
  );
}

