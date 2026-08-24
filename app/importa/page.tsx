import Link from "next/link";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const IMPORT_LINKS = [
  {
    href: "/importa/clienti",
    title: "Clienti",
    description: "Importa anagrafica clienti da Excel o CSV.",
  },
  {
    href: "/importa/strumenti-cliente",
    title: "Strumenti Cliente",
    description: "Importa strumenti collegati ai clienti.",
  },
  {
    href: "/importa/strumenti-interni",
    title: "Strumenti Interni",
    description: "Importa strumenti interni aziendali per VI.",
  },
  {
    href: "/importa/strumenti-campione",
    title: "Strumenti Campione",
    description: "Importa strumenti campione e dati certificato.",
  },
];

export default function ImportaPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">
            Importazioni massive
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Scegli il tipo di anagrafica da importare. Ogni importazione ha
            modello, controlli e anteprima dedicati.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {IMPORT_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              <h2 className="text-lg font-semibold text-slate-950">
                {item.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );


}

