import Link from "next/link";
import AppShell from "@/components/AppShell";
import ReportPrintButton from "@/components/ReportPrintButton";
import ReportStatusActions from "@/components/ReportStatusActions";
import InternalReportSignaturesForm, { InternalReportSignaturePreview } from "@/components/InternalReportSignaturesForm";
import InternalReportNumberForm from "@/components/InternalReportNumberForm";
import TemperatureErrorChart, { type TemperatureErrorMeasurement } from "@/components/TemperatureErrorChart";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{
    id: string;


}>;
};

type JsonObject = Record<string, unknown>;

type CalibrationRecord = {
  id: string;
  record_number: string | null;
  verification_scope: string | null;
  verified_instrument_type: string | null;
  output_type: string | null;
  internal_instrument_id: string | null;
  verification_module: string | null;
  mode: string | null;
  verification_date: string | null;
  operator_name: string | null;
  location: string | null;
  customer_instrument_snapshot: unknown;
  reference_instrument_snapshot: unknown;
  procedure_snapshot: unknown;
  notes: string | null;
  report_status: string | null;
  issued_at: string | null;
  reopened_at: string | null;
  created_at: string;
};

type CalibrationReportDetails = {
  main_report_number: string | null;
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
  technician_name: string | null;
  reviewer_name: string | null;
  director_name: string | null;
  notes: string | null;
};

type CalibrationScale = {
  id: string;
  scale_order: number | null;
  scale_name: string | null;
  scale_range: string | null;
  reference_instrument_snapshot: unknown;
  reference_instruments_snapshot: unknown;
  notes: string | null;
};

type CalibrationMeasurement = {
  id: string;
  scale_id: string | null;
  section: string | null;
  point_order: number | null;
  nominal_value: number | null;
  applied_value: number | null;
  cycle_1: number | null;
  cycle_2: number | null;
  cycle_3: number | null;
  max_value: number | null;
  min_value: number | null;
  average_value: number | null;
  mean_error: number | null;
  accuracy_error_percent: number | null;
  repeatability_error_percent: number | null;
  result: string | null;
  notes: string | null;
};

type SignatureRow = {
  id?: string;
  signature_role?: string | null;
  display_name?: string | null;
  signature_url_snapshot?: string | null;
  sort_order?: number | null;
};

const LETTERHEAD_IMAGE_SRC = "/carta_intestata_rev02.png";

function asObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return {};
}

function asObjectArray(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asObject(item))
    .filter((item) => Object.keys(item).length > 0);
}

function textValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}

function formatDate(date: string | null | undefined) {
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function formatNumber(value: number | null | undefined, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
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

function modeLabel(record: CalibrationRecord) {
  const module = record.verification_module;
  const mode = record.mode;

  if (module === "PRESSURE" || mode === "pressione") return "Pressione";
  if (module === "TORQUE" || mode === "dinamometria") return "Chiavi dinamometriche";
  if (module === "FLOW" || mode === "portata") return "Portata / contalitri";
  if (module === "SCLEROMETRIC" || mode === "sclerometro") return "Prove sclerometriche";
  if (module === "MASS" || mode === "massa") return "Massa / bilance";
  if (module === "DIMENSIONAL" || mode === "dimensionale") return "Dimensionale";
  if (module === "TEMPERATURE" || mode === "temperatura") return "Temperatura";
  if (module === "PULLOFF" || mode === "pulloff") return "Pull-off";
  if (mode === "compressione") return "Compressione";
  if (mode === "trazione") return "Trazione";

  return textValue(mode);
}

function isPressure(record: CalibrationRecord) {
  return record.verification_module === "PRESSURE" || record.mode === "pressione";
}

function isFlow(record: CalibrationRecord) {
  return record.verification_module === "FLOW" || record.mode === "portata";
}

function isSclerometric(record: CalibrationRecord) {
  return record.verification_module === "SCLEROMETRIC" || record.mode === "sclerometro";
}

function isMass(record: CalibrationRecord) {
  return record.verification_module === "MASS" || record.mode === "massa";
}

function isDimensional(record: CalibrationRecord) {
  return record.verification_module === "DIMENSIONAL" || record.mode === "dimensionale";
}

function isTemperature(record: CalibrationRecord) {
  return record.verification_module === "TEMPERATURE" || record.mode === "temperatura";
}

function getTemperatureVariant(record: CalibrationRecord) {
  const procedureSnapshot = asObject(record.procedure_snapshot);
  const variant = String(procedureSnapshot.temperature_variant ?? "").trim();

  return variant === "instrument_calibration"
    ? "instrument_calibration"
    : "maturation_tank";
}

function isTemperatureInstrumentCalibration(record: CalibrationRecord) {
  return isTemperature(record) && getTemperatureVariant(record) === "instrument_calibration";
}

function textFromObject(source: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeUnit(value: unknown) {
  const unit = textValue(value, "").trim();

  if (!unit || unit === "-") {
    return "";
  }

  return unit;
}

function inferUnitFromText(value: unknown) {
  const text = textValue(value, "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(/(?:^|\s)(kg|g|kN|N|bar|MPa|Mpa|Pa|L\/min|l\/min|l|min|°C|C°|Nm|N·m|mm|cm|m)(?:\s|$)/i);

  if (!match) {
    return "";
  }

  const unit = match[1];

  if (unit.toLowerCase() === "mpa") return "MPa";
  if (unit.toLowerCase() === "l/min") return "L/min";
  if (unit === "C°") return "°C";

  return unit;
}

function labelWithUnit(label: string, unit: string) {
  return unit ? label + " (" + unit + ")" : label;
}

function getMeasurementUnitForScale(
  record: CalibrationRecord,
  scale: CalibrationScale,
  references: JsonObject[]
) {
  for (const reference of references) {
    const unit = normalizeUnit(
      textFromObject(reference, ["unit", "measurement_unit", "unita_misura", "unit_of_measure"])
    );

    if (unit) {
      return unit;
    }
  }

  const scaleUnit = inferUnitFromText(scale.scale_range);

  if (scaleUnit) {
    return scaleUnit;
  }

  if (isTemperature(record)) return "°C";
  if (isMass(record)) return "kg";

  return "";
}

function massPointLabel(scale: CalibrationScale, index: number) {
  const name = String(scale.scale_name ?? "").toLowerCase();

  if (name.includes("eccentric")) {
    return ["Zona C", "Zona 3", "Zona 4", "Zona 1", "Zona 2"][index] || "Zona " + String(index + 1);
  }

  if (name.includes("ripet") || name.includes("linear")) {
    return "Zona C";
  }

  return String(index + 1);
}

function DataCell({ label, value }: { label: string; value: unknown }) {
  return (
    <>
      <td className="border border-slate-300 bg-slate-100/75 px-1 py-[1px] font-bold text-slate-950">
        {label}
      </td>
      <td className="border border-slate-300 bg-white/55 px-1 py-[1px] text-slate-950">
        {textValue(value)}
      </td>
    </>
  );
}

function PageShell({
  children,
  reportNumber,
}: {
  children: React.ReactNode;
  reportNumber: string;
}) {
  return (
    <section className="relative mx-auto min-h-[1123px] w-[794px] overflow-hidden bg-white shadow-lg print:shadow-none">
      <img
        src={LETTERHEAD_IMAGE_SRC}
        alt="Carta intestata Tecnocontrolli"
        className="pointer-events-none absolute inset-0 z-0 block h-[1135px] w-full object-cover print:block"
      />

      <div className="relative z-10 px-[46px] pb-[50px] pt-[112px]">
        {children}
      </div>

      <div className="absolute bottom-[18px] left-[46px] right-[46px] z-10 border-t border-slate-300 pt-1 text-center text-[8px] leading-tight text-slate-700">
        <p>Rapportino tecnico interno {reportNumber}</p>
        <p>
          Documento interno Tecnocontrolli S.r.l. - riproduzione consentita solo
          per finalità tecniche interne.
        </p>
      </div>
    </section>
  );
}

function ReferenceTable({ references }: { references: JsonObject[] }) {
  if (references.length === 0) {
    return null;
  }

  return (
    <table className="mt-2 w-full border-collapse text-[7.3px]">
      <thead>
        <tr className="bg-slate-700/65 text-left text-slate-950">
          <th colSpan={6} className="border border-slate-900 px-1 py-[1px]">
            Strumenti campione utilizzati
          </th>
        </tr>
        <tr className="bg-slate-100/75 text-left">
          <th className="border border-slate-300 px-1 py-[1px]">Strumento</th>
          <th className="border border-slate-300 px-1 py-[1px]">Codice</th>
          <th className="border border-slate-300 px-1 py-[1px]">Costruttore</th>
          <th className="border border-slate-300 px-1 py-[1px]">Matricola</th>
          <th className="border border-slate-300 px-1 py-[1px]">Certificato</th>
          <th className="border border-slate-300 px-1 py-[1px]">Scadenza</th>
        </tr>
      </thead>
      <tbody>
        {references.map((reference, index) => (
          <tr key={String(reference.instrument_id || reference.id || index)} className={index % 2 === 0 ? "bg-white/65" : "bg-slate-100/55"}>
            <td className="border border-slate-300 px-1 py-[1px]">{textValue(reference.name)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{textValue(reference.internal_code)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{textValue(reference.manufacturer)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{textValue(reference.serial_number)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{textValue(reference.certificate_number)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">
              {typeof reference.certificate_expiry === "string"
                ? formatDate(reference.certificate_expiry)
                : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function hasNumericValue(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function hasAnyNumericValue(
  measurements: CalibrationMeasurement[],
  field: keyof CalibrationMeasurement
) {
  return measurements.some((measurement) =>
    hasNumericValue(measurement[field] as number | null | undefined)
  );
}

function TemperatureInstrumentMeasurementsTable({
  measurements,
}: {
  measurements: CalibrationMeasurement[];
}) {
  return (
    <table className="w-full border-collapse bg-white/35 text-center text-[7px]">
      <thead>
        <tr className="bg-slate-700/65 text-slate-950">
          <th className="border border-slate-600 px-1 py-[1px]">Punto</th>
          <th className="border border-slate-600 px-1 py-[1px]">
            Temperatura applicata (°C)
          </th>
          <th className="border border-slate-600 px-1 py-[1px]">
            Lettura 1 (°C)
          </th>
          <th className="border border-slate-600 px-1 py-[1px]">
            Lettura 2 (°C)
          </th>
          <th className="border border-slate-600 px-1 py-[1px]">
            Media (°C)
          </th>
          <th className="border border-slate-600 px-1 py-[1px]">
            Errore (°C)
          </th>
        </tr>
      </thead>
      <tbody>
        {measurements.map((measurement, index) => (
          <tr
            key={measurement.id}
            className={index % 2 === 0 ? "bg-white/65" : "bg-slate-100/55"}
          >
            <td className="border border-slate-300 px-1 py-[1px]">
              {textValue(measurement.point_order)}
            </td>
            <td className="border border-slate-300 px-1 py-[1px]">
              {formatNumber(measurement.applied_value)}
            </td>
            <td className="border border-slate-300 px-1 py-[1px]">
              {formatNumber(measurement.cycle_1)}
            </td>
            <td className="border border-slate-300 px-1 py-[1px]">
              {formatNumber(measurement.cycle_2)}
            </td>
            <td className="border border-slate-300 px-1 py-[1px] font-bold">
              {formatNumber(measurement.average_value)}
            </td>
            <td className="border border-slate-300 px-1 py-[1px]">
              {formatNumber(measurement.mean_error)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GenericMeasurementsTable({
  record,
  scale,
  measurements,
  measurementUnit,
}: {
  record: CalibrationRecord;
  scale: CalibrationScale;
  measurements: CalibrationMeasurement[];
  measurementUnit: string;
}) {
  const pressure = isPressure(record);
  const flow = isFlow(record);
  const showThirdCycle = !pressure && !flow && hasAnyNumericValue(measurements, "cycle_3");
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
  const showResultColumn = measurements.some((measurement) =>
    Boolean(String(measurement.result ?? "").trim())
  );

  return (
    <table className="w-full border-collapse bg-white/35 text-center text-[7px]">
      <thead>
        <tr className="bg-slate-700/65 text-slate-950">
          <th className="border border-slate-600 px-1 py-[1px]">Punto</th>
          <th className="border border-slate-600 px-1 py-[1px]">
            {labelWithUnit(isMass(record) ? "Peso nominale" : isDimensional(record) ? "Valore nominale" : "Punto applicazione", measurementUnit)}
          </th>
          <th className="border border-slate-600 px-1 py-[1px]">{labelWithUnit("Lettura 1", measurementUnit)}</th>
          <th className="border border-slate-600 px-1 py-[1px]">{labelWithUnit("Lettura 2", measurementUnit)}</th>
          {showThirdCycle && (
            <th className="border border-slate-600 px-1 py-[1px]">{labelWithUnit("Lettura 3", measurementUnit)}</th>
          )}
          {showMaxColumn && <th className="border border-slate-600 px-1 py-[1px]">{labelWithUnit("Max", measurementUnit)}</th>}
          {showMinColumn && <th className="border border-slate-600 px-1 py-[1px]">{labelWithUnit("Min", measurementUnit)}</th>}
          {showAverageColumn && <th className="border border-slate-600 px-1 py-[1px]">{labelWithUnit("Media", measurementUnit)}</th>}
          {showMeanErrorColumn && <th className="border border-slate-600 px-1 py-[1px]">{labelWithUnit("Errore medio", measurementUnit)}</th>}
          {showAccuracyColumn && <th className="border border-slate-600 px-1 py-[1px]">Errore %</th>}
          {showRepeatabilityColumn && <th className="border border-slate-600 px-1 py-[1px]">Ripet. %</th>}
          {showResultColumn && <th className="border border-slate-600 px-1 py-[1px]">Esito</th>}
        </tr>
      </thead>
      <tbody>
        {measurements.map((measurement, index) => (
          <tr key={measurement.id} className={index % 2 === 0 ? "bg-white/65" : "bg-slate-100/55"}>
            <td className="border border-slate-300 px-1 py-[1px]">{isMass(record) ? massPointLabel(scale, index) : textValue(measurement.point_order)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.applied_value ?? measurement.nominal_value)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.cycle_1)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.cycle_2)}</td>
            {showThirdCycle && (
              <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.cycle_3)}</td>
            )}
            {showMaxColumn && <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.max_value)}</td>}
            {showMinColumn && <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.min_value)}</td>}
            {showAverageColumn && <td className="border border-slate-300 px-1 py-[1px] font-bold">{formatNumber(measurement.average_value)}</td>}
            {showMeanErrorColumn && <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.mean_error)}</td>}
            {showAccuracyColumn && <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.accuracy_error_percent)}</td>}
            {showRepeatabilityColumn && <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.repeatability_error_percent)}</td>}
            {showResultColumn && <td className="border border-slate-300 px-1 py-[1px]">{textValue(measurement.result)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SclerometricTable({ measurements }: { measurements: CalibrationMeasurement[] }) {
  const firstNominal = measurements.find((measurement) => measurement.nominal_value !== null)?.nominal_value ?? 80;
  const lowerLimit = firstNominal - 3;
  const upperLimit = firstNominal + 3;

  return (
    <table className="w-full border-collapse bg-white/35 text-center text-[7px]">
      <thead>
        <tr className="bg-slate-700/65 text-slate-950">
          <th className="border border-slate-600 px-1 py-[1px]">Battuta</th>
          <th className="border border-slate-600 px-1 py-[1px]">LC</th>
          <th className="border border-slate-600 px-1 py-[1px]">L1</th>
          <th className="border border-slate-600 px-1 py-[1px]">L2</th>
          <th className="border border-slate-600 px-1 py-[1px]">L3</th>
          <th className="border border-slate-600 px-1 py-[1px]">Media</th>
          <th className="border border-slate-600 px-1 py-[1px]">Errore medio</th>
          <th className="border border-slate-600 px-1 py-[1px]">Errore medio %</th>
          <th className="border border-slate-600 px-1 py-[1px]">Esito</th>
        </tr>
      </thead>
      <tbody>
        {measurements.map((measurement, index) => (
          <tr key={measurement.id} className={index % 2 === 0 ? "bg-white/65" : "bg-slate-100/55"}>
            <td className="border border-slate-300 px-1 py-[1px]">{textValue(measurement.point_order)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(lowerLimit)} / {formatNumber(upperLimit)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.cycle_1)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.cycle_2)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.cycle_3)}</td>
            <td className="border border-slate-300 px-1 py-[1px] font-bold">{formatNumber(measurement.average_value)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.mean_error)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(measurement.accuracy_error_percent)}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{textValue(measurement.result)}</td>
          </tr>
        ))}
        {measurements.length > 0 && (
          <tr className="bg-slate-200/70 font-bold">
            <td className="border border-slate-300 px-1 py-[1px]" colSpan={2}>Media</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(average(measurements.map((item) => item.cycle_1)))}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(average(measurements.map((item) => item.cycle_2)))}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(average(measurements.map((item) => item.cycle_3)))}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(average(measurements.map((item) => item.average_value)))}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(average(measurements.map((item) => item.mean_error)))}</td>
            <td className="border border-slate-300 px-1 py-[1px]">{formatNumber(average(measurements.map((item) => item.accuracy_error_percent)))}</td>
            <td className="border border-slate-300 px-1 py-[1px]">-</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function average(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => value !== null && Number.isFinite(value));

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function SignatureCard({ signature }: { signature: SignatureRow }) {
  return (
    <div className="flex min-h-[48px] flex-col items-center justify-end border-b border-slate-200 px-1 py-1 last:border-b-0">
      {signature.signature_url_snapshot ? (
        <img
          src={signature.signature_url_snapshot}
          alt={signature.display_name ?? "Firma"}
          className="mb-0.5 h-8 max-w-[125px] object-contain mix-blend-multiply opacity-80"
        />
      ) : (
        <div className="mb-0.5 h-8 w-full border-b border-slate-300" />
      )}

      <span className="text-center text-[8px] leading-tight">
        {textValue(signature.display_name)}
      </span>
    </div>
  );
}

function SignatureGroup({
  title,
  signatures,
}: {
  title: string;
  signatures: SignatureRow[];
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-900 bg-white/35">
      <div className="bg-slate-700/65 px-1 py-[1px] text-center text-[8px] font-bold text-slate-950">
        {title}
      </div>

      <div className="bg-white/10">
        {signatures.length > 0 ? (
          signatures.map((signature, index) => (
            <SignatureCard key={signature.id ?? String(index)} signature={signature} />
          ))
        ) : (
          <div className="flex min-h-[48px] items-end justify-center px-2 py-1">
            <div className="w-full border-b border-slate-300 pb-1 text-center text-[8px] leading-tight">
              -
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getSignaturesByRole(signatures: SignatureRow[], role: string) {
  return signatures
    .filter((signature) => signature.signature_role === role)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function fallbackSignatureRows(nameValue: unknown): SignatureRow[] {
  const names = textValue(nameValue, "")
    .split(/[,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);

  return names.map((name, index) => ({
    id: name + String(index),
    display_name: name,
    signature_url_snapshot: null,
    sort_order: index + 1,
  }));
}

function ScaleCompactBlock({
  record,
  scale,
  measurements,
  references,
}: {
  record: CalibrationRecord;
  scale: CalibrationScale;
  measurements: CalibrationMeasurement[];
  references: JsonObject[];
}) {
  const measurementUnit = getMeasurementUnitForScale(record, scale, references);

  return (
    <div className="mt-2 break-inside-avoid">
      <table className="w-full border-collapse text-[7.3px]">
        <thead>
          <tr className="bg-slate-700/65 text-left text-slate-950">
            <th colSpan={4} className="border border-slate-900 px-1 py-[1px]">
              Scala / prova verificata
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <DataCell label="Scala" value={scale.scale_name} />
            <DataCell label="Fondo scala" value={scale.scale_range} />
          </tr>
          <tr>
            <DataCell label="Note" value={scale.notes} />
            <DataCell label="N. punti" value={String(measurements.length)} />
          </tr>
        </tbody>
      </table>

      <ReferenceTable references={references} />

      <div className="mt-2">
        {measurements.length === 0 ? (
          <div className="rounded border border-slate-200 bg-white/65 p-2 text-[8px] text-slate-500">
            Nessuna misura registrata per questa scala.
          </div>
        ) : isSclerometric(record) ? (
          <SclerometricTable measurements={measurements} />
        ) : isTemperatureInstrumentCalibration(record) ? (
          <TemperatureInstrumentMeasurementsTable measurements={measurements} />
        ) : (
          <GenericMeasurementsTable
            record={record}
            scale={scale}
            measurements={measurements}
            measurementUnit={measurementUnit}
          />
        )}
      </div>

      {isTemperatureInstrumentCalibration(record) && measurements.length > 0 ? (
        <div className="mt-2 break-inside-avoid">
          <TemperatureErrorChart
            compact
            title="Grafico errore di temperatura"
            measurements={measurements.map(
              (measurement): TemperatureErrorMeasurement => ({
                id: measurement.id,
                point_order: measurement.point_order,
                applied_value: measurement.applied_value,
                mean_error: measurement.mean_error,
              })
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

function SinglePageReport({
  record,
  details,
  verifiedInstrument,
  scalePlans,
  signatures,
  reportNumber,
}: {
  record: CalibrationRecord;
  details: CalibrationReportDetails | null;
  verifiedInstrument: JsonObject;
  scalePlans: Array<{
    scale: CalibrationScale;
    scaleMeasurements: CalibrationMeasurement[];
    references: JsonObject[];
  }>;
  signatures: SignatureRow[];
  reportNumber: string;
}) {
  return (
    <PageShell reportNumber={reportNumber}>
      <div className="mt-12 border border-slate-900 bg-slate-700/65 px-2 py-[2px] text-center text-[8.5px] font-black uppercase tracking-wide text-slate-950">
        Verifica interna del {formatDate(record.verification_date)}
      </div>

      <h1 className="mt-2 text-center text-[13px] font-black uppercase tracking-wide">
        Rapportino tecnico interno
      </h1>

      <p className="mt-0.5 text-center text-[8.5px] font-bold">
        VI - Verifica interna - {modeLabel(record)}
      </p>

      <table className="mt-2.5 w-full border-collapse text-[7.3px]">
        <thead>
          <tr className="bg-slate-700/65 text-left text-slate-950">
            <th colSpan={4} className="border border-slate-900 px-1 py-[1px]">
              Dati generali
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <DataCell label="Numero verifica" value={reportNumber} />
            <DataCell label="Tipo" value={modeLabel(record)} />
          </tr>
          <tr>
            <DataCell label="Data verifica" value={formatDate(record.verification_date)} />
            <DataCell label="Luogo prove" value={record.location ?? details?.site_description} />
          </tr>
          <tr>
            <DataCell label="Tecnico" value={record.operator_name ?? details?.technician_name} />
            <DataCell label="Output" value="Rapportino tecnico VI" />
          </tr>
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse text-[7.3px]">
        <thead>
          <tr className="bg-slate-700/65 text-left text-slate-950">
            <th colSpan={4} className="border border-slate-900 px-1 py-[1px]">
              Strumento interno in prova
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <DataCell label="Strumento" value={verifiedInstrument.instrument_name ?? verifiedInstrument.name} />
            <DataCell label="Codice interno" value={verifiedInstrument.internal_code} />
          </tr>
          <tr>
            <DataCell label="Costruttore" value={verifiedInstrument.manufacturer} />
            <DataCell label="Modello" value={verifiedInstrument.model} />
          </tr>
          <tr>
            <DataCell label="Matricola" value={verifiedInstrument.serial_number} />
            <DataCell label="Campo/fondo scala" value={verifiedInstrument.measurement_range ?? verifiedInstrument.range} />
          </tr>
          <tr>
            <DataCell label="Reparto" value={verifiedInstrument.department} />
            <DataCell label="Ubicazione" value={verifiedInstrument.location} />
          </tr>
        </tbody>
      </table>

      <div className="mt-2">
        {scalePlans.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[8px] text-amber-900">
            Nessuna scala/prova associata alla verifica.
          </div>
        ) : (
          scalePlans.map((plan) => (
            <ScaleCompactBlock
              key={plan.scale.id}
              record={record}
              scale={plan.scale}
              measurements={plan.scaleMeasurements}
              references={plan.references}
            />
          ))
        )}
      </div>

      <InternalReportSignaturePreview
        recordId={record.id}
        initialSignatures={signatures
          .filter(
            (signature) =>
              signature.signature_role === "testing_technician" ||
              signature.signature_role === "reviewer" ||
              signature.signature_role === "director"
          )
          .map((signature, index) => ({
            id: signature.id,
            signature_role: signature.signature_role as
              | "testing_technician"
              | "reviewer"
              | "director",
            technician_id: null,
            display_name: textValue(signature.display_name),
            signature_url_snapshot: signature.signature_url_snapshot ?? null,
            sort_order: Number(signature.sort_order ?? index + 1),
          }))}
        fallbackTestingName={record.operator_name || details?.technician_name}
        fallbackReviewerName={details?.reviewer_name}
        fallbackDirectorName="Cardone"
      />
    </PageShell>
  );
}

export default async function InternalTechnicalReportPage({ params }: PageProps) {
  const { id } = await params;

  
  const supabase = await createServerSupabaseClient();
const { data: recordData, error: recordError } = await supabase
    .from("calibration_records")
    .select(
      `
      id,
      record_number,
      verification_scope,
      verified_instrument_type,
      output_type,
      internal_instrument_id,
      verification_module,
      mode,
      verification_date,
      operator_name,
      location,
      customer_instrument_snapshot,
      reference_instrument_snapshot,
      procedure_snapshot,
      notes,
      report_status,
      issued_at,
      reopened_at,
      created_at
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (recordError) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          Errore caricamento rapportino interno: {recordError.message}
        </div>
      </AppShell>
    );
  }

  if (!recordData) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link
            href="/verifiche"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna alle verifiche
          </Link>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Rapportino interno non trovato.
          </div>
        </div>
      </AppShell>
    );
  }

  const record = recordData as CalibrationRecord;

  const { data: detailsData } = await supabase
    .from("calibration_report_details")
    .select(
      `
      main_report_number,
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
      technician_name,
      reviewer_name,
      director_name,
      notes
    `
    )
    .eq("calibration_record_id", id)
    .maybeSingle();

  const { data: scalesData } = await supabase
    .from("calibration_record_scales")
    .select(
      `
      id,
      scale_order,
      scale_name,
      scale_range,
      reference_instrument_snapshot,
      reference_instruments_snapshot,
      notes
    `
    )
    .eq("calibration_record_id", id)
    .order("scale_order", { ascending: true });

  const { data: measurementsData } = await supabase
    .from("calibration_measurements")
    .select(
      `
      id,
      scale_id,
      section,
      point_order,
      nominal_value,
      applied_value,
      cycle_1,
      cycle_2,
      cycle_3,
      max_value,
      min_value,
      average_value,
      mean_error,
      accuracy_error_percent,
      repeatability_error_percent,
      result,
      notes
    `
    )
    .eq("calibration_record_id", id)
    .order("point_order", { ascending: true });

  const { data: signaturesData } = await supabase
    .from("calibration_report_signatures")
    .select("id, signature_role, display_name, signature_url_snapshot, sort_order")
    .eq("calibration_record_id", id)
    .order("signature_role", { ascending: true })
    .order("sort_order", { ascending: true });

  const { data: internalInstrumentData } = record.internal_instrument_id
    ? await supabase
        .from("internal_instruments")
        .select(
          `
          id,
          name,
          internal_code,
          manufacturer,
          model,
          serial_number,
          measurement_quantity,
          unit,
          measurement_range,
          department,
          location,
          notes
        `
        )
        .eq("id", record.internal_instrument_id)
        .maybeSingle()
    : { data: null };

  const details = detailsData as CalibrationReportDetails | null;
  const scales = (scalesData ?? []) as CalibrationScale[];
  const measurements = (measurementsData ?? []) as CalibrationMeasurement[];
  const signatures = (signaturesData ?? []) as SignatureRow[];

  const internalInstrument = asObject(internalInstrumentData);
  const verifiedInstrument =
    Object.keys(internalInstrument).length > 0
      ? internalInstrument
      : asObject(record.customer_instrument_snapshot);
  const referenceSnapshot = asObject(record.reference_instrument_snapshot);
  const reportNumber = details?.main_report_number || record.record_number || "SENZA_NUMERO";
  const reportFileName =
    "Rapportino_VI_" +
    safeFileNameSegment(reportNumber, "Senza_numero") +
    "_" +
    safeFileNameSegment(
      verifiedInstrument.instrument_name ?? verifiedInstrument.name ?? "Strumento",
      "Strumento"
    );

  const scalePlans = scales.map((scale) => {
    const scaleMeasurements = measurements.filter(
      (measurement) => measurement.scale_id === scale.id
    );

    const referenceSnapshots = asObjectArray(scale.reference_instruments_snapshot);
    const fallbackReferenceSnapshot = asObject(scale.reference_instrument_snapshot);

    const references =
      referenceSnapshots.length > 0
        ? referenceSnapshots
        : Object.keys(fallbackReferenceSnapshot).length > 0
          ? [fallbackReferenceSnapshot]
          : Object.keys(referenceSnapshot).length > 0
            ? [referenceSnapshot]
            : [];

    return {
      scale,
      scaleMeasurements,
      references,
    };
  });

  const printableScalePlans =
    scalePlans.length > 0
      ? scalePlans
      : [
          {
            scale: {
              id: "senza-scala",
              scale_order: null,
              scale_name: "Sezione tecnica",
              scale_range: null,
              reference_instrument_snapshot: null,
              reference_instruments_snapshot: null,
              notes: null,
            } as CalibrationScale,
            scaleMeasurements: measurements,
            references:
              Object.keys(referenceSnapshot).length > 0 ? [referenceSnapshot] : [],
          },
        ];

  return (
    <AppShell>
      <div className="space-y-8 bg-slate-100 p-6 print:bg-white print:p-0">
        <div className="print-hidden mb-2 flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/verifiche"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna alle verifiche
          </Link>

          <ReportPrintButton fileName={reportFileName} />
        </div>

        <ReportStatusActions
          recordId={id}
          initialStatus={record.report_status || "draft"}
          issuedAt={record.issued_at}
          reopenedAt={record.reopened_at}
          documentLabel="rapportino VI"
        />

        <InternalReportNumberForm
          recordId={id}
          initialReportNumber={details?.main_report_number ?? ""}
          fallbackRecordNumber={record.record_number}
        />

        {record.verification_scope !== "VI" && (
          <div className="print-hidden rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Attenzione: questa verifica non risulta marcata come VI. Il flusso
            corretto per VT è il rapporto finale completo.
          </div>
        )}

        <InternalReportSignaturesForm recordId={id} />

        <SinglePageReport
          record={record}
          details={details}
          verifiedInstrument={verifiedInstrument}
          scalePlans={printableScalePlans}
          signatures={signatures}
          reportNumber={reportNumber}
        />
      </div>
    </AppShell>
  );
}