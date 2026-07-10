import Link from "next/link";
import AppShell from "@/components/AppShell";

type VerificationModule = {
  title: string;
  badge: string;
  description: string;
  href: string | null;
  status: "active" | "development";
  bookmark: string;
  details: string[];
};

const modules: VerificationModule[] = [
  {
    title: "Compressione / trazione",
    badge: "CT",
    description:
      "Verifica di macchine e strumenti per prove di compressione e trazione.",
    href: "/nuova-verifica/ct",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "punti di verifica",
      "cicli di misura",
      "errore e ripetibilità",
      "grafici e rapporto finale",
    ],
  },
  {
    title: "Pressione / manometri",
    badge: "PRS",
    description:
      "Verifica di manometri e strumenti di misura della pressione.",
    href: "/nuova-verifica/pressione",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "prova in carico",
      "prova in scarico",
      "tre cicli",
      "accuratezza e ripetibilità",
    ],
  },
  {
    title: "Chiavi dinamometriche",
    badge: "TRQ",
    description:
      "Modulo per verifiche di coppia, chiavi dinamometriche e strumenti dinamometrici.",
    href: "/nuova-verifica/dinamometria",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "punti di coppia",
      "letture ripetute",
      "errore relativo",
      "rapporto dedicato",
    ],
  },
  {
    title: "Portata / contalitri",
    badge: "FLT",
    description:
      "Modulo per verifiche di contalitri e strumenti di misura portata/volume.",
    href: "/nuova-verifica/portata",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "volume indicato",
      "volume campione",
      "errore relativo",
      "ripetibilità",
    ],
  },
  {
    title: "Temperatura",
    badge: "TMP",
    description:
      "Modulo per termometri, sonde e strumenti di misura della temperatura.",
    href: "/nuova-verifica/temperatura",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "log giornaliero",
      "campione di riferimento",
      "data e orario",
      "nessun calcolo automatico",
    ],
  },
  {
    title: "Dimensionale",
    badge: "DIM",
    description:
      "Modulo per calibri, comparatori, flessometri e strumenti dimensionali.",
    href: "/nuova-verifica/dimensionale",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "campo di misura",
      "risoluzione",
      "punti di controllo",
      "incertezza strumentale",
    ],
  },
  {
    title: "Massa / bilance",
    badge: "MAS",
    description:
      "Modulo per bilance, masse e strumenti collegati alla misura della massa.",
    href: "/nuova-verifica/massa",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "portata",
      "divisione",
      "prove eccentricità",
      "prove ripetibilità",
    ],
  },
  {
    title: "Prove sclerometriche",
    badge: "SCL",
    description:
      "Modulo per sclerometri e strumenti di prova non distruttiva a rimbalzo.",
    href: "/nuova-verifica/sclerometro",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "battute su incudine",
      "valore nominale fisso",
      "errore percentuale",
      "rapporto dedicato",
    ],
  },
  {
    title: "Pull-off",
    badge: "PLO",
    description:
      "Modulo per strumentazione pull-off e prove di trazione tramite ancoraggio a cella di carico.",
    href: "/nuova-verifica/pulloff",
    status: "active",
    bookmark: "Modulo attivo",
    details: [
      "carico applicato",
      "letture ripetute",
      "errore relativo",
      "rapporto dedicato",
    ],
  },
];

function StatusBadge({ status }: { status: VerificationModule["status"] }) {
  if (status === "active") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        Attivo
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      In sviluppo
    </span>
  );
}

function ModuleCard({ module }: { module: VerificationModule }) {
  const cardContent = (
    <div
      className={`relative h-full rounded-2xl border bg-white p-6 shadow-sm transition ${
        module.status === "active"
          ? "border-slate-200 hover:-translate-y-0.5 hover:shadow-md"
          : "border-dashed border-slate-300 opacity-80"
      }`}
    >
      <div className="absolute right-5 top-0 rounded-b-xl bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm">
        {module.bookmark}
      </div>

      <div className="flex items-start justify-between gap-4 pt-3">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-900">
            {module.badge}
          </div>

          <h2 className="mt-4 text-xl font-bold text-slate-950">
            {module.title}
          </h2>
        </div>

        <StatusBadge status={module.status} />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {module.description}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {module.details.map((detail) => (
          <span
            key={detail}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
          >
            {detail}
          </span>
        ))}
      </div>

      <div className="mt-6">
        {module.status === "active" ? (
          <span className="text-sm font-semibold text-slate-900">
            Avvia verifica →
          </span>
        ) : (
          <span className="text-sm font-semibold text-slate-400">
            Non ancora disponibile
          </span>
        )}
      </div>
    </div>
  );

  if (!module.href) {
    return cardContent;
  }

  return (
    <Link href={module.href} className="block h-full">
      {cardContent}
    </Link>
  );
}

export default function NewVerificationPage() {
  const activeModules = modules.filter((module) => module.status === "active");
  const developmentModules = modules.filter(
    (module) => module.status === "development"
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="inline-flex rounded-b-xl bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Selezione modulo
          </div>

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            Nuova verifica
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Seleziona il tipo di verifica da avviare tra i {activeModules.length}{" "}
            moduli disponibili.
          </p>
        </section>

        <section className="space-y-4">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {activeModules.map((module) => (
              <ModuleCard key={module.title} module={module} />
            ))}
          </div>
        </section>

        {developmentModules.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-b-xl bg-slate-700 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Moduli da costruire
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {developmentModules.map((module) => (
                <ModuleCard key={module.title} module={module} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
