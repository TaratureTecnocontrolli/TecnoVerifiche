"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

  const [status, setStatus] = useState(initialStatus || "draft");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function updateStatus(nextStatus: "draft" | "ready" | "issued" | "reopened") {
    setIsSaving(true);
    setErrorMessage("");

    try {
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

      const { error } = await supabase
        .from("calibration_records")
        .update(payload)
        .eq("id", recordId);

      if (error) {
        throw new Error(error.message || "Errore aggiornamento stato.");
      }

      setStatus(nextStatus);
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

            {status === "issued" && issuedAt && (
              <span className="text-xs text-slate-500">
                Emesso il {formatDateTime(issuedAt)}
              </span>
            )}

            {status === "reopened" && reopenedAt && (
              <span className="text-xs text-slate-500">
                Riaperto il {formatDateTime(reopenedAt)}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Il salvataggio PDF non cambia automaticamente lo stato. L'emissione
            deve essere confermata manualmente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(status === "draft" || status === "reopened") && (
            <button
              type="button"
              onClick={() => updateStatus("ready")}
              disabled={isSaving}
              className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
            >
              Segna pronto
            </button>
          )}

          {status !== "issued" && (
            <button
              type="button"
              onClick={() => updateStatus("issued")}
              disabled={isSaving}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              Emetti
            </button>
          )}

          {status === "issued" && (
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
