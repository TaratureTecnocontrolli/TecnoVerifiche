"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ReportEmissionActionsProps = {
  recordId: string;
  reportStatus: string;
  issuedAt: string | null;
  reopenedAt: string | null;
  canIssue: boolean;
  blockingCount: number;
};

function formatItalianDateTime(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusInfo(status: string, canIssue: boolean) {
  if (status === "issued") {
    return {
      label: "Emesso",
      description:
        "Il rapporto risulta emesso. Eventuali modifiche dovrebbero essere fatte solo riaprendo il rapporto per correzione.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  if (status === "reopened") {
    return {
      label: "Da correggere / riaperto",
      description:
        "Il rapporto è stato riaperto per correzione. Dopo le modifiche potrà essere nuovamente emesso.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (canIssue) {
    return {
      label: "Pronto per emissione",
      description:
        "I dati obbligatori risultano presenti. Dopo aver stampato/salvato il PDF, segna il rapporto come emesso.",
      className: "border-sky-200 bg-sky-50 text-sky-900",
    };
  }

  return {
    label: "Bozza",
    description:
      "Il rapporto è ancora incompleto. Correggi i dati obbligatori prima dell’emissione ufficiale.",
    className: "border-slate-200 bg-slate-50 text-slate-800",
  };
}

export default function ReportEmissionActions({
  recordId,
  reportStatus,
  issuedAt,
  reopenedAt,
  canIssue,
  blockingCount,
}: ReportEmissionActionsProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  const statusInfo = getStatusInfo(reportStatus, canIssue);
  const formattedIssuedAt = formatItalianDateTime(issuedAt);
  const formattedReopenedAt = formatItalianDateTime(reopenedAt);

  async function markAsIssued() {
    setIsUpdating(true);
    setError("");

    const { error: updateError } = await supabase
      .from("calibration_records")
      .update({
        report_status: "issued",
        issued_at: new Date().toISOString(),
      })
      .eq("id", recordId);

    if (updateError) {
      setError(updateError.message);
      setIsUpdating(false);
      return;
    }

    router.refresh();
    setIsUpdating(false);
  }

  async function reopenReport() {
    setIsUpdating(true);
    setError("");

    const { error: updateError } = await supabase
      .from("calibration_records")
      .update({
        report_status: "reopened",
        reopened_at: new Date().toISOString(),
      })
      .eq("id", recordId);

    if (updateError) {
      setError(updateError.message);
      setIsUpdating(false);
      return;
    }

    router.refresh();
    setIsUpdating(false);
  }

  return (
    <div className="print-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Stato rapporto
          </p>

          <div
            className={
              "mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-bold " +
              statusInfo.className
            }
          >
            {statusInfo.label}
          </div>

          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            {statusInfo.description}
          </p>

          {formattedIssuedAt && (
            <p className="mt-2 text-xs text-slate-500">
              Emesso il {formattedIssuedAt}
            </p>
          )}

          {formattedReopenedAt && reportStatus === "reopened" && (
            <p className="mt-2 text-xs text-slate-500">
              Riaperto il {formattedReopenedAt}
            </p>
          )}

          {!canIssue && (
            <p className="mt-2 text-xs font-medium text-red-700">
              Dati obbligatori mancanti: {blockingCount}
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {reportStatus === "issued" ? (
            <button
              type="button"
              onClick={reopenReport}
              disabled={isUpdating}
              className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "Aggiornamento..." : "Riapri per correzione"}
            </button>
          ) : (
            <button
              type="button"
              onClick={markAsIssued}
              disabled={isUpdating || !canIssue}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isUpdating ? "Aggiornamento..." : "Segna come emesso"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
