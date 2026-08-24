import Link from "next/link";
import AppShell from "@/components/AppShell";
import InternalInstrumentForm from "@/components/InternalInstrumentForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function NewInternalInstrumentPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/strumenti-interni"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti interni
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Nuovo strumento interno
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra una nuova attrezzatura o strumento aziendale da utilizzare
            nel flusso VI - Verifica interna.
          </p>
        </div>

        <InternalInstrumentForm />
      </div>
    </AppShell>
  );


}
