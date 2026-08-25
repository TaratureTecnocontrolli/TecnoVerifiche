import AppShell from "@/components/AppShell";
import NewVerificationHeader from "@/components/NewVerificationHeader";
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
        <NewVerificationHeader
          title="Nuova verifica pressione"
          description={isInternalVerification ? "Flusso VI per strumenti interni di pressione. Seleziona lo strumento aziendale, il luogo di verifica, gli strumenti campione e registra le misure." : "Flusso VT per manometri e strumenti di pressione del cliente. Salva i dati nella struttura comune del gestionale e prepara il rapporto finale."}
          verificationScope={verificationScope}
          basePath="/nuova-verifica/pressione"
          showScopeSwitch
        />

        <PressureCalibrationTable verificationScope={verificationScope} />
      </div>
    </AppShell>
  );
}

