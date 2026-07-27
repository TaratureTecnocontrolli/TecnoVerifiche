"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type Technician = {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  signature_url: string | null;
  is_active: boolean;
};

type SignatureRow = {
  id: string;
  signature_role: string;
  technician_id: string | null;
  display_name: string;
  signature_url_snapshot: string | null;
  sort_order: number | null;
};

type FormProps = {
  recordId: string;
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

function sortByName(items: Technician[]) {
  return [...items].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function isCardone(technician: Technician) {
  const name = technician.full_name.toLowerCase();
  return name.includes("cardone");
}

function dispatchPreviewUpdate(
  recordId: string,
  rows: InternalReportSignaturePreviewRow[]
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("internal-report-signatures-preview:" + recordId, {
      detail: rows,
    })
  );
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
  recordId,
  initialSignatures,
  fallbackTestingName,
  fallbackReviewerName,
  fallbackDirectorName,
}: PreviewProps) {
  const [signatures, setSignatures] =
    useState<InternalReportSignaturePreviewRow[]>(initialSignatures);

  useEffect(() => {
    function handlePreviewUpdate(event: Event) {
      const customEvent = event as CustomEvent<
        InternalReportSignaturePreviewRow[]
      >;

      if (Array.isArray(customEvent.detail)) {
        setSignatures(customEvent.detail);
      }
    }

    window.addEventListener(
      "internal-report-signatures-preview:" + recordId,
      handlePreviewUpdate
    );

    return () => {
      window.removeEventListener(
        "internal-report-signatures-preview:" + recordId,
        handlePreviewUpdate
      );
    };
  }, [recordId]);

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

export default function InternalReportSignaturesForm({ recordId }: FormProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [testingTechnicianIds, setTestingTechnicianIds] = useState<string[]>([]);
  const [reviewerTechnicianIds, setReviewerTechnicianIds] = useState<string[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const directorTechnician = useMemo(() => {
    return technicians.find(isCardone) ?? null;
  }, [technicians]);

  const previewRows = useMemo(() => {
    const rows: InternalReportSignaturePreviewRow[] = [];

    testingTechnicianIds.forEach((technicianId, index) => {
      const technician = technicians.find((item) => item.id === technicianId);
      if (!technician) return;

      rows.push({
        signature_role: "testing_technician",
        technician_id: technician.id,
        display_name: technician.full_name,
        signature_url_snapshot: technician.signature_url,
        sort_order: index + 1,
      });
    });

    reviewerTechnicianIds.forEach((technicianId, index) => {
      const technician = technicians.find((item) => item.id === technicianId);
      if (!technician) return;

      rows.push({
        signature_role: "reviewer",
        technician_id: technician.id,
        display_name: technician.full_name,
        signature_url_snapshot: technician.signature_url,
        sort_order: index + 1,
      });
    });

    if (directorTechnician) {
      rows.push({
        signature_role: "director",
        technician_id: directorTechnician.id,
        display_name: directorTechnician.full_name,
        signature_url_snapshot: directorTechnician.signature_url,
        sort_order: 1,
      });
    }

    return rows;
  }, [
    directorTechnician,
    reviewerTechnicianIds,
    technicians,
    testingTechnicianIds,
  ]);

  useEffect(() => {
    loadData();
  }, [recordId]);

  useEffect(() => {
    dispatchPreviewUpdate(recordId, previewRows);
  }, [previewRows, recordId]);

  async function loadData() {
    setIsLoading(true);
    setErrorMessage("");
    setMessage("");

    const { data: techniciansData, error: techniciansError } = await supabase
      .from("calibration_technicians")
      .select("id, full_name, role, email, signature_url, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (techniciansError) {
      setErrorMessage("Errore caricamento tecnici: " + techniciansError.message);
      setIsLoading(false);
      return;
    }

    const activeTechnicians = sortByName((techniciansData ?? []) as Technician[]);
    setTechnicians(activeTechnicians);

    const { data: signaturesData, error: signaturesError } = await supabase
      .from("calibration_report_signatures")
      .select(
        "id, signature_role, technician_id, display_name, signature_url_snapshot, sort_order"
      )
      .eq("calibration_record_id", recordId)
      .order("signature_role", { ascending: true })
      .order("sort_order", { ascending: true });

    if (signaturesError) {
      setErrorMessage("Errore caricamento firme: " + signaturesError.message);
      setIsLoading(false);
      return;
    }

    const signatures = (signaturesData ?? []) as SignatureRow[];

    const testingIds = signatures
      .filter((signature) => signature.signature_role === "testing_technician")
      .map((signature) => signature.technician_id)
      .filter((id): id is string => Boolean(id));

    const reviewerIds = signatures
      .filter((signature) => signature.signature_role === "reviewer")
      .map((signature) => signature.technician_id)
      .filter((id): id is string => Boolean(id));

    setTestingTechnicianIds(testingIds);
    setReviewerTechnicianIds(reviewerIds);

    setIsLoading(false);
  }

  function toggleId(
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    setter((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id]
    );

    setMessage("");
    setErrorMessage("");
  }

  async function saveSignatures() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (testingTechnicianIds.length === 0) {
        throw new Error("Seleziona almeno un tecnico addetto alle prove.");
      }

      if (reviewerTechnicianIds.length === 0) {
        throw new Error(
          "Seleziona almeno un tecnico per Redatto, Verificato ed Emesso."
        );
      }

      if (!directorTechnician) {
        throw new Error(
          "Direttore fisso non trovato. Inserisci Cardone tra i tecnici attivi in “Tecnici e firme”."
        );
      }

      const { error: deleteError } = await supabase
        .from("calibration_report_signatures")
        .delete()
        .eq("calibration_record_id", recordId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (previewRows.length > 0) {
        const { error: insertError } = await supabase
          .from("calibration_report_signatures")
          .insert(
            previewRows.map((row) => ({
              calibration_record_id: recordId,
              signature_role: row.signature_role,
              technician_id: row.technician_id,
              display_name: row.display_name,
              signature_url_snapshot: row.signature_url_snapshot,
              sort_order: row.sort_order,
            }))
          );

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      setMessage("Firme VI salvate correttamente.");
      dispatchPreviewUpdate(recordId, previewRows);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il salvataggio firme."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 print:hidden">
        Caricamento selezione firme VI...
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border-2 border-blue-300 bg-blue-50 p-5 shadow-sm print:hidden">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
            Maschera dati rapportino VI
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Selezione firmatari del rapportino interno
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Seleziona i firmatari. Le firme si aggiornano subito nel rapportino
            sotto; il pulsante salva le rende definitive.
          </p>
        </div>

        <button
          type="button"
          onClick={saveSignatures}
          disabled={isSaving}
          className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Salvataggio..." : "Salva firme VI"}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {message}
        </div>
      )}

      {technicians.length === 0 ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nessun tecnico attivo trovato. Inserisci i tecnici in “Tecnici e firme”
          e assicurati che siano attivi.
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">
              Tecnico/i addetto/i alle prove
            </h3>

            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {technicians.map((technician) => (
                <label
                  key={technician.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={testingTechnicianIds.includes(technician.id)}
                    onChange={() =>
                      toggleId(technician.id, setTestingTechnicianIds)
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium text-slate-900">
                      {technician.full_name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {technician.signature_url
                        ? "Firma presente"
                        : "Firma mancante"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">
              Redatto, Verificato ed Emesso
            </h3>

            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {technicians.map((technician) => (
                <label
                  key={technician.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={reviewerTechnicianIds.includes(technician.id)}
                    onChange={() =>
                      toggleId(technician.id, setReviewerTechnicianIds)
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium text-slate-900">
                      {technician.full_name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {technician.signature_url
                        ? "Firma presente"
                        : "Firma mancante"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">
              Direttore di laboratorio
            </h3>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              {directorTechnician ? (
                <>
                  <p className="font-semibold text-slate-900">
                    {directorTechnician.full_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Direttore fisso del laboratorio. Non selezionabile.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {directorTechnician.signature_url
                      ? "Firma presente"
                      : "Firma mancante"}
                  </p>
                </>
              ) : (
                <p className="text-amber-900">
                  Cardone non trovato tra i tecnici attivi.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
