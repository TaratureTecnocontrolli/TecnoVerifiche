"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ReferenceInstrumentFormState = {
  name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  internal_code: string;
  measurement_quantity: string;
  unit: string;
  measurement_range: string;
  resolution: string;
  certificate_number: string;
  certificate_date: string;
  certificate_expiry: string;
  status: string;
  notes: string;
};

const initialState: ReferenceInstrumentFormState = {
  name: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  internal_code: "",
  measurement_quantity: "",
  unit: "",
  measurement_range: "",
  resolution: "",
  certificate_number: "",
  certificate_date: "",
  certificate_expiry: "",
  status: "valid",
  notes: "",
};

const ACCEPTED_CERTIFICATE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_CERTIFICATE_SIZE_BYTES = 10 * 1024 * 1024;

function normalizeStorageFileName(fileName: string) {
  const extension = fileName.includes(".")
    ? fileName.split(".").pop()?.toLowerCase()
    : "";

  const baseName = fileName
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${baseName || "certificato"}-${Date.now()}${
    extension ? "." + extension : ""
  }`;
}

function validateCertificateFile(file: File) {
  if (!ACCEPTED_CERTIFICATE_TYPES.includes(file.type)) {
    throw new Error("Formato file non valido. Carica PDF, PNG, JPG o WEBP.");
  }

  if (file.size > MAX_CERTIFICATE_SIZE_BYTES) {
    throw new Error("File troppo grande. Dimensione massima consentita: 10 MB.");
  }
}

async function uploadCertificateFile(file: File) {
  validateCertificateFile(file);

  const storageFileName = normalizeStorageFileName(file.name);
  const storagePath = `certificati/${storageFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("reference-certificates")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from("reference-certificates")
    .getPublicUrl(storagePath);

  return {
    url: data.publicUrl,
    name: file.name,
  };
}

export default function ReferenceInstrumentForm() {
  const router = useRouter();

  const [form, setForm] = useState<ReferenceInstrumentFormState>(initialState);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(
    field: keyof ReferenceInstrumentFormState,
    value: string
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setMessage("");
    setErrorMessage("");
  }

  function onCertificateFileChange(file: File | null) {
    setMessage("");
    setErrorMessage("");

    if (!file) {
      setCertificateFile(null);
      return;
    }

    try {
      validateCertificateFile(file);
      setCertificateFile(file);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "File certificato non valido.";
      setCertificateFile(null);
      setErrorMessage(message);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (!form.name.trim()) {
        throw new Error("Inserisci il nome dello strumento campione.");
      }

      let uploadedCertificate: {
        url: string | null;
        name: string | null;
      } = {
        url: null,
        name: null,
      };

      if (certificateFile) {
        uploadedCertificate = await uploadCertificateFile(certificateFile);
      }

      const { error } = await supabase.from("reference_instruments").insert({
        name: form.name.trim(),
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        serial_number: form.serial_number.trim() || null,
        internal_code: form.internal_code.trim() || null,
        measurement_quantity: form.measurement_quantity.trim() || null,
        unit: form.unit.trim() || null,
        measurement_range: form.measurement_range.trim() || null,
        resolution: form.resolution.trim() || null,
        certificate_number: form.certificate_number.trim() || null,
        certificate_date: form.certificate_date || null,
        certificate_expiry: form.certificate_expiry || null,
        certificate_file_url: uploadedCertificate.url,
        certificate_file_name: uploadedCertificate.name,
        status: form.status,
        notes: form.notes.trim() || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      setMessage("Strumento campione salvato correttamente.");
      setForm(initialState);
      setCertificateFile(null);

      router.refresh();
      router.push("/strumenti-campione");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio dello strumento campione.";

      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati strumento campione
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Nome strumento *
            </span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Es. Contalitri campione"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Costruttore
            </span>
            <input
              value={form.manufacturer}
              onChange={(event) =>
                updateField("manufacturer", event.target.value)
              }
              placeholder="Es. Piusi S.p.A."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Modello</span>
            <input
              value={form.model}
              onChange={(event) => updateField("model", event.target.value)}
              placeholder="Modello"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Matricola / serial number
            </span>
            <input
              value={form.serial_number}
              onChange={(event) =>
                updateField("serial_number", event.target.value)
              }
              placeholder="Matricola"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Codice interno
            </span>
            <input
              value={form.internal_code}
              onChange={(event) =>
                updateField("internal_code", event.target.value)
              }
              placeholder="Es. 306655011"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Stato</span>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="valid">Valido</option>
              <option value="expiring">In scadenza</option>
              <option value="expired">Scaduto</option>
              <option value="out_of_service">Fuori servizio</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati metrologici
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Grandezza misurata
            </span>
            <input
              value={form.measurement_quantity}
              onChange={(event) =>
                updateField("measurement_quantity", event.target.value)
              }
              placeholder="Es. Portata, Pressione, Coppia"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Unità</span>
            <input
              value={form.unit}
              onChange={(event) => updateField("unit", event.target.value)}
              placeholder="Es. l, l/min, bar, N·m"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 xl:col-span-1">
            <span className="text-sm font-medium text-slate-700">
              Campo di misura
            </span>
            <input
              value={form.measurement_range}
              onChange={(event) =>
                updateField("measurement_range", event.target.value)
              }
              placeholder="Es. 0 - 500 l"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Risoluzione
            </span>
            <input
              value={form.resolution}
              onChange={(event) => updateField("resolution", event.target.value)}
              placeholder="Es. 0,1 l"
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
              value={form.certificate_number}
              onChange={(event) =>
                updateField("certificate_number", event.target.value)
              }
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
              value={form.certificate_date}
              onChange={(event) =>
                updateField("certificate_date", event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Scadenza certificato
            </span>
            <input
              type="date"
              value={form.certificate_expiry}
              onChange={(event) =>
                updateField("certificate_expiry", event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              File certificato
            </span>

            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              onChange={(event) =>
                onCertificateFileChange(event.target.files?.[0] ?? null)
              }
              className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
            />
          </label>

          <p className="mt-2 text-xs text-slate-500">
            Formati accettati: PDF, PNG, JPG, WEBP. Dimensione massima: 10 MB.
          </p>

          {certificateFile && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              File selezionato:{" "}
              <span className="font-semibold">{certificateFile.name}</span>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={4}
            placeholder="Note interne sullo strumento campione"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {errorMessage}
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
          {isSaving ? "Salvataggio..." : "Salva strumento campione"}
        </button>
      </div>
    </form>
  );
}
