import AppShell from "@/components/AppShell";
import TechnicianSignaturesManager from "@/components/TechnicianSignaturesManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function TechnicianSignaturesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">
            Tecnici e firme
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Gestisci i tecnici utilizzabili nei rapporti di verifica e associa
            a ciascuno la relativa firma digitale/scansionata.
          </p>
        </div>

        <TechnicianSignaturesManager />
      </div>
    </AppShell>
  );


}
