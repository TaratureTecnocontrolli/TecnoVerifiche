import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export default function ImportCustomerInstrumentsPage() {
  return (
    <AppShell>
      <ImportWizard kind="customer_instruments" />
    </AppShell>
  );

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

}
