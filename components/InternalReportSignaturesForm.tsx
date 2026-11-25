"use client";



export type InternalReportSignatureRole =
  | "testing_technician"
  | "reviewer"
  | "director";

export type InternalReportSignaturePreviewRow = {
  id?: string;
  signature_role: InternalReportSignatureRole;
  technician_id: string | null;
  display_name: string;
  signature_url_snapshot: string | null;
  sort_order: number;
};

type PreviewProps = {
  recordId: string;
  initialSignatures: InternalReportSignaturePreviewRow[];
  fallbackTestingName?: string | null;
  fallbackReviewerName?: string | null;
  fallbackDirectorName?: string | null;
};

function textValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function getSignaturesByRole(
  signatures: InternalReportSignaturePreviewRow[],
  role: InternalReportSignatureRole
) {
  return signatures
    .filter((signature) => signature.signature_role === role)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function fallbackRows(
  role: InternalReportSignatureRole,
  nameValue: unknown
): InternalReportSignaturePreviewRow[] {
  const names = textValue(nameValue, "")
    .split(/[,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);

  return names.map((name, index) => ({
    id: role + "-" + name + "-" + String(index),
    signature_role: role,
    technician_id: null,
    display_name: name,
    signature_url_snapshot: null,
    sort_order: index + 1,
  }));
}

function SignatureCard({
  signature,
}: {
  signature: InternalReportSignaturePreviewRow;
}) {
  return (
    <div className="flex min-h-[48px] flex-col items-center justify-end border-b border-slate-200 px-1 py-1 last:border-b-0">
      {signature.signature_url_snapshot ? (
        <img
          src={signature.signature_url_snapshot}
          alt={signature.display_name ?? "Firma"}
          className="mb-0.5 h-8 max-w-[125px] object-contain mix-blend-multiply opacity-80"
        />
      ) : (
        <div className="mb-0.5 h-8 w-full border-b border-slate-300" />
      )}

      <span className="text-center text-[8px] leading-tight">
        {textValue(signature.display_name)}
      </span>
    </div>
  );
}

function SignatureGroup({
  title,
  signatures,
}: {
  title: string;
  signatures: InternalReportSignaturePreviewRow[];
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-900 bg-white/35">
      <div className="bg-slate-700/65 px-1 py-[1px] text-center text-[8px] font-bold text-slate-950">
        {title}
      </div>

      <div className="bg-white/10">
        {signatures.length > 0 ? (
          signatures.map((signature, index) => (
            <SignatureCard
              key={signature.id ?? String(index)}
              signature={signature}
            />
          ))
        ) : (
          <div className="flex min-h-[48px] items-end justify-center px-2 py-1">
            <div className="w-full border-b border-slate-300 pb-1 text-center text-[8px] leading-tight">
              -
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function InternalReportSignaturePreview({
  initialSignatures,
  fallbackTestingName,
  fallbackReviewerName,
  fallbackDirectorName,
}: PreviewProps) {
  const signatures = initialSignatures;

  const testingSignatures =
    getSignaturesByRole(signatures, "testing_technician").length > 0
      ? getSignaturesByRole(signatures, "testing_technician")
      : fallbackRows("testing_technician", fallbackTestingName);

  const reviewerSignatures =
    getSignaturesByRole(signatures, "reviewer").length > 0
      ? getSignaturesByRole(signatures, "reviewer")
      : fallbackRows("reviewer", fallbackReviewerName);

  const directorSignatures =
    getSignaturesByRole(signatures, "director").length > 0
      ? getSignaturesByRole(signatures, "director")
      : fallbackRows("director", fallbackDirectorName);

  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[8px]">
      <SignatureGroup
        title="Tecnico/i addetto/i alle prove"
        signatures={testingSignatures}
      />
      <SignatureGroup
        title="Redatto, Verificato ed Emesso"
        signatures={reviewerSignatures}
      />
      <SignatureGroup
        title="Direzione laboratorio"
        signatures={directorSignatures}
      />
    </div>
  );
}


export function InternalReportTechnicianPreview({
  initialName,
}: {
  recordId: string;
  initialName?: string | null;
}) {
  return <>{textValue(initialName)}</>;
}
