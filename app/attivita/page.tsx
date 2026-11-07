import AppShell from "@/components/AppShell";
import ActivitiesManager from "@/components/fleet/ActivitiesManager";

export default function ActivitiesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Attività di cantiere</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Pianifica interventi e cantieri, assegna i tecnici e i mezzi
            aziendali. Il sistema segnala doppie prenotazioni dei mezzi, tecnici
            già impegnati e scadenze dei mezzi.
          </p>
        </div>

        <ActivitiesManager />
      </div>
    </AppShell>
  );
}
