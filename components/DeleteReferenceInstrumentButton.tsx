"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type DeleteReferenceInstrumentButtonProps = {
  instrumentId: string;
  instrumentName: string;
};

export default function DeleteReferenceInstrumentButton({
  instrumentId,
  instrumentName,
}: DeleteReferenceInstrumentButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function deleteInstrument() {
    setErrorMessage("");

    const confirmed = window.confirm(
      "Vuoi eliminare lo strumento campione \"" +
        instrumentName +
        "\"?\n\n" +
        "Procedi solo se è stato inserito per errore e non è già collegato a verifiche o rapporti."
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("reference_instruments")
        .delete()
        .eq("id", instrumentId);

      if (error) {
        throw new Error(error.message);
      }

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante l’eliminazione.";

      if (
        message.toLowerCase().includes("foreign key") ||
        message.toLowerCase().includes("violates") ||
        message.toLowerCase().includes("constraint")
      ) {
        setErrorMessage(
          "Impossibile eliminare: lo strumento campione risulta già usato in una verifica o in un rapporto. In questo caso va messo fuori servizio, non cancellato."
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={deleteInstrument}
        disabled={isDeleting}
        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {isDeleting ? "Elimino..." : "Elimina"}
      </button>

      {errorMessage && (
        <p className="max-w-[240px] text-xs font-medium text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
