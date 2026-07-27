import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export default function ImportReferenceInstrumentsPage() {
  return (
    <AppShell>
      <ImportWizard kind="reference_instruments" />
    </AppShell>
  );
}