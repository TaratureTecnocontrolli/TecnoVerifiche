import Link from "next/link";

type VerificationScope = "VT" | "VI";

type NewVerificationHeaderProps = {
  title: string;
  description: string;
  verificationScope?: VerificationScope;
  basePath?: string;
  showScopeSwitch?: boolean;
  backHref?: string;
  backLabel?: string;
};

function scopeFullLabel(scope: VerificationScope) {
  return scope === "VI" ? "VI - Verifica interna" : "VT - Verifica/Taratura cliente";
}

function scopeDetail(scope: VerificationScope) {
  return scope === "VI"
    ? "Strumento interno + rapportino tecnico"
    : "Cliente + rapporto finale";
}

function scopeBoxClass(scope: VerificationScope) {
  return scope === "VI"
    ? "border-sky-200 bg-sky-50 text-sky-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function scopeButtonClass(isActive: boolean, scope: VerificationScope) {
  if (isActive) {
    return scope === "VI"
      ? "bg-sky-700 text-white"
      : "bg-emerald-700 text-white";
  }

  return "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
}

export default function NewVerificationHeader({
  title,
  description,
  verificationScope = "VT",
  basePath,
  showScopeSwitch = false,
  backHref = "/nuova-verifica",
  backLabel = "Torna alla scelta verifica",
}: NewVerificationHeaderProps) {
  return (
    <div>
      <Link
        href={backHref}
        className="text-sm font-medium text-slate-500 hover:text-slate-950"
      >
        ← {backLabel}
      </Link>

      <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">{title}</h1>

          <p className="mt-1 max-w-4xl text-slate-600">{description}</p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div
            className={
              "w-fit rounded-2xl border px-4 py-3 text-sm font-semibold " +
              scopeBoxClass(verificationScope)
            }
          >
            <p>{scopeFullLabel(verificationScope)}</p>
            <p className="mt-1 text-xs font-medium opacity-90">
              {scopeDetail(verificationScope)}
            </p>
          </div>

          {showScopeSwitch && basePath && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={basePath + "?scope=VT"}
                className={
                  "rounded-xl px-4 py-2 text-sm font-bold " +
                  scopeButtonClass(verificationScope === "VT", "VT")
                }
              >
                VT
              </Link>

              <Link
                href={basePath + "?scope=VI"}
                className={
                  "rounded-xl px-4 py-2 text-sm font-bold " +
                  scopeButtonClass(verificationScope === "VI", "VI")
                }
              >
                VI
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
