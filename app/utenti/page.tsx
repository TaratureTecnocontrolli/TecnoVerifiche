import AppShell from "@/components/AppShell";
import UserAccountsManager from "@/components/UserAccountsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function UsersPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Utenti e permessi</h1>
          <p className="mt-2 max-w-4xl text-slate-600">
            Gestisci gli account del gestionale, assegna il profilo MASTER o TECNICO e collega ogni profilo tecnico al relativo nominativo/firma.
          </p>
        </div>
        <UserAccountsManager />
      </div>
    </AppShell>
  );
}
