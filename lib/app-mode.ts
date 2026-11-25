export type VerificationScope = "VT" | "VI";
export type VerificationScopeMode = "ALL" | VerificationScope;

function normalizeMode(value: string | undefined): VerificationScopeMode {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "VI") return "VI";
  if (normalized === "VT") return "VT";
  return "ALL";
}

export const VERIFICATION_SCOPE_MODE: VerificationScopeMode = normalizeMode(
  process.env.NEXT_PUBLIC_VERIFICATION_SCOPE_MODE
);

export const isViOnlyMode = VERIFICATION_SCOPE_MODE === "VI";
export const isVtOnlyMode = VERIFICATION_SCOPE_MODE === "VT";
export const isSingleScopeMode = VERIFICATION_SCOPE_MODE !== "ALL";

export function isScopeAllowed(scope: VerificationScope) {
  return VERIFICATION_SCOPE_MODE === "ALL" || VERIFICATION_SCOPE_MODE === scope;
}

export function resolveVerificationScope(value: unknown): VerificationScope {
  if (VERIFICATION_SCOPE_MODE === "VI") return "VI";
  if (VERIFICATION_SCOPE_MODE === "VT") return "VT";
  return String(value ?? "").trim().toUpperCase() === "VI" ? "VI" : "VT";
}
