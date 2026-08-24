import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function ImportReferenceInstrumentsPage() {
  return (
    <AppShell>
      <ImportWizard kind="reference_instruments" />
    </AppShell>
  );


}
