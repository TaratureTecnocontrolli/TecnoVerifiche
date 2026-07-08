import Link from "next/link";
import AppShell from "@/components/AppShell";
import ForceCalibrationTable from "@/components/ForceCalibrationTable";

export default function NewCtCalibrationPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna alla dashboard
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Nuova verifica compressione/trazione
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Primo modulo operativo di TecnoTarature. Inserisci i valori rilevati
            durante la verifica: il sistema calcola automaticamente media,
            errore, accuratezza e ripetibilità.
          </p>
        </div>

        <ForceCalibrationTable />
      </div>
    </AppShell>
  );
}