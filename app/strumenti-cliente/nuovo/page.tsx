import Link from "next/link";
import AppShell from "@/components/AppShell";
import CustomerInstrumentForm from "@/components/CustomerInstrumentForm";

export default function NewCustomerInstrumentPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/strumenti-cliente"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna agli strumenti cliente
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Nuovo strumento cliente
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Inserisci lo strumento sottoposto a verifica/taratura. Per ora
            usiamo questa anagrafica solo per collegare correttamente le
            verifiche CT.
          </p>
        </div>

        <CustomerInstrumentForm />
      </div>
    </AppShell>
  );
}