"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppUser } from "@/lib/app-user";

type Technician = {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  signature_url: string | null;
  is_active: boolean;
};

type SignatureRow = {
  signature_role: string | null;
  technician_id: string | null;
};

type Props = {
  recordId: string;
};

function joinNames(technicians: Technician[], ids: string[]) {
  return ids
    .map((id) => technicians.find((technician) => technician.id === id))
    .filter((item): item is Technician => Boolean(item))
    .map((item) => item.full_name)
    .join(", ");
}

export default function IssuedReportSignaturesForm({ recordId }: Props) {
  const router = useRouter();
  const { profile } = useAppUser();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [testingIds, setTestingIds] = useState<string[]>([]);
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [directorId, setDirectorId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const director = useMemo(
    () => technicians.find((technician) => technician.id === directorId) ?? null,
    [directorId, technicians]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (profile.role !== "master") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      const [{ data: techniciansData, error: techniciansError }, { data: settingsData }, { data: signaturesData, error: signaturesError }] =
        await Promise.all([
          supabase
            .from("calibration_technicians")
            .select("id, full_name, role, email, signature_url, is_active")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
          supabase
            .from("calibration_report_settings")
            .select("default_director_technician_id")
            .limit(1)
            .maybeSingle(),
          supabase
            .from("calibration_report_signatures")
            .select("signature_role, technician_id")
            .eq("calibration_record_id", recordId),
        ]);

      if (!mounted) return;

      if (techniciansError || signaturesError) {
        setErrorMessage(
          techniciansError?.message || signaturesError?.message || "Errore caricamento nominativi."
        );
        setIsLoading(false);
        return;
      }

      const activeTechnicians = (techniciansData ?? []) as Technician[];
      const signatures = (signaturesData ?? []) as SignatureRow[];
      setTechnicians(activeTechnicians);
      setTestingIds(
        signatures
          .filter((row) => row.signature_role === "testing_technician")
          .map((row) => row.technician_id)
          .filter((id): id is string => Boolean(id))
      );
      setReviewerIds(
        signatures
          .filter((row) => row.signature_role === "reviewer")
          .map((row) => row.technician_id)
          .filter((id): id is string => Boolean(id))
      );
      setDirectorId(
        signatures.find((row) => row.signature_role === "director")?.technician_id ||
          (typeof settingsData?.default_director_technician_id === "string"
            ? settingsData.default_director_technician_id
            : "")
      );
      setIsLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [recordId, profile.role]);

  function toggle(id: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
    setMessage("");
    setErrorMessage("");
  }

  async function save() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (profile.role !== "master") {
        throw new Error("La correzione post-emissione è riservata ai profili MASTER.");
      }

      if (testingIds.length === 0) {
        throw new Error("Seleziona almeno un tecnico addetto alle prove.");
      }
      if (reviewerIds.length === 0) {
        throw new Error("Seleziona almeno un nominativo per redatto/verificato.");
      }
      if (!director) {
        throw new Error("Direttore di laboratorio non configurato.");
      }

      const rows = [
        ...testingIds.map((id, index) => {
          const technician = technicians.find((item) => item.id === id)!;
          return {
            calibration_record_id: recordId,
            signature_role: "testing_technician",
            technician_id: technician.id,
            display_name: technician.full_name,
            signature_url_snapshot: technician.signature_url,
            sort_order: index + 1,
          };
        }),
        ...reviewerIds.map((id, index) => {
          const technician = technicians.find((item) => item.id === id)!;
          return {
            calibration_record_id: recordId,
            signature_role: "reviewer",
            technician_id: technician.id,
            display_name: technician.full_name,
            signature_url_snapshot: technician.signature_url,
            sort_order: index + 1,
          };
        }),
        {
          calibration_record_id: recordId,
          signature_role: "director",
          technician_id: director.id,
          display_name: director.full_name,
          signature_url_snapshot: director.signature_url,
          sort_order: 1,
        },
      ];

      const { error: deleteError } = await supabase
        .from("calibration_report_signatures")
        .delete()
        .eq("calibration_record_id", recordId);
      if (deleteError) throw new Error(deleteError.message);

      const { error: insertError } = await supabase
        .from("calibration_report_signatures")
        .insert(rows);
      if (insertError) throw new Error(insertError.message);

      const { error: detailsError } = await supabase
        .from("calibration_report_details")
        .update({
          technician_name: joinNames(technicians, testingIds) || null,
          reviewer_name: joinNames(technicians, reviewerIds) || null,
          director_name: director.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq("calibration_record_id", recordId);
      if (detailsError) throw new Error(detailsError.message);

      setMessage("Nominativi aggiornati. Il rapporto emesso verrà rielaborato con i nominativi correnti.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Errore durante l'aggiornamento dei nominativi."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (profile.role !== "master") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        La correzione dei nominativi dopo l’emissione è riservata ai profili MASTER.
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Caricamento nominativi...
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">
            Correzione controllata post-emissione
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Nominativi e firme</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Il rapporto resta emesso. Qui puoi correggere esclusivamente i nominativi/firme;
            gli altri dati del rapporto rimangono bloccati.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {isSaving ? "Salvataggio..." : "Salva nominativi"}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {errorMessage}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <TechnicianSelector
          title="Tecnico/i addetto/i alle prove"
          technicians={technicians}
          selectedIds={testingIds}
          onToggle={(id) => toggle(id, setTestingIds)}
        />
        <TechnicianSelector
          title="Redatto / verificato"
          technicians={technicians}
          selectedIds={reviewerIds}
          onToggle={(id) => toggle(id, setReviewerIds)}
        />
        <div className="rounded-xl border border-amber-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">Direttore di laboratorio</h3>
          <p className="mt-3 text-sm font-bold text-slate-950">{director?.full_name ?? "Non configurato"}</p>
          <p className="mt-1 text-xs text-slate-500">Valore fisso da impostazioni rapporto.</p>
        </div>
      </div>
    </section>
  );
}

function TechnicianSelector({
  title,
  technicians,
  selectedIds,
  onToggle,
}: {
  title: string;
  technicians: Technician[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {technicians.map((technician) => (
          <label key={technician.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(technician.id)}
              onChange={() => onToggle(technician.id)}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-slate-900">{technician.full_name}</span>
              <span className="block text-xs text-slate-500">
                {technician.signature_url ? "Firma presente" : "Firma mancante"}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
