import Link from "next/link";
import AppShell from "@/components/AppShell";
import PressureCalibrationTable from "@/components/PressureCalibrationTable";

export default function NewPressureVerificationPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/nuova-verifica"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna alle tipologie
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Nuova verifica pressione
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Modulo per manometri e strumenti di pressione. Questa è la prima
            versione operativa: salva i dati nella struttura comune del
            gestionale e prepara il flusso rapporto.
          </p>
        </div>

        <PressureCalibrationTable />
      </div>
    </AppShell>
  );
}
