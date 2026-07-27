import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export default function ImportCustomerInstrumentsPage() {
  return (
    <AppShell>
      <ImportWizard kind="customer_instruments" />
    </AppShell>
  );
}