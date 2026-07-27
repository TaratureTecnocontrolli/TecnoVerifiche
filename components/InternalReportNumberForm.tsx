"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type InternalReportNumberFormProps = {
  recordId: string;
  initialReportNumber: string;
  fallbackRecordNumber?: string | null;
};

export default function InternalReportNumberForm({
  recordId,
  initialReportNumber,
  fallbackRecordNumber,
}: InternalReportNumberFormProps) {
  const [reportNumber, setReportNumber] = useState(initialReportNumber ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function saveReportNumber() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    const normalizedReportNumber = reportNumber.trim() || null;

    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from("calibration_report_details")
        .update({
          main_report_number: normalizedReportNumber,
        })
        .eq("calibration_record_id", recordId)
        .select("calibration_record_id");

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertError } = await supabase
          .from("calibration_report_details")
          .insert({
            calibration_record_id: recordId,
            main_report_number: normalizedReportNumber,
          });

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      setMessage("Numero VI salvato correttamente.");
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio del numero VI.";

      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="print-hidden rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-950">
            Numero rapportino VI
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Inserisci manualmente il numero comunicato dall'ufficio. Se lasci il
            campo vuoto, nel rapportino resta il numero tecnico provvisorio.
          </p>

          {fallbackRecordNumber && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Numero tecnico provvisorio: {fallbackRecordNumber}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-[360px]">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">
              N. VI manuale
            </span>
            <input
              value={reportNumber}
              onChange={(event) => {
                setReportNumber(event.target.value);
                setMessage("");
                setErrorMessage("");
              }}
              placeholder="Es. VI-001A-26"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={saveReportNumber}
            disabled={isSaving}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? "Salvataggio..." : "Salva numero VI"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          {errorMessage}
        </div>
      )}
    </section>
  );
}
