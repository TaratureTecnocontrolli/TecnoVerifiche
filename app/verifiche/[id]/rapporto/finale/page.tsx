import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type GenericRecord = Record<string, any>;

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

function formatNumber(value: unknown, digits = 4) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: digits,
  }).format(number);
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
      <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-bold text-slate-950">
        {label}
      </td>
      <td
        colSpan={colSpan}
        className="border border-slate-300 px-2 py-1 text-slate-950"
      >
        {textValue(value)}
      </td>
    </>
  );
}

function PageShell({
  children,
  footer,
  breakBefore,
}: {
  children: React.ReactNode;
  footer?: string;
  breakBefore?: boolean;
}) {
  return (
    <section
      className={
        "relative mx-auto min-h-[1123px] w-[794px] overflow-hidden bg-white shadow-lg print:shadow-none " +
        (breakBefore ? "print:break-before-page" : "")
      }
    >
      <img
        src={LETTERHEAD_IMAGE_SRC}
        alt="Carta intestata Tecnocontrolli"
        className="absolute inset-0 h-[1123px] w-full object-cover"
      />

      <div className="relative z-10 px-[60px] pb-16 pt-[132px]">
        {children}
      </div>

      {footer && (
        <div className="absolute bottom-[28px] left-[60px] right-[60px] z-10 border-t border-slate-300 pt-2 text-center text-[9px] text-slate-700">
          {footer}
        </div>
      )}
    </section>
  );
}

function CoverPage({
  record,
  details,
  customerSnapshot,
  reportNumber,
}: {
  record: GenericRecord;
  details: GenericRecord;
  customerSnapshot: GenericRecord;
  reportNumber: string;
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

  const reportDate = details.report_date ?? new Date().toISOString().slice(0, 10);

  const acceptance = [
    details.acceptance_number,
    details.acceptance_date ? "del " + formatDate(details.acceptance_date) : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PageShell
      footer={
        "Pagina 1 del Rapporto di Prova " +
        reportNumber +
        " del " +
        formatDate(reportDate)
      }
    >
      <div className="text-right text-[13px] font-semibold text-slate-950">
        Calderara di Reno, {formatDate(reportDate)}
      </div>

      <table className="mt-10 w-full border-collapse text-[13px]">
        <tbody>
          <tr>
            <td className="w-[185px] border border-slate-900 px-3 py-4 font-black uppercase">
              Rapporto di prova
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {reportNumber}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 px-3 py-4 font-black uppercase">
              N. cliente
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {textValue(customerNumber)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 px-3 py-4 font-black uppercase">
              Committente
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {textValue(customerName)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 px-3 py-4 font-black uppercase">
              Oggetto dei lavori
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {textValue(details.work_object)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 px-3 py-4 font-black uppercase">
              Cantiere
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {textValue(details.site_description ?? record.location)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 px-3 py-4 font-black uppercase">
              Prove richieste
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {textValue(details.requested_tests)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 px-3 py-4 font-black uppercase">
              Data delle prove
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {formatDate(details.test_date ?? record.verification_date)}
            </td>
          </tr>

          <tr>
            <td className="border border-slate-900 px-3 py-4 font-black uppercase">
              Accettazione int.
            </td>
            <td className="border border-slate-900 px-3 py-4 font-black">
              {acceptance || "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-32 text-center text-[12px] font-bold">
        (il presente rapporto di prova si compone delle pagine generate dal
        sistema)
      </p>
    </PageShell>
  );
}

function TextPage({
  record,
  details,
  customerSnapshot,
  reportNumber,
}: {
  record: GenericRecord;
  details: GenericRecord;
  customerSnapshot: GenericRecord;
  reportNumber: string;
}) {
  const reportDate = details.report_date ?? new Date().toISOString().slice(0, 10);

  return (
    <PageShell
      breakBefore
      footer={
        "Pagina testo del Rapporto di Prova " +
        reportNumber +
        " del " +
        formatDate(reportDate)
      }
    >
      <section className="space-y-6 text-[13px] leading-7 text-slate-950">
        <div>
          <h2 className="mb-3 text-[15px] font-black uppercase">1. Premessa</h2>
          {splitText(details.premise_text).map((paragraph, index) => (
            <p key={index} className="mb-2">
              {paragraph}
            </p>
          ))}

          <div className="mx-auto mt-6 flex h-[260px] w-[470px] items-center justify-center border border-slate-200 text-slate-400">
            {details.instrument_photo_url ? (
              <img
                src={details.instrument_photo_url}
                alt="Strumento in prova"
                className="h-full w-full object-contain"
              />
            ) : (
              "Spazio foto strumento"
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-[15px] font-black uppercase">
            2. Scopo della prova
          </h2>
          {splitText(details.scope_text).map((paragraph, index) => (
            <p key={index} className="mb-2">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-[15px] font-black uppercase">
            3. Descrizione dell&apos;apparato di verifica
          </h2>
          {splitText(details.apparatus_description).map((paragraph, index) => (
            <p key={index} className="mb-2">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-[15px] font-black uppercase">
            4. Descrizione e modalità di esecuzione della verifica di taratura
          </h2>
          {splitText(details.execution_method).map((paragraph, index) => (
            <p key={index} className="mb-2">
              {paragraph}
            </p>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function FormulaPage({
  record,
  details,
  reportNumber,
}: {
  record: GenericRecord;
  details: GenericRecord;
  reportNumber: string;
}) {
  const reportDate = details.report_date ?? new Date().toISOString().slice(0, 10);
  const isPressure =
    record.verification_module === "PRESSURE" || record.mode === "pressione";
  const isTorque =
    record.verification_module === "TORQUE" || record.mode === "dinamometria";
  const isFlow = record.verification_module === "FLOW" || record.mode === "portata";
  const isSclerometric =
    record.verification_module === "SCLEROMETRIC" || record.mode === "sclerometro";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";

  let formulaText: string[] = [
    "La verifica del punto di gradazione della scala viene effettuata leggendo il corrispondente valore effettivo sul dispositivo di verifica, con carico di prova crescente, quando i sistemi sono in equilibrio.",
    "Per ogni livello di carico l'errore relativo di accuratezza, espresso in percentuale, viene determinato confrontando il carico indicato dalla macchina con la media delle letture del dispositivo campione.",
    "L'errore relativo di ripetibilità è determinato a partire dalla differenza tra il valore massimo e il valore minimo delle letture rilevate.",
  ];

  if (isPressure) {
    formulaText = [
      "La verifica viene eseguita confrontando i valori indicati dallo strumento in prova con i valori applicati tramite lo strumento campione.",
      "Per ogni punto vengono rilevate tre letture dello strumento in prova.",
      "Errore medio = Carico applicato - Media letture.",
      "Errore accuratezza % = [(Carico applicato - Media letture) / Carico applicato] × 100.",
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
      "Errore % (solo prova di linearità) = (Media letture / Peso campione - 1) × 100.",
      "Errore ripetibilità % = [(Lettura massima - Lettura minima) / Media letture] × 100.",
      "Eccentricità (zona centrale) = Media delle ripetibilità delle cinque zone - Ripetibilità della zona centrale.",
    ];
  }

  return (
    <PageShell
      breakBefore
      footer={
        "Pagina espressione risultati del Rapporto di Prova " +
        reportNumber +
        " del " +
        formatDate(reportDate)
      }
    >
      <section className="space-y-6 text-[13px] leading-7 text-slate-950">
        <div>
          <h2 className="mb-4 text-[15px] font-black uppercase">
            5. Espressione dei risultati
          </h2>

          {formulaText.map((paragraph, index) => (
            <p key={index} className="mb-2">
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
                  {textValue(details.temperature)}
                </td>
                <td className="border border-slate-900 p-2 font-bold">
                  {textValue(details.humidity)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 rounded-lg border border-slate-200 p-4 text-[12px] leading-6">
            Nota: la sezione tecnica di verifica della taratura costituisce
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
  nominalLabel = "Volume nominale",
  appliedLabel = "Carico applicato",
}: {
  measurements: GenericRecord[];
  showNominalColumn: boolean;
  nominalLabel?: string;
  appliedLabel?: string;
}) {
  return (
    <table className="w-full border-collapse text-center text-[8px]">
      <thead>
        <tr className="bg-slate-700 text-white">
          <th className="border border-slate-600 p-1">Punto di verifica</th>
          {showNominalColumn && (
            <th className="border border-slate-600 p-1">{nominalLabel}</th>
          )}
          <th className="border border-slate-600 p-1">{appliedLabel}</th>
          <th className="border border-slate-600 p-1">Lettura I° ciclo</th>
          <th className="border border-slate-600 p-1">Lettura II° ciclo</th>
          <th className="border border-slate-600 p-1">Lettura III° ciclo</th>
          <th className="border border-slate-600 p-1">Lettura massima</th>
          <th className="border border-slate-600 p-1">Lettura minima</th>
          <th className="border border-slate-600 p-1">Media letture</th>
          <th className="border border-slate-600 p-1">Errore medio</th>
          <th className="border border-slate-600 p-1">Errore accuratezza %</th>
          <th className="border border-slate-600 p-1">
            Errore ripetibilità %
          </th>
        </tr>
      </thead>
      <tbody>
        {measurements.length === 0 ? (
          <tr>
            <td
              colSpan={showNominalColumn ? 12 : 11}
              className="border border-slate-300 p-3"
            >
              Nessun punto di misura salvato per questa scala.
            </td>
          </tr>
        ) : (
          measurements.map((measurement) => (
            <tr key={measurement.id}>
              <td className="border border-slate-300 p-1">
                {textValue(measurement.point_order)}
              </td>
              {showNominalColumn && (
                <td className="border border-slate-300 p-1">
                  {formatNumber(measurement.nominal_value)}
                </td>
              )}
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.applied_value)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.cycle_1)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.cycle_2)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.cycle_3)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.max_value)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.min_value)}
              </td>
              <td className="border border-slate-300 p-1 font-bold">
                {formatNumber(measurement.average_value)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.mean_error)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.accuracy_error_percent)}
              </td>
              <td className="border border-slate-300 p-1">
                {formatNumber(measurement.repeatability_error_percent)}
              </td>
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
  referenceSnapshot,
  procedureSnapshot,
  reportNumber,
}: {
  record: GenericRecord;
  details: GenericRecord;
  scale: GenericRecord;
  measurements: GenericRecord[];
  customerSnapshot: GenericRecord;
  referenceSnapshot: GenericRecord;
  procedureSnapshot: GenericRecord;
  reportNumber: string;
}) {
  const reportDate = details.report_date ?? new Date().toISOString().slice(0, 10);
  const isFlow = record.verification_module === "FLOW" || record.mode === "portata";
  const isMass = record.verification_module === "MASS" || record.mode === "massa";
  const showNominalColumn = isFlow || isMass;
  const nominalLabel = isMass ? "Peso nominale" : "Volume nominale";
  const appliedLabel = isFlow
    ? "Volume impostato"
    : isMass
      ? "Peso campione"
      : "Carico applicato";

  const maxAccuracy = measurements.reduce((current, measurement) => {
    const value = Math.abs(Number(measurement.accuracy_error_percent ?? 0));
    return Math.max(current, value);
  }, 0);

  const maxRepeatability = measurements.reduce((current, measurement) => {
    const value = Math.abs(Number(measurement.repeatability_error_percent ?? 0));
    return Math.max(current, value);
  }, 0);

  return (
    <PageShell
      breakBefore
      footer={
        "Sezione tecnica del Rapporto di Prova " +
        reportNumber +
        " del " +
        formatDate(reportDate)
      }
    >
      <div className="text-right text-[11px] font-semibold text-slate-900">
        Sezione tecnica integrante del Rapporto di Prova {reportNumber}
      </div>

      <h2 className="mt-6 text-center text-[18px] font-black uppercase tracking-wide">
        Sezione tecnica di verifica della taratura
      </h2>

      <p className="mt-2 text-center text-[12px] font-bold">
        {textValue(scale.scale_name)}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 text-[9px]">
        <table className="border-collapse">
          <thead>
            <tr className="bg-slate-700 text-left text-white">
              <th colSpan={2} className="border border-slate-900 px-2 py-1">
                Dati generali
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <DataCell
                label="N. cliente"
                value={customerSnapshot.customer_number}
              />
            </tr>
            <tr>
              <DataCell label="Cliente" value={customerSnapshot.customer_name} />
            </tr>
            <tr>
              <DataCell
                label="Sede prova"
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
            <tr>
              <DataCell label="Operatore" value={record.operator_name} />
            </tr>
          </tbody>
        </table>

        <table className="border-collapse">
          <thead>
            <tr className="bg-slate-700 text-left text-white">
              <th colSpan={2} className="border border-slate-900 px-2 py-1">
                Procedura e condizioni
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <DataCell
                label="Procedura"
                value={
                  textValue(procedureSnapshot.code) +
                  " - Rev. " +
                  textValue(procedureSnapshot.revision)
                }
              />
            </tr>
            <tr>
              <DataCell
                label="Calcolo"
                value={procedureSnapshot.calculation_engine_version}
              />
            </tr>
            <tr>
              <DataCell label="Temp." value={details.temperature} />
            </tr>
            <tr>
              <DataCell label="Umidità" value={details.humidity} />
            </tr>
          </tbody>
        </table>
      </div>

      <table className="mt-3 w-full border-collapse text-[9px]">
        <thead>
          <tr className="bg-slate-700 text-left text-white">
            <th colSpan={4} className="border border-slate-900 px-2 py-1">
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
          <tr className="bg-slate-700 text-left text-white">
            <th colSpan={4} className="border border-slate-900 px-2 py-1">
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
              value={formatNumber(maxAccuracy) + " %"}
            />
            <DataCell
              label="Errore ripetibilità max"
              value={formatNumber(maxRepeatability) + " %"}
            />
          </tr>
        </tbody>
      </table>

      <table className="mt-3 w-full border-collapse text-[9px]">
        <thead>
          <tr className="bg-slate-700 text-left text-white">
            <th colSpan={4} className="border border-slate-900 px-2 py-1">
              Strumento campione usato
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
              value={referenceSnapshot.measurement_range}
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

      <div className="mt-3 overflow-x-auto">
        <TechnicalTable
          measurements={measurements}
          showNominalColumn={showNominalColumn}
          nominalLabel={nominalLabel}
          appliedLabel={appliedLabel}
        />
      </div>
    </PageShell>
  );
}

function SignaturePage({
  details,
  reportNumber,
}: {
  details: GenericRecord;
  reportNumber: string;
}) {
  const reportDate = details.report_date ?? new Date().toISOString().slice(0, 10);

  return (
    <PageShell
      breakBefore
      footer={
        "Pagina sottoscrizione del Rapporto di Prova " +
        reportNumber +
        " del " +
        formatDate(reportDate)
      }
    >
      <section className="text-[13px] leading-7 text-slate-950">
        <h2 className="mb-6 text-[15px] font-black uppercase">
          7. Sottoscrizione del rapporto
        </h2>

        <p>
          Il presente Rapporto di Prova, comprensivo della sezione tecnica di
          verifica della taratura, viene redatto, verificato ed emesso dal
          Laboratorio Tecnocontrolli S.r.l. secondo le procedure interne
          applicabili.
        </p>

        <div className="mt-10 grid grid-cols-3 gap-4 text-center text-[11px]">
          <div className="border border-slate-900">
            <div className="bg-slate-700 p-2 font-bold text-white">
              Il Tecnico addetto alle prove
            </div>
            <div className="flex h-[115px] items-center justify-center">
              {textValue(details.technician_name)}
            </div>
          </div>

          <div className="border border-slate-900">
            <div className="bg-slate-700 p-2 font-bold text-white">
              Redatto / verificato
            </div>
            <div className="flex h-[115px] items-center justify-center">
              {textValue(details.reviewer_name)}
            </div>
          </div>

          <div className="border border-slate-900">
            <div className="bg-slate-700 p-2 font-bold text-white">
              Il Direttore di laboratorio
            </div>
            <div className="flex h-[115px] items-center justify-center">
              {textValue(details.director_name)}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export default async function FinalReportPage({ params }: PageProps) {
  const { id } = await params;

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

  const details = asObject(detailsData);
  const scales = (scalesData ?? []) as GenericRecord[];
  const measurements = (measurementsData ?? []) as GenericRecord[];

  const customerSnapshot = asObject(record.customer_instrument_snapshot);
  const referenceSnapshot = asObject(record.reference_instrument_snapshot);
  const procedureSnapshot = asObject(record.procedure_snapshot);

  const reportNumber =
    textValue(details.main_report_number, "") ||
    textValue(record.record_number, "") ||
    "SENZA NUMERO";

  return (
    <AppShell>
      <div className="space-y-8 bg-slate-100 p-6 print:bg-white print:p-0">
        <CoverPage
          record={record}
          details={details}
          customerSnapshot={customerSnapshot}
          reportNumber={reportNumber}
        />

        <TextPage
          record={record}
          details={details}
          customerSnapshot={customerSnapshot}
          reportNumber={reportNumber}
        />

        <FormulaPage
          record={record}
          details={details}
          reportNumber={reportNumber}
        />

        {scales.map((scale) => {
          const scaleMeasurements = measurements.filter(
            (measurement) => measurement.scale_id === scale.id
          );

          const scaleReferenceSnapshot =
            asObject(scale.reference_instrument_snapshot).name ||
            asObject(scale.reference_instrument_snapshot).instrument_id
              ? asObject(scale.reference_instrument_snapshot)
              : referenceSnapshot;

          return (
            <TechnicalPage
              key={scale.id}
              record={record}
              details={details}
              scale={scale}
              measurements={scaleMeasurements}
              customerSnapshot={customerSnapshot}
              referenceSnapshot={scaleReferenceSnapshot}
              procedureSnapshot={procedureSnapshot}
              reportNumber={reportNumber}
            />
          );
        })}

        <SignaturePage details={details} reportNumber={reportNumber} />
      </div>
    </AppShell>
  );
}
