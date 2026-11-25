export function isTechnicalProvisionalRecordNumber(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return false;

  // Numerazioni tecniche storiche generate con Date.now(), es. CT-2026-1761234567890.
  return /^[A-Z]{2,4}-\d{4}-\d{10,}$/.test(text);
}

export function resolveDocumentNumber(
  finalNumber: unknown,
  recordNumber: unknown,
  fallback = "BOZZA"
) {
  const definitive = String(finalNumber ?? "").trim();
  if (definitive) return definitive;

  const record = String(recordNumber ?? "").trim();
  if (record && !isTechnicalProvisionalRecordNumber(record)) return record;

  return fallback;
}
