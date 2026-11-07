import AppShell from "@/components/AppShell";
import FleetCalendar from "@/components/fleet/FleetCalendar";

export default function CalendarPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Calendario</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Vista mensile delle attività e planning settimanale per mezzo o per
            tecnico. Clicca su un giorno per creare un&apos;attività, su
            un&apos;attività per modificarla e assegnare i mezzi.
          </p>
        </div>

        <FleetCalendar />
      </div>
    </AppShell>
  );
}
