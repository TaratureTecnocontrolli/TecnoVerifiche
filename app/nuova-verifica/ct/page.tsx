import Link from "next/link";
import AppShell from "@/components/AppShell";
import ForceCalibrationTable from "@/components/ForceCalibrationTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Promise<{
    scope?: string;


}>;
};

export default async function NewCtCalibrationPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const verificationScope = resolvedSearchParams?.scope === "VI" ? "VI" : "VT";

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/nuova-verifica"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna alla scelta verifica
          </Link>

          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">
                Nuova verifica compressione/trazione
              </h1>

              <p className="mt-1 max-w-4xl text-slate-600">
                Inserisci i valori rilevati durante la verifica: il sistema calcola automaticamente media, errore, accuratezza e ripetibilità.
              </p>
            </div>

            <div
              className={
                "w-fit rounded-2xl border px-4 py-3 text-sm font-semibold " +
                (verificationScope === "VI"
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900")
              }
            >
              {verificationScope === "VI"
                ? "VI - Verifica interna"
                : "VT - Verifica/Taratura cliente"}
            </div>
          </div>
        </div>

        <ForceCalibrationTable verificationScope={verificationScope} />
      </div>
    </AppShell>
  );
}
