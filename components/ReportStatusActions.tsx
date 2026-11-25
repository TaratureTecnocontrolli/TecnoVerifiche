"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppUser } from "@/lib/app-user";

type ReportStatusActionsProps = {
  recordId: string;
  initialStatus?: string | null;
  issuedAt?: string | null;
  reopenedAt?: string | null;
  documentLabel?: string;
};

function statusLabel(status: string | null | undefined) {
  if (status === "draft") return "Bozza";
  if (status === "ready") return "Pronto";
  if (status === "issued") return "Emesso";
  if (status === "reopened") return "Da correggere";

  return "Bozza";
}

function statusClass(status: string | null | undefined) {
  if (status === "issued") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (status === "ready") {
    return "border-blue-200 bg-blue-50 text-blue-900";
  }

  if (status === "reopened") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-800";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function ReportStatusActions({
  recordId,
  initialStatus,
  issuedAt,
  reopenedAt,
  documentLabel = "documento",
}: ReportStatusActionsProps) {
  const router = useRouter();
  const { profile } = useAppUser();

  const [status, setStatus] = useState(initialStatus || "draft");
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(
    profile.role !== "master"
  );
  const [canEditRecord, setCanEditRecord] = useState(profile.role === "master");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setStatus(initialStatus || "draft");
  }, [recordId, initialStatus]);

  useEffect(() => {
    let isMounted = true;

    async function checkEditPermission() {
      if (profile.role === "master") {
        if (isMounted) {
          setCanEditRecord(true);
          setIsCheckingPermission(false);
        }
        return;
      }

      setIsCheckingPermission(true);
      setCanEditRecord(false);

      const { data, error } = await supabase.rpc("tv_can_edit_record", {
        p_record_id: recordId,
      });

      if (!isMounted) return;

      if (error) {
        setCanEditRecord(false);
        setErrorMessage("Impossibile verificare i permessi sul rapportino: " + error.message);
      } else {
        setCanEditRecord(data === true);
      }

      setIsCheckingPermission(false);
    }

    void checkEditPermission();

    return () => {
      isMounted = false;
    };
  }, [profile.role, recordId, initialStatus]);

  async function updateStatus(nextStatus: "draft" | "ready" | "issued" | "reopened") {
    setIsSaving(true);
    setErrorMessage("");

    try {
      if (profile.role === "technician") {
        if (nextStatus !== "ready" && nextStatus !== "issued") {
          throw new Error("La riapertura del rapportino è riservata al profilo MASTER.");
        }

        if (isCheckingPermission || !canEditRecord || status === "issued") {
          throw new Error("Puoi modificare lo stato soltanto delle tue VI ancora modificabili.");
        }

        const { data: permitted, error: permissionError } = await supabase.rpc(
          "tv_can_edit_record", { p_record_id: recordId }
        );
        if (permissionError || permitted !== true) {
          throw new Error(permissionError?.message || "Non hai più i permessi per modificare questa VI.");
        }
      }

      const payload: {
        report_status: string;
        issued_at?: string | null;
        reopened_at?: string | null;
      } = {
        report_status: nextStatus,
      };

      if (nextStatus === "issued") {
        payload.issued_at = new Date().toISOString();
      }

      if (nextStatus === "reopened") {
        payload.reopened_at = new Date().toISOString();
      }

      const query = supabase
        .from("calibration_records")
        .update(payload)
        .eq("id", recordId);
      // Evita di sovrascrivere uno stato cambiato nel frattempo da un altro utente.
      const guardedQuery = status === "draft"
        ? query.or("report_status.eq.draft,report_status.is.null")
        : query.eq("report_status", status);
      const { data: updated, error } = await guardedQuery
        .select("id, report_status")
        .maybeSingle();

      if (error) {
        throw new Error(error.message || "Errore aggiornamento stato.");
      }
      if (!updated || updated.report_status !== nextStatus) {
        throw new Error("Stato non aggiornato: verifica i permessi o ricarica la pagina.");
      }

      setStatus(nextStatus);
      if (nextStatus === "issued" && profile.role === "technician") {
        setCanEditRecord(false);
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Errore durante l'aggiornamento dello stato."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isMaster = profile.role === "master";
  const technicianCanChangeStatus =
    profile.role === "technician" &&
    !isCheckingPermission &&
    canEditRecord &&
    (status === "draft" || status === "ready" || status === "reopened");
  const technicianCanMarkReady = technicianCanChangeStatus &&
    (status === "draft" || status === "reopened");

  return (
    <div className="print-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Stato {documentLabel}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={
                "inline-flex rounded-full border px-3 py-1 text-sm font-bold " +
                statusClass(status)
              }
            >
              {statusLabel(status)}
            </span>

            {status === "reopened" && reopenedAt && (
              <span className="text-xs text-slate-500">
                Riaperto il {formatDateTime(reopenedAt)}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {isMaster
              ? "Il salvataggio PDF non cambia automaticamente lo stato. L'emissione deve essere confermata manualmente."
              : isCheckingPermission
                ? "Verifica dei permessi in corso."
                : technicianCanChangeStatus
                  ? "Puoi segnare come pronto ed emettere il tuo rapportino. Dopo l'emissione, la riapertura è riservata al MASTER."
                  : "Rapportino in sola lettura. La riapertura è riservata al MASTER."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isMaster && (status === "draft" || status === "reopened") && (
            <button
              type="button"
              onClick={() => updateStatus("ready")}
              disabled={isSaving}
              className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
            >
              Segna pronto
            </button>
          )}

          {technicianCanMarkReady && (
            <button
              type="button"
              onClick={() => updateStatus("ready")}
              disabled={isSaving || isCheckingPermission}
              className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
            >
              Segna pronto
            </button>
          )}

          {(isMaster && status !== "issued" || technicianCanChangeStatus) && (
            <button
              type="button"
              onClick={() => updateStatus("issued")}
              disabled={isSaving}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              Emetti
            </button>
          )}

          {isMaster && status === "issued" && (
            <button
              type="button"
              onClick={() => updateStatus("reopened")}
              disabled={isSaving}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              Riapri per correzione
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
