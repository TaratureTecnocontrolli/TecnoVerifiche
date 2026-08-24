import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function ImportCustomerInstrumentsPage() {
  return (
    <AppShell>
      <ImportWizard kind="customer_instruments" />
    </AppShell>
  );


}
