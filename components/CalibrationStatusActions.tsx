"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type CalibrationStatusActionsProps = {
  recordId: string;
  recordNumber: string | null;
  currentStatus: string;
};

function statusLabel(status: string) {
  if (status === "draft") return "Bozza";
  if (status === "completed") return "Completata";
  if (status === "validated") return "Validata";

  return status;
}

export default function CalibrationStatusActions({
  recordId,
  recordNumber,
  currentStatus,
}: CalibrationStatusActionsProps) {
  const router = useRouter();

  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function updateStatus(nextStatus: "completed" | "validated") {
    setIsUpdating(true);
    setErrorMessage("");

    try {
      const oldStatus = currentStatus;

      const { error: updateError } = await supabase
        .from("calibration_records")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        entity_type: "calibration_record",
        entity_id: recordId,
        action: "status_change",
        old_data: {
          status: oldStatus,
          status_label: statusLabel(oldStatus),
        },
        new_data: {
          status: nextStatus,
          status_label: statusLabel(nextStatus),
          record_number: recordNumber,
        },
        created_by: "Sistema sviluppo",
      });

      if (auditError) {
        throw new Error(
          `Stato aggiornato, ma errore nella registrazione audit log: ${auditError.message}`
        );
      }

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante l’aggiornamento dello stato.";

      setErrorMessage(message);
    } finally {
      setIsUpdating(false);
    }
  }

  if (currentStatus === "validated") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <strong>Verifica validata.</strong> Questa verifica risulta validata.
        Nei prossimi passaggi bloccheremo modifiche e predisporremo
        l’esportazione finale.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Stato verifica
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Gestisci l’avanzamento della verifica. Ogni cambio stato viene
            registrato nell’audit log.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {currentStatus === "draft" && (
            <button
              type="button"
              onClick={() => updateStatus("completed")}
              disabled={isUpdating}
              className="rounded-xl bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isUpdating ? "Aggiornamento..." : "Completa verifica"}
            </button>
          )}

          {currentStatus === "completed" && (
            <button
              type="button"
              onClick={() => updateStatus("validated")}
              disabled={isUpdating}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isUpdating ? "Aggiornamento..." : "Valida verifica"}
            </button>
          )}
        </div>
      </div>

      {currentStatus === "draft" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          La verifica è ancora in bozza. Può essere completata quando i dati
          inseriti sono stati controllati.
        </div>
      )}

      {currentStatus === "completed" && (
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          La verifica è completata. Può essere validata dopo il controllo del
          responsabile.
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {errorMessage}
        </div>
      )}
    </div>
  );
}