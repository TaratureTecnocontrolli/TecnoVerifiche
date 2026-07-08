"use client";

type ExportRecord = {
  recordNumber: string | null;
  mode: string | null;
  verificationDate: string | null;
  operatorName: string | null;
  location: string | null;
  environmentalConditions: string | null;
  status: string | null;
};

type ExportProcedure = {
  code: string | null;
  name: string | null;
  revision: string | null;
  revisionDate: string | null;
  normativeReference: string | null;
  calculationEngineVersion: string | null;
} | null;

type ExportCustomerInstrument = {
  customerName: string | null;
  site: string | null;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  internalCode: string | null;
  measurementRange: string | null;
  resolution: string | null;
  acceptanceClass: string | null;
} | null;

type ExportReferenceInstrument = {
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  internalCode: string | null;
  certificateNumber: string | null;
  certificateExpiry: string | null;
  status: string | null;
} | null;

type ExportMeasurement = {
  pointOrder: number;
  nominalValue: number | null;
  appliedValue: number | null;
  cycle1: number | null;
  cycle2: number | null;
  cycle3: number | null;
  maxValue: number | null;
  minValue: number | null;
  averageValue: number | null;
  meanError: number | null;
  accuracyErrorPercent: number | null;
  repeatabilityErrorPercent: number | null;
};

type CalibrationExportActionsProps = {
  record: ExportRecord;
  procedure: ExportProcedure;
  customerInstrument: ExportCustomerInstrument;
  referenceInstrument: ExportReferenceInstrument;
  measurements: ExportMeasurement[];
};

function valueToCsv(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

function formatItalianDate(date: string | null | undefined) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function statusLabel(status: string | null | undefined) {
  if (status === "draft") return "Bozza";
  if (status === "completed") return "Completata";
  if (status === "validated") return "Validata";
  if (status === "valid") return "Valido";
  if (status === "expiring") return "In scadenza";
  if (status === "expired") return "Scaduto";
  if (status === "out_of_service") return "Fuori servizio";

  return status ?? "";
}

function numberToItalian(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 6,
  }).format(value);
}

export default function CalibrationExportActions({
  record,
  procedure,
  customerInstrument,
  referenceInstrument,
  measurements,
}: CalibrationExportActionsProps) {
  function exportCsv() {
    const rows: string[][] = [];

    rows.push(["TECNOTARATURE - ESPORTAZIONE VERIFICA"]);
    rows.push([]);

    rows.push(["DATI GENERALI"]);
    rows.push(["Numero verifica", record.recordNumber ?? ""]);
    rows.push(["Modalità", record.mode ?? ""]);
    rows.push(["Data verifica", formatItalianDate(record.verificationDate)]);
    rows.push(["Operatore", record.operatorName ?? ""]);
    rows.push(["Luogo", record.location ?? ""]);
    rows.push(["Condizioni ambientali", record.environmentalConditions ?? ""]);
    rows.push(["Stato", statusLabel(record.status)]);
    rows.push([]);

    rows.push(["PROCEDURA E CALCOLO"]);
    rows.push(["Codice procedura", procedure?.code ?? ""]);
    rows.push(["Nome procedura", procedure?.name ?? ""]);
    rows.push(["Revisione", procedure?.revision ?? ""]);
    rows.push(["Data revisione", formatItalianDate(procedure?.revisionDate)]);
    rows.push(["Motore calcolo", procedure?.calculationEngineVersion ?? ""]);
    rows.push(["Riferimento", procedure?.normativeReference ?? ""]);
    rows.push([]);

    rows.push(["STRUMENTO CLIENTE"]);
    rows.push(["Cliente", customerInstrument?.customerName ?? ""]);
    rows.push(["Sede", customerInstrument?.site ?? ""]);
    rows.push(["Strumento", customerInstrument?.name ?? ""]);
    rows.push([
      "Costruttore / modello",
      [customerInstrument?.manufacturer, customerInstrument?.model]
        .filter(Boolean)
        .join(" - "),
    ]);
    rows.push(["Matricola", customerInstrument?.serialNumber ?? ""]);
    rows.push(["Codice interno", customerInstrument?.internalCode ?? ""]);
    rows.push(["Campo", customerInstrument?.measurementRange ?? ""]);
    rows.push(["Risoluzione", customerInstrument?.resolution ?? ""]);
    rows.push(["Classe / tolleranza", customerInstrument?.acceptanceClass ?? ""]);
    rows.push([]);

    rows.push(["STRUMENTO CAMPIONE"]);
    rows.push(["Strumento", referenceInstrument?.name ?? ""]);
    rows.push([
      "Costruttore / modello",
      [referenceInstrument?.manufacturer, referenceInstrument?.model]
        .filter(Boolean)
        .join(" - "),
    ]);
    rows.push(["Matricola", referenceInstrument?.serialNumber ?? ""]);
    rows.push(["Codice interno", referenceInstrument?.internalCode ?? ""]);
    rows.push(["Certificato", referenceInstrument?.certificateNumber ?? ""]);
    rows.push([
      "Scadenza certificato",
      formatItalianDate(referenceInstrument?.certificateExpiry),
    ]);
    rows.push(["Stato campione", statusLabel(referenceInstrument?.status)]);
    rows.push([]);

    rows.push(["PUNTI MISURATI"]);
    rows.push([
      "Punto",
      "Valore nominale",
      "Valore applicato",
      "Ciclo 1",
      "Ciclo 2",
      "Ciclo 3",
      "Max",
      "Min",
      "Media",
      "Errore medio",
      "Errore accuratezza %",
      "Ripetibilità %",
    ]);

    measurements.forEach((measurement) => {
      rows.push([
        String(measurement.pointOrder),
        numberToItalian(measurement.nominalValue),
        numberToItalian(measurement.appliedValue),
        numberToItalian(measurement.cycle1),
        numberToItalian(measurement.cycle2),
        numberToItalian(measurement.cycle3),
        numberToItalian(measurement.maxValue),
        numberToItalian(measurement.minValue),
        numberToItalian(measurement.averageValue),
        numberToItalian(measurement.meanError),
        numberToItalian(measurement.accuracyErrorPercent),
        numberToItalian(measurement.repeatabilityErrorPercent),
      ]);
    });

    const csvContent = rows
      .map((row) => row.map((cell) => valueToCsv(cell)).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const safeRecordNumber = record.recordNumber ?? "verifica";
    link.href = url;
    link.download = `${safeRecordNumber}_dati_verifica.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Esportazione dati
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Esporta i dati della verifica in formato CSV apribile con Excel. Il
            file include dati generali, procedura, strumenti e punti misurati.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Esporta CSV
        </button>
      </div>
    </div>
  );
}