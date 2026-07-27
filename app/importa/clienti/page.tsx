import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export default function Page() {
  return (
    <AppShell>
      <ImportWizard kind="customers" />
    </AppShell>
  );
}