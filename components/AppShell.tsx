import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import LogoutButton from "@/components/LogoutButton";

type AppShellProps = {
  children: React.ReactNode;
};

const NAV_GROUPS = [
  {
    title: "Operativo",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/nuova-verifica", label: "Nuova Verifica" },
      { href: "/verifiche", label: "Verifiche Elaborate" },
      { href: "/rapporti", label: "Archivio Rapporti" },
    ],
  },
  {
    title: "Anagrafiche",
    items: [
      { href: "/clienti", label: "Clienti" },
      { href: "/strumenti-cliente", label: "Strumenti Cliente" },
      { href: "/strumenti-interni", label: "Strumenti Interni" },
      { href: "/strumenti-campione", label: "Strumenti Campione" },
    ],
  },
  {
    title: "Gestione",
    items: [
      { href: "/importa", label: "Importazioni" },
      { href: "/tecnici-firme", label: "Tecnici e firme" },
    ],
  },
];

/*
  Voce admin futura:
  - Audit log non viene mostrato nel menu generale.
  - Quando aggiungeremo ruoli più restrittivi, lo reinseriremo solo per admin.
  - Rotta prevista: /audit-log
*/

export default function AppShell({ children }: AppShellProps) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-100">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <Link
                  href="/"
                  className="group inline-flex w-full max-w-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-red-200 hover:shadow-md sm:max-w-[420px]"
                  aria-label="Vai alla dashboard TecnoVerifiche"
                >
                  <img
                    src="/logo-tecnoverifiche-header.png"
                    alt="TecnoVerifiche - Gestionale verifiche di taratura"
                    className="h-20 w-auto object-contain sm:h-24"
                  />
                </Link>

                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                      Ambiente operativo
                    </span>

                    <LogoutButton />
                  </div>

                  <nav className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-end">
                    {NAV_GROUPS.map((group) => (
                      <div
                        key={group.title}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-2"
                      >
                        <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                          {group.title}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {group.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950 hover:shadow-sm"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
