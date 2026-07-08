"use client";

type ReportPrintButtonProps = {
  fileName?: string;
};

export default function ReportPrintButton({ fileName }: ReportPrintButtonProps) {
  function handlePrint() {
    const previousTitle = document.title;

    if (fileName) {
      document.title = fileName;
    }

    window.print();

    setTimeout(() => {
      document.title = previousTitle;
    }, 1000);
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
    >
      Stampa / Salva PDF
    </button>
  );
}