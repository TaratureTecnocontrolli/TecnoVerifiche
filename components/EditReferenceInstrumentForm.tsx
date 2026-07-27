"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type CertificateHistoryRow = {
  id: string;
  certificate_number: string | null;
  certificate_date: string | null;
  certificate_expiry: string | null;
  file_url: string | null;
  file_name: string | null;
  is_current: boolean;
  notes: string | null;
  created_at: string;
};

type EditReferenceInstrumentFormProps = {
  instrument: ReferenceInstrumentInitialData;
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

const MAX_CERTIFICATE_SIZE_BYTES = 10 * 1024 * 1024;

function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

function getFileExtension(file: File) {
  const parts = file.name.split(".");
  const extension = parts[parts.length - 1]?.toLowerCase();

  if (extension) return extension;
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

function isPreviewableUrl(url: string | null | undefined) {
  if (!url) return false;

  const normalized = url.toLowerCase().split("?")[0];

  return (
    normalized.endsWith(".pdf") ||
    normalized.endsWith(".png") ||
    normalized.endsWith(".jpg") ||
    normalized.endsWith(".jpeg") ||
    normalized.endsWith(".webp")
  );
}

function isPdfUrl(url: string | null | undefined) {
  if (!url) return false;

  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

function isImageUrl(url: string | null | undefined) {
  if (!url) return false;

  const normalized = url.toLowerCase().split("?")[0];

  return (
    normalized.endsWith(".png") ||
    normalized.endsWith(".jpg") ||
    normalized.endsWith(".jpeg") ||
    normalized.endsWith(".webp")
  );
}

function isPreviewableFile(file: File) {
  return file.type === "application/pdf" || file.type.startsWith("image/");
}

function getEffectiveStatus(status: string, certificateExpiry: string | null) {
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

function formatItalianDate(date: string | null | undefined) {
  if (!date) return "-";

  const parts = date.split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function getUploadedStoragePath(instrumentId: string, file: File) {
  const extension = getFileExtension(file);
  const safeFileName = `${instrumentId}-${Date.now()}.${extension}`;

  return `reference-instruments/${safeFileName}`;
}

async function uploadCertificate(instrumentId: string, file: File) {
  const storagePath = getUploadedStoragePath(instrumentId, file);

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

function CertificatePreview({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  if (!isPreviewableUrl(url)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Anteprima non disponibile per questo formato.
      </div>
    );
  }

  if (isPdfUrl(url)) {
    return (
      <iframe
        src={url}
        title={title}
        className="h-[520px] w-full rounded-xl border border-slate-200 bg-white"
      />
    );
  }

  if (isImageUrl(url)) {
    return (
      <img
        src={url}
        alt={title}
        className="max-h-[520px] w-full rounded-xl border border-slate-200 bg-white object-contain"
      />
    );
  }

  return null;
}

function LocalCertificatePreview({
  file,
  url,
}: {
  file: File;
  url: string;
}) {
  if (!isPreviewableFile(file)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Anteprima non disponibile per questo formato.
      </div>
    );
  }

  if (file.type === "application/pdf") {
    return (
      <iframe
        src={url}
        title="Anteprima nuovo certificato"
        className="h-[520px] w-full rounded-xl border border-slate-200 bg-white"
      />
    );
  }

  return (
    <img
      src={url}
      alt="Anteprima nuovo certificato"
      className="max-h-[520px] w-full rounded-xl border border-slate-200 bg-white object-contain"
    />
  );
}

export default function EditReferenceInstrumentForm({
  instrument,
}: EditReferenceInstrumentFormProps) {
  const router = useRouter();

  const initialUnit = valueOrEmpty(instrument.unit);
  const initialUnitIsListed = initialUnit === "" || unitOptions.includes(initialUnit);

  const [name, setName] = useState(instrument.name);
  const [manufacturer, setManufacturer] = useState(
    valueOrEmpty(instrument.manufacturer)
  );
  const [model, setModel] = useState(valueOrEmpty(instrument.model));
  const [serialNumber, setSerialNumber] = useState(
    valueOrEmpty(instrument.serial_number)
  );
  const [internalCode, setInternalCode] = useState(
    valueOrEmpty(instrument.internal_code)
  );
  const [measurementQuantity, setMeasurementQuantity] = useState(
    valueOrEmpty(instrument.measurement_quantity)
  );
  const [unit, setUnit] = useState(initialUnitIsListed ? initialUnit : "Altro");
  const [customUnit, setCustomUnit] = useState(
    initialUnitIsListed ? "" : initialUnit
  );
  const [measurementRange, setMeasurementRange] = useState(
    valueOrEmpty(instrument.measurement_range)
  );
  const [certificateNumber, setCertificateNumber] = useState(
    valueOrEmpty(instrument.certificate_number)
  );
  const [certificateDate, setCertificateDate] = useState(
    valueOrEmpty(instrument.certificate_date)
  );
  const [certificateExpiry, setCertificateExpiry] = useState(
    valueOrEmpty(instrument.certificate_expiry)
  );
  const [certificateFileUrl, setCertificateFileUrl] = useState(
    valueOrEmpty(instrument.certificate_file_url)
  );
  const [certificateFileName, setCertificateFileName] = useState(
    valueOrEmpty(instrument.certificate_file_name)
  );
  const [newCertificateFile, setNewCertificateFile] = useState<File | null>(
    null
  );
  const [newCertificatePreviewUrl, setNewCertificatePreviewUrl] = useState("");
  const [removeCertificateFile, setRemoveCertificateFile] = useState(false);
  const [status, setStatus] = useState(instrument.status || "valid");
  const [notes, setNotes] = useState(valueOrEmpty(instrument.notes));
  const [certificateHistory, setCertificateHistory] = useState<
    CertificateHistoryRow[]
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const effectiveUnit = unit === "Altro" ? customUnit.trim() : unit;

  const effectiveStatus = useMemo(() => {
    return getEffectiveStatus(status, certificateExpiry || null);
  }, [status, certificateExpiry]);

  useEffect(() => {
    async function loadCertificateHistory() {
      setIsLoadingHistory(true);
      setHistoryError("");

      const { data, error } = await supabase
        .from("reference_instrument_certificates")
        .select(
          `
          id,
          certificate_number,
          certificate_date,
          certificate_expiry,
          file_url,
          file_name,
          is_current,
          notes,
          created_at
        `
        )
        .eq("reference_instrument_id", instrument.id)
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        setHistoryError(error.message);
        setCertificateHistory([]);
        setIsLoadingHistory(false);
        return;
      }

      setCertificateHistory((data ?? []) as CertificateHistoryRow[]);
      setIsLoadingHistory(false);
    }

    loadCertificateHistory();
  }, [instrument.id]);

  useEffect(() => {
    if (!newCertificateFile) {
      setNewCertificatePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(newCertificateFile);
    setNewCertificatePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [newCertificateFile]);

  function handleMeasurementQuantityChange(value: string) {
    setMeasurementQuantity(value);
    setSaveMessage("");
    setSaveError("");
  }

  function handleUnitChange(value: string) {
    setUnit(value);

    if (value !== "Altro") {
      setCustomUnit("");
    }

    setSaveMessage("");
    setSaveError("");
  }

  function handleCertificateFileChange(file: File | null) {
    setSaveMessage("");
    setSaveError("");
    setNewCertificateFile(null);
    setRemoveCertificateFile(false);

    if (!file) return;

    if (!isAcceptedCertificateFile(file)) {
      setSaveError("Formato certificato non valido. Usa PDF, PNG, JPG o WEBP.");
      return;
    }

    if (file.size > MAX_CERTIFICATE_SIZE_BYTES) {
      setSaveError(
        "Il file certificato è troppo grande. Dimensione massima: 10 MB."
      );
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

  async function saveCurrentCertificateInHistory(input: {
    fileUrl: string | null;
    fileName: string | null;
    isCurrent: boolean;
    notes: string | null;
  }) {
    if (
      !certificateNumber.trim() &&
      !certificateDate &&
      !certificateExpiry &&
      !input.fileUrl
    ) {
      return;
    }

    const { error } = await supabase
      .from("reference_instrument_certificates")
      .insert({
        reference_instrument_id: instrument.id,
        certificate_number: certificateNumber.trim() || null,
        certificate_date: certificateDate || null,
        certificate_expiry: certificateExpiry || null,
        file_url: input.fileUrl,
        file_name: input.fileName,
        is_current: input.isCurrent,
        notes: input.notes,
      });

    if (error) {
      throw new Error(
        error.message ||
          "Errore durante il salvataggio dello storico certificati."
      );
    }
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

      if (unit === "Altro" && !customUnit.trim()) {
        throw new Error("Inserisci l’unità di misura personalizzata.");
      }

      let nextCertificateFileUrl = certificateFileUrl || null;
      let nextCertificateFileName = certificateFileName || null;

      const certificateIsBeingChanged = Boolean(newCertificateFile);
      const certificateIsBeingRemoved = Boolean(removeCertificateFile);

      if (certificateIsBeingChanged || certificateIsBeingRemoved) {
        await supabase
          .from("reference_instrument_certificates")
          .update({ is_current: false })
          .eq("reference_instrument_id", instrument.id);

        await saveCurrentCertificateInHistory({
          fileUrl: instrument.certificate_file_url ?? null,
          fileName: instrument.certificate_file_name ?? null,
          isCurrent: false,
          notes: certificateIsBeingChanged
            ? "Certificato precedente sostituito."
            : "Certificato rimosso dallo strumento.",
        });
      }

      if (certificateIsBeingRemoved) {
        nextCertificateFileUrl = null;
        nextCertificateFileName = null;
      }

      if (newCertificateFile) {
        nextCertificateFileUrl = await uploadCertificate(
          instrument.id,
          newCertificateFile
        );
        nextCertificateFileName = newCertificateFile.name;

        await saveCurrentCertificateInHistory({
          fileUrl: nextCertificateFileUrl,
          fileName: nextCertificateFileName,
          isCurrent: true,
          notes: "Certificato attualmente valido.",
        });
      } else if (!certificateIsBeingRemoved) {
        const hasCurrentHistory = certificateHistory.some(
          (certificate) => certificate.is_current
        );

        if (
          !hasCurrentHistory &&
          (certificateNumber.trim() ||
            certificateDate ||
            certificateExpiry ||
            nextCertificateFileUrl)
        ) {
          await supabase
            .from("reference_instrument_certificates")
            .update({ is_current: false })
            .eq("reference_instrument_id", instrument.id);

          await saveCurrentCertificateInHistory({
            fileUrl: nextCertificateFileUrl,
            fileName: nextCertificateFileName,
            isCurrent: true,
            notes: "Certificato attualmente valido.",
          });
        }
      }

      const statusToSave =
        status === "dismissed" || status === "out_of_service"
          ? status
          : "valid";

      const { error } = await supabase
        .from("reference_instruments")
        .update({
          name: name.trim(),
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          serial_number: serialNumber.trim() || null,
          internal_code: internalCode.trim() || null,
          measurement_quantity: measurementQuantity.trim() || null,
          unit: effectiveUnit || null,
          measurement_range: measurementRange.trim() || null,
          resolution: null,
          certificate_number: certificateNumber.trim() || null,
          certificate_date: certificateDate || null,
          certificate_expiry: certificateExpiry || null,
          certificate_file_url: nextCertificateFileUrl,
          certificate_file_name: nextCertificateFileName,
          status: statusToSave,
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
              <option value="valid">Operativo</option>
              <option value="out_of_service">Fuori servizio</option>
              <option value="dismissed">Dismesso</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Codice interno
            </span>
            <input
              value={internalCode}
              onChange={(event) => setInternalCode(event.target.value)}
              placeholder="Codice interno"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Costruttore
            </span>
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
        </div>

        <div
          className={
            "mt-5 rounded-xl border p-4 text-sm " +
            statusClass(effectiveStatus)
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

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Grandezza misurata
            </span>
            <select
              value={measurementQuantity}
              onChange={(event) =>
                handleMeasurementQuantityChange(event.target.value)
              }
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
              value={unit}
              onChange={(event) => handleUnitChange(event.target.value)}
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

          {unit === "Altro" && (
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Unità personalizzata
              </span>
              <input
                value={customUnit}
                onChange={(event) => setCustomUnit(event.target.value)}
                placeholder="Inserisci unità"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Fondo scala
            </span>
            <input
              value={measurementRange}
              onChange={(event) => setMeasurementRange(event.target.value)}
              placeholder="Es. 0 - 300 kN"
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
          Questa sezione contiene il certificato in corso di validità. Se carichi
          un nuovo file, il certificato precedente viene mantenuto nello storico.
        </p>

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
            File certificato attualmente valido
          </p>

          {certificateFileUrl ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">Certificato caricato</p>
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

              <div className="mt-4">
                <CertificatePreview
                  url={certificateFileUrl}
                  title="Anteprima certificato attualmente valido"
                />
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
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Nuovo file selezionato: {newCertificateFile.name}. Verrà salvato
                al click su “Salva modifiche”.
              </p>

              {newCertificatePreviewUrl && (
                <div className="mt-4">
                  <LocalCertificatePreview
                    file={newCertificateFile}
                    url={newCertificatePreviewUrl}
                  />
                </div>
              )}
            </div>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Storico certificati
        </h2>

        {historyError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Errore caricamento storico certificati: {historyError}
          </div>
        )}

        {isLoadingHistory ? (
          <p className="mt-4 text-sm text-slate-500">
            Caricamento storico certificati...
          </p>
        ) : certificateHistory.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Nessun certificato nello storico.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {certificateHistory.map((certificate) => (
              <div
                key={certificate.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {certificate.is_current
                        ? "Certificato attualmente valido"
                        : "Certificato passato"}
                    </p>
                    <p className="text-slate-600">
                      Numero: {certificate.certificate_number || "-"}
                    </p>
                    <p className="text-slate-600">
                      Data: {formatItalianDate(certificate.certificate_date)} -
                      Scadenza:{" "}
                      {formatItalianDate(certificate.certificate_expiry)}
                    </p>
                    {certificate.notes && (
                      <p className="mt-1 text-slate-500">{certificate.notes}</p>
                    )}
                  </div>

                  {certificate.file_url && (
                    <a
                      href={certificate.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-fit rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Apri certificato
                    </a>
                  )}
                </div>

                {certificate.file_url && (
                  <div className="mt-4">
                    <CertificatePreview
                      url={certificate.file_url}
                      title={
                        certificate.file_name ||
                        "Anteprima certificato storico"
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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