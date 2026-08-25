"use client";

type ReportPrintButtonProps = {
  fileName?: string;
};

function normalizeFileName(value: string | undefined) {
  const cleaned = (value ?? "Rapporto_di_prova")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || "Rapporto_di_prova";
}

export default function ReportPrintButton({ fileName }: ReportPrintButtonProps) {
  function printReport() {
    const previousTitle = document.title;
    const normalizedFileName = normalizeFileName(fileName);

    document.title = normalizedFileName;

    window.setTimeout(() => {
      window.print();

      window.setTimeout(() => {
        document.title = previousTitle;
      }, 1000);
    }, 50);
  }

  return (
    <button
      type="button"
      onClick={printReport}
      className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
    >
      Salva PDF
    </button>
  );
}