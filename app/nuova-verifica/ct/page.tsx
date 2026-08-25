import AppShell from "@/components/AppShell";
import NewVerificationHeader from "@/components/NewVerificationHeader";
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
        <NewVerificationHeader
          title="Nuova verifica compressione/trazione"
          description="Inserisci i valori rilevati durante la verifica: il sistema calcola automaticamente media, errore, accuratezza e ripetibilità."
          verificationScope={verificationScope}
          basePath="/nuova-verifica/ct"
          showScopeSwitch
        />

        <ForceCalibrationTable verificationScope={verificationScope} />
      </div>
    </AppShell>
  );
}
