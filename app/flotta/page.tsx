import AppShell from "@/components/AppShell";
import FleetVehiclesManager from "@/components/fleet/FleetVehiclesManager";

export default function FleetPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Flotta aziendale</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Anagrafica dei mezzi aziendali con stato, chilometraggio, scadenze
            (assicurazione, revisione, bollo, tagliando) e registro degli
            interventi.
          </p>
        </div>

        <FleetVehiclesManager />
      </div>
    </AppShell>
  );
}
