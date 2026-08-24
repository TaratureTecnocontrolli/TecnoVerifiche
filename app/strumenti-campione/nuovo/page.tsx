import Link from "next/link";
import AppShell from "@/components/AppShell";
import ReferenceInstrumentForm from "@/components/ReferenceInstrumentForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function NewReferenceInstrumentPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/strumenti-campione"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti campione
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Nuovo strumento campione
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Inserisci un nuovo strumento campione con dati identificativi,
            caratteristiche metrologiche, certificato di taratura e relativo
            file allegato.
          </p>
        </div>

        <ReferenceInstrumentForm />
      </div>
    </AppShell>
  );


}
