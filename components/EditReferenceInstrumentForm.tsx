"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ReferenceInstrumentInitialData = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  resolution: string | null;
  certificate_number: string | null;
  certificate_date: string | null;
  certificate_expiry: string | null;
  certificate_file_url?: string | null;
  certificate_file_name?: string | null;
  status: string;
  notes: string | null;
};

type EditReferenceInstrumentFormProps = {
  instrument: ReferenceInstrumentInitialData;
};

const MAX_CERTIFICATE_SIZE_BYTES = 10 * 1024 * 1024;

function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

function getFileExtension(file: File) {
  const parts = file.name.split(".");
  const extension = parts[parts.length - 1]?.toLowerCase();

  if (extension) {
    return extension;
  }

  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";

  return "pdf";
}

function isAcceptedCertificateFile(file: File) {
  return [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
  ].includes(file.type);
}

async function uploadCertificate(instrumentId: string, file: File) {
  const extension = getFileExtension(file);
  const safeFileName = `${instrumentId}-${Date.now()}.${extension}`;
  const storagePath = `reference-instruments/${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("reference-certificates")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from("reference-certificates")
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

export default function EditReferenceInstrumentForm({
  instrument,
}: EditReferenceInstrumentFormProps) {
  const router = useRouter();

  const [name, setName] = useState(instrument.name);
  const [manufacturer, setManufacturer] = useState(valueOrEmpty(instrument.manufacturer));
  const [model, setModel] = useState(valueOrEmpty(instrument.model));
  const [serialNumber, setSerialNumber] = useState(valueOrEmpty(instrument.serial_number));
  const [internalCode, setInternalCode] = useState(valueOrEmpty(instrument.internal_code));
  const [measurementQuantity, setMeasurementQuantity] = useState(valueOrEmpty(instrument.measurement_quantity));
  const [unit, setUnit] = useState(valueOrEmpty(instrument.unit));
  const [measurementRange, setMeasurementRange] = useState(valueOrEmpty(instrument.measurement_range));
  const [resolution, setResolution] = useState(valueOrEmpty(instrument.resolution));
  const [certificateNumber, setCertificateNumber] = useState(valueOrEmpty(instrument.certificate_number));
  const [certificateDate, setCertificateDate] = useState(valueOrEmpty(instrument.certificate_date));
  const [certificateExpiry, setCertificateExpiry] = useState(valueOrEmpty(instrument.certificate_expiry));
  const [certificateFileUrl, setCertificateFileUrl] = useState(valueOrEmpty(instrument.certificate_file_url));
  const [certificateFileName, setCertificateFileName] = useState(valueOrEmpty(instrument.certificate_file_name));
  const [newCertificateFile, setNewCertificateFile] = useState<File | null>(null);
  const [removeCertificateFile, setRemoveCertificateFile] = useState(false);
  const [status, setStatus] = useState(instrument.status || "valid");
  const [notes, setNotes] = useState(valueOrEmpty(instrument.notes));

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  function handleCertificateFileChange(file: File | null) {
    setSaveMessage("");
    setSaveError("");
    setNewCertificateFile(null);
    setRemoveCertificateFile(false);

    if (!file) {
      return;
    }

    if (!isAcceptedCertificateFile(file)) {
      setSaveError("Formato certificato non valido. Usa PDF, PNG, JPG o WEBP.");
      return;
    }

    if (file.size > MAX_CERTIFICATE_SIZE_BYTES) {
      setSaveError("Il file certificato è troppo grande. Dimensione massima: 10 MB.");
      return;
    }

    setNewCertificateFile(file);
  }

  function markCertificateForRemoval() {
    setNewCertificateFile(null);
    setRemoveCertificateFile(true);
    setCertificateFileUrl("");
    setCertificateFileName("");
    setSaveMessage("");
    setSaveError("");
  }

  async function saveInstrument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      if (!name.trim()) {
        throw new Error("Inserisci il nome dello strumento campione.");
      }

      let nextCertificateFileUrl = certificateFileUrl || null;
      let nextCertificateFileName = certificateFileName || null;

      if (removeCertificateFile) {
        nextCertificateFileUrl = null;
        nextCertificateFileName = null;
      }

      if (newCertificateFile) {
        nextCertificateFileUrl = await uploadCertificate(
          instrument.id,
          newCertificateFile
        );
        nextCertificateFileName = newCertificateFile.name;
      }

      const { error } = await supabase
        .from("reference_instruments")
        .update({
          name: name.trim(),
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          serial_number: serialNumber.trim() || null,
          internal_code: internalCode.trim() || null,
          measurement_quantity: measurementQuantity.trim() || null,
          unit: unit.trim() || null,
          measurement_range: measurementRange.trim() || null,
          resolution: resolution.trim() || null,
          certificate_number: certificateNumber.trim() || null,
          certificate_date: certificateDate || null,
          certificate_expiry: certificateExpiry || null,
          certificate_file_url: nextCertificateFileUrl,
          certificate_file_name: nextCertificateFileName,
          status,
          notes: notes.trim() || null,
        })
        .eq("id", instrument.id);

      if (error) {
        throw new Error(
          error.message ||
            "Errore durante l’aggiornamento dello strumento campione."
        );
      }

      setCertificateFileUrl(nextCertificateFileUrl ?? "");
      setCertificateFileName(nextCertificateFileName ?? "");
      setNewCertificateFile(null);
      setRemoveCertificateFile(false);
      setSaveMessage("Strumento campione aggiornato correttamente.");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il salvataggio.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={saveInstrument} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati strumento campione
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Nome strumento *
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Es. Cella di carico, manometro campione..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Stato *</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="valid">Valido</option>
              <option value="expiring">In scadenza</option>
              <option value="expired">Scaduto</option>
              <option value="out_of_service">Fuori servizio</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Codice interno</span>
            <input
              value={internalCode}
              onChange={(event) => setInternalCode(event.target.value)}
              placeholder="Codice interno"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Costruttore</span>
            <input
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
              placeholder="Costruttore"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Modello</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Modello"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Matricola</span>
            <input
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="Matricola / serial number"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Grandezza misurata</span>
            <input
              value={measurementQuantity}
              onChange={(event) => setMeasurementQuantity(event.target.value)}
              placeholder="Es. forza, pressione"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Unità</span>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="Es. kN, bar"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Campo / fondo scala</span>
            <input
              value={measurementRange}
              onChange={(event) => setMeasurementRange(event.target.value)}
              placeholder="Es. 0 - 300 kN"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Risoluzione</span>
            <input
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="Es. 0,1 bar"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Certificato di taratura
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Numero certificato
            </span>
            <input
              value={certificateNumber}
              onChange={(event) => setCertificateNumber(event.target.value)}
              placeholder="Numero certificato"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Data certificato
            </span>
            <input
              type="date"
              value={certificateDate}
              onChange={(event) => setCertificateDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Scadenza certificato
            </span>
            <input
              type="date"
              value={certificateExpiry}
              onChange={(event) => setCertificateExpiry(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            File certificato
          </p>

          {certificateFileUrl ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">
                Certificato caricato
              </p>
              <p className="mt-1">
                {certificateFileName || "File certificato"}
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href={certificateFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  Apri certificato
                </a>

                <button
                  type="button"
                  onClick={markCertificateForRemoval}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Rimuovi certificato
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Nessun file certificato caricato.
            </p>
          )}

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Carica / sostituisci certificato
            </span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handleCertificateFileChange(file);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <p className="mt-2 text-xs text-slate-500">
            Formati ammessi: PDF, PNG, JPG, WEBP. Dimensione massima: 10 MB.
          </p>

          {newCertificateFile && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              Nuovo file selezionato: {newCertificateFile.name}. Verrà salvato al click su “Salva modifiche”.
            </p>
          )}

          {removeCertificateFile && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">
              Il certificato verrà rimosso al click su “Salva modifiche”.
            </p>
          )}
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Note sullo strumento campione"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {saveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {saveError}
        </div>
      )}

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-900">
          {saveMessage}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/strumenti-campione")}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Annulla
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </div>
    </form>
  );
}
