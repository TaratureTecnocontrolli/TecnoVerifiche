import AppShell from "@/components/AppShell";
import ImportWizard from "@/components/ImportWizard";

export default function Page() {
  return (
    <AppShell>
      <ImportWizard kind="customers" />
    </AppShell>
  );

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

}
