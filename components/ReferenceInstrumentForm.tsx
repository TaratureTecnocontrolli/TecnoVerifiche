"use client";

import { useEffect, useMemo, useState } from "react";
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
  custom_unit: string;
  measurement_range: string;
  certificate_number: string;
  certificate_date: string;
  certificate_expiry: string;
  status: string;
  notes: string;
};

type MeasurementOption = {
  label: string;
  quantity: string;
};

const measurementOptions: MeasurementOption[] = [
  { label: "Forza", quantity: "Forza" },
  { label: "Pressione", quantity: "Pressione" },
  { label: "Coppia", quantity: "Coppia" },
  { label: "Portata / volume", quantity: "Portata / volume" },
  { label: "Temperatura", quantity: "Temperatura" },
  { label: "Dimensionale", quantity: "Dimensionale" },
  { label: "Massa", quantity: "Massa" },
  { label: "Sclerometro / rimbalzo", quantity: "Sclerometro / rimbalzo" },
  { label: "Pull-off", quantity: "Pull-off" },
  { label: "Altro", quantity: "Altro" },
];

const unitOptions: string[] = [
  "kN",
  "N",
  "daN",
  "MN",
  "bar",
  "mbar",
  "Pa",
  "kPa",
  "MPa",
  "Nm",
  "Ncm",
  "l",
  "ml",
  "m³",
  "l/min",
  "l/h",
  "m³/h",
  "°C",
  "mm",
  "cm",
  "m",
  "kg",
  "g",
  "indice di rimbalzo",
  "%",
  "Altro",
];

const initialState: ReferenceInstrumentFormState = {
  name: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  internal_code: "",
  measurement_quantity: "",
  unit: "",
  custom_unit: "",
  measurement_range: "",
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

function getEffectiveStatus(status: string, certificateExpiry: string) {
  if (status === "dismissed") return "dismissed";
  if (status === "out_of_service") return "out_of_service";
  if (!certificateExpiry) return "valid";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(certificateExpiry);
  expiry.setHours(0, 0, 0, 0);

  if (expiry.getTime() < today.getTime()) return "expired";

  return "valid";
}

function statusLabel(status: string) {
  if (status === "valid") return "Operativo";
  if (status === "expired") return "Disattivato per certificato scaduto";
  if (status === "out_of_service") return "Fuori servizio";
  if (status === "dismissed") return "Dismesso";

  return status;
}

function statusClass(status: string) {
  if (status === "valid") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "expired") return "border-red-200 bg-red-50 text-red-900";
  if (status === "out_of_service") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "dismissed") return "border-slate-300 bg-slate-100 text-slate-800";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function isPreviewableFile(file: File) {
  return file.type === "application/pdf" || file.type.startsWith("image/");
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
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const effectiveUnit = form.unit === "Altro" ? form.custom_unit.trim() : form.unit;

  const effectiveStatus = useMemo(() => {
    return getEffectiveStatus(form.status, form.certificate_expiry);
  }, [form.status, form.certificate_expiry]);

  useEffect(() => {
    if (!certificateFile) {
      setCertificatePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(certificateFile);
    setCertificatePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [certificateFile]);

  function updateField(field: keyof ReferenceInstrumentFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setMessage("");
    setErrorMessage("");
  }

  function updateMeasurementQuantity(value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      measurement_quantity: value,
    }));

    setMessage("");
    setErrorMessage("");
  }

  function updateUnit(value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      unit: value,
      custom_unit: value === "Altro" ? currentForm.custom_unit : "",
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

      if (form.unit === "Altro" && !form.custom_unit.trim()) {
        throw new Error("Inserisci l’unità di misura personalizzata.");
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

      const statusToSave =
        form.status === "dismissed" || form.status === "out_of_service"
          ? form.status
          : "valid";

      const { data: insertedInstrument, error } = await supabase
        .from("reference_instruments")
        .insert({
          name: form.name.trim(),
          manufacturer: form.manufacturer.trim() || null,
          model: form.model.trim() || null,
          serial_number: form.serial_number.trim() || null,
          internal_code: form.internal_code.trim() || null,
          measurement_quantity: form.measurement_quantity.trim() || null,
          unit: effectiveUnit || null,
          measurement_range: form.measurement_range.trim() || null,
          resolution: null,
          certificate_number: form.certificate_number.trim() || null,
          certificate_date: form.certificate_date || null,
          certificate_expiry: form.certificate_expiry || null,
          certificate_file_url: uploadedCertificate.url,
          certificate_file_name: uploadedCertificate.name,
          status: statusToSave,
          notes: form.notes.trim() || null,
        })
        .select("id")
        .single();

      if (error || !insertedInstrument) {
        throw new Error(error?.message || "Errore durante il salvataggio.");
      }

      if (
        uploadedCertificate.url ||
        form.certificate_number.trim() ||
        form.certificate_date ||
        form.certificate_expiry
      ) {
        const { error: certificateHistoryError } = await supabase
          .from("reference_instrument_certificates")
          .insert({
            reference_instrument_id: insertedInstrument.id,
            certificate_number: form.certificate_number.trim() || null,
            certificate_date: form.certificate_date || null,
            certificate_expiry: form.certificate_expiry || null,
            file_url: uploadedCertificate.url,
            file_name: uploadedCertificate.name,
            is_current: true,
            notes:
              "Certificato attualmente valido al momento della registrazione dello strumento.",
          });

        if (certificateHistoryError) {
          throw new Error(
            certificateHistoryError.message ||
              "Strumento salvato, ma errore nello storico certificati."
          );
        }
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
              <option value="valid">Operativo</option>
              <option value="out_of_service">Fuori servizio</option>
              <option value="dismissed">Dismesso</option>
            </select>
          </label>
        </div>

        <div
          className={
            "mt-5 rounded-xl border p-4 text-sm " + statusClass(effectiveStatus)
          }
        >
          <p className="font-semibold">
            Stato effettivo: {statusLabel(effectiveStatus)}
          </p>
          <p className="mt-1">
            Se lo strumento è operativo ma il certificato risulta scaduto, il
            sistema lo considera disattivato ai fini dell’utilizzo nelle
            verifiche. “Dismesso” resta invece una scelta manuale definitiva.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Caratteristiche metrologiche
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Grandezza misurata
            </span>
            <select
              value={form.measurement_quantity}
              onChange={(event) => updateMeasurementQuantity(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleziona grandezza</option>
              {measurementOptions.map((option) => (
                <option key={option.quantity} value={option.quantity}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Unità</span>
            <select
              value={form.unit}
              onChange={(event) => updateUnit(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleziona unità</option>
              {unitOptions.map((unitOption) => (
                <option key={unitOption} value={unitOption}>
                  {unitOption}
                </option>
              ))}
            </select>
          </label>

          {form.unit === "Altro" && (
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Unità personalizzata
              </span>
              <input
                value={form.custom_unit}
                onChange={(event) =>
                  updateField("custom_unit", event.target.value)
                }
                placeholder="Inserisci unità"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="space-y-1 xl:col-span-1">
            <span className="text-sm font-medium text-slate-700">
              Fondo scala
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
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Certificato di taratura attualmente valido
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Inserisci qui il certificato in corso di validità. Quando in futuro
          caricherai un nuovo certificato, quello precedente dovrà finire nello
          storico certificati.
        </p>

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
              File certificato attualmente valido
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

          {certificateFile && certificatePreviewUrl && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  Anteprima certificato
                </p>
                <p className="text-xs text-slate-500">
                  Anteprima locale del file selezionato, senza scaricarlo.
                </p>
              </div>

              {isPreviewableFile(certificateFile) ? (
                certificateFile.type === "application/pdf" ? (
                  <iframe
                    src={certificatePreviewUrl}
                    title="Anteprima certificato"
                    className="h-[520px] w-full"
                  />
                ) : (
                  <img
                    src={certificatePreviewUrl}
                    alt="Anteprima certificato"
                    className="max-h-[520px] w-full object-contain"
                  />
                )
              ) : (
                <div className="p-4 text-sm text-slate-600">
                  Anteprima non disponibile per questo formato.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Storico certificati passati
        </h2>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold">
            Nessun certificato passato in fase di nuovo inserimento.
          </p>
          <p className="mt-1">
            Lo storico verrà popolato quando, dalla scheda/modifica dello
            strumento campione, verrà sostituito il certificato attualmente
            valido con uno nuovo.
          </p>
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