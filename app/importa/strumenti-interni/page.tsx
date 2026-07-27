import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export default function ImportInternalInstrumentsPage() {
  return (
    <AppShell>
      <ImportWizard kind="internal_instruments" />
    </AppShell>
  );
}