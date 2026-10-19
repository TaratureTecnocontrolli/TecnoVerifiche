import AppShell from "@/components/AppShell";
import NewVerificationHeader from "@/components/NewVerificationHeader";
import JackCalibrationTable from "@/components/JackCalibrationTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Promise<{
    scope?: string;
  }>;
};

export default async function NewJackCalibrationPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const verificationScope = resolvedSearchParams?.scope === "VI" ? "VI" : "VT";

  return (
    <AppShell>
      <div className="space-y-6">
        <NewVerificationHeader
          title="Nuova verifica martinetti"
          description="Inserisci pressione in bar e tre letture di forza in kN: il sistema calcola automaticamente massimo, minimo, media, coefficiente di conversione, coefficiente medio e ripetibilità."
          verificationScope={verificationScope}
          basePath="/nuova-verifica/martinetti"
          showScopeSwitch
        />

        <JackCalibrationTable verificationScope={verificationScope} />
      </div>
    </AppShell>
  );
}
