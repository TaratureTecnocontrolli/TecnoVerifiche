"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type DeleteCalibrationRecordButtonProps = {
  recordId: string;
  recordLabel: string;
  isIssued?: boolean;
};

export default function DeleteCalibrationRecordButton({
  recordId,
  recordLabel,
  isIssued = false,
}: DeleteCalibrationRecordButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function deleteVerification() {
    setErrorMessage("");

    if (isIssued) {
      setErrorMessage("Non puoi eliminare una verifica con rapporto emesso.");
      return;
    }

    const confirmed = window.confirm(
      "Confermi l’eliminazione della verifica " +
        recordLabel +
        "? L’operazione elimina anche dati rapporto, misure, scale e firme collegate."
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await supabase
        .from("calibration_report_signatures")
        .delete()
        .eq("calibration_record_id", recordId);

      await supabase
        .from("calibration_report_details")
        .delete()
        .eq("calibration_record_id", recordId);

      await supabase
        .from("calibration_measurements")
        .delete()
        .eq("calibration_record_id", recordId);

      await supabase
        .from("calibration_record_scales")
        .delete()
        .eq("calibration_record_id", recordId);

      const { error } = await supabase
        .from("calibration_records")
        .delete()
        .eq("id", recordId);

      if (error) {
        throw new Error(error.message);
      }

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l’eliminazione della verifica.";

      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={deleteVerification}
        disabled={isDeleting || isIssued}
        title={
          isIssued
            ? "Non puoi eliminare una verifica con rapporto emesso"
            : "Elimina verifica"
        }
        className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
      >
        {isDeleting ? "Elimino..." : "Elimina"}
      </button>

      {errorMessage && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 shadow-lg">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
