import Link from "next/link";

type AppShellProps = {
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/nuova-verifica", label: "Nuova verifica" },
  { href: "/verifiche", label: "Verifiche" },
  { href: "/rapporti", label: "Rapporti" },
  { href: "/clienti", label: "Clienti" },
  { href: "/strumenti-cliente", label: "Strumenti cliente" },
  { href: "/strumenti-campione", label: "Strumenti campione" },
  { href: "/tecnici-firme", label: "Tecnici e firme" },
  { href: "/audit-log", label: "Audit log" },
];

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <Link
                href="/"
                className="inline-flex w-fit flex-col rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition hover:bg-slate-100"
              >
                <span className="text-2xl font-bold leading-none text-slate-950">
                  TecnoTarature
                </span>
                <span className="mt-1 text-xs font-medium text-slate-600">
                  Gestionale verifiche di taratura
                </span>
              </Link>

              <nav className="flex flex-wrap items-end gap-0.5">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-t-2xl border border-b-0 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="border-b border-slate-200" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}