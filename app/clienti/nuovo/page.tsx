import Link from "next/link";
import AppShell from "@/components/AppShell";
import CustomerForm from "@/components/CustomerForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function NewCustomerPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/clienti"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna ai clienti
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Nuovo cliente
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Inserisci il cliente e la prima sede operativa. Le attrezzature del
            cliente verranno collegate alla sede nello step successivo.
          </p>
        </div>

        <CustomerForm />
      </div>
    </AppShell>
  );


}
