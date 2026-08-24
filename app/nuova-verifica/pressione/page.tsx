import Link from "next/link";
import AppShell from "@/components/AppShell";
import PressureCalibrationTable from "@/components/PressureCalibrationTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Promise<{
    scope?: string;


}>;
};

type VerificationScope = "VT" | "VI";

function normalizeScope(scope: string | undefined): VerificationScope {
  return scope === "VI" ? "VI" : "VT";
}

export default async function NewPressureVerificationPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const verificationScope = normalizeScope(resolvedSearchParams.scope);
  const isInternalVerification = verificationScope === "VI";

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

          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <div
                className={
                  "inline-flex rounded-b-xl px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white " +
                  (isInternalVerification ? "bg-sky-700" : "bg-emerald-700")
                }
              >
                {verificationScope}
              </div>

              <h1 className="mt-3 text-3xl font-bold text-slate-950">
                Nuova verifica pressione
              </h1>

              <p className="mt-2 max-w-3xl text-slate-600">
                {isInternalVerification
                  ? "Flusso VI per strumenti interni di pressione. Seleziona lo strumento aziendale, il luogo di verifica, gli strumenti campione e registra le misure."
                  : "Flusso VT per manometri e strumenti di pressione del cliente. Salva i dati nella struttura comune del gestionale e prepara il rapporto finale."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/nuova-verifica/pressione?scope=VT"
                className={
                  "rounded-xl px-4 py-2 text-sm font-bold " +
                  (!isInternalVerification
                    ? "bg-emerald-700 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
                }
              >
                VT
              </Link>

              <Link
                href="/nuova-verifica/pressione?scope=VI"
                className={
                  "rounded-xl px-4 py-2 text-sm font-bold " +
                  (isInternalVerification
                    ? "bg-sky-700 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
                }
              >
                VI
              </Link>
            </div>
          </div>
        </div>

        <PressureCalibrationTable verificationScope={verificationScope} />
      </div>
    </AppShell>
  );
}

