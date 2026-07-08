"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Technician = {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  signature_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TechnicianFormState = {
  fullName: string;
  role: string;
  email: string;
  signatureUrl: string;
  isActive: boolean;
};

type ReportSettings = {
  id: boolean;
  default_director_technician_id: string | null;
  updated_at: string;
};

const emptyForm: TechnicianFormState = {
  fullName: "",
  role: "",
  email: "",
  signatureUrl: "",
  isActive: true,
};

const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024;

function getFileExtension(file: File) {
  const parts = file.name.split(".");
  const extension = parts[parts.length - 1]?.toLowerCase();

  if (!extension) {
    if (file.type === "image/png") return "png";
    if (file.type === "image/jpeg") return "jpg";
    if (file.type === "image/webp") return "webp";

    return "png";
  }

  return extension;
}

function isAcceptedSignatureFile(file: File) {
  return ["image/png", "image/jpeg", "image/webp"].includes(file.type);
}

function formatItalianDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  if (!email.trim()) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function TechnicianSignaturesManager() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [form, setForm] = useState<TechnicianFormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [defaultDirectorTechnicianId, setDefaultDirectorTechnicianId] =
    useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const activeTechnicians = useMemo(() => {
    return technicians.filter((technician) => technician.is_active);
  }, [technicians]);

  const inactiveTechnicians = useMemo(() => {
    return technicians.filter((technician) => !technician.is_active);
  }, [technicians]);

  const activeTechniciansWithoutSignature = useMemo(() => {
    return activeTechnicians.filter((technician) => !technician.signature_url);
  }, [activeTechnicians]);

  const selectedDirector = useMemo(() => {
    return technicians.find(
      (technician) => technician.id === defaultDirectorTechnicianId
    );
  }, [technicians, defaultDirectorTechnicianId]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    setLoadError("");

    await Promise.all([loadTechnicians(), loadReportSettings()]);

    setIsLoading(false);
  }

  async function loadTechnicians() {
    const { data, error } = await supabase
      .from("calibration_technicians")
      .select(
        `
        id,
        full_name,
        role,
        email,
        signature_url,
        is_active,
        created_at,
        updated_at
      `
      )
      .order("full_name", { ascending: true });

    if (error) {
      setLoadError(error.message);
      return;
    }

    setTechnicians((data ?? []) as Technician[]);
  }

  async function loadReportSettings() {
    const { data, error } = await supabase
      .from("calibration_report_settings")
      .select(
        `
        id,
        default_director_technician_id,
        updated_at
      `
      )
      .eq("id", true)
      .maybeSingle();

    if (error) {
      setLoadError(error.message);
      return;
    }

    const settings = data as ReportSettings | null;

    setDefaultDirectorTechnicianId(
      settings?.default_director_technician_id ?? ""
    );
  }

  function updateForm(field: keyof TechnicianFormState, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setSaveMessage("");
    setSaveError("");
  }

  function resetForm() {
    setForm(emptyForm);
    setSelectedFile(null);
    setEditingId(null);
    setSaveError("");
    setSaveMessage("");
  }

  function startEdit(technician: Technician) {
    setEditingId(technician.id);
    setSelectedFile(null);
    setSaveError("");
    setSaveMessage("");

    setForm({
      fullName: technician.full_name ?? "",
      role: technician.role ?? "",
      email: technician.email ?? "",
      signatureUrl: technician.signature_url ?? "",
      isActive: technician.is_active,
    });
  }

  function handleSignatureFileChange(file: File | null) {
    setSelectedFile(null);
    setSaveMessage("");
    setSaveError("");

    if (!file) {
      return;
    }

    if (!isAcceptedSignatureFile(file)) {
      setSaveError("Formato firma non valido. Usa PNG, JPG o WEBP.");
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE_BYTES) {
      setSaveError("Il file firma è troppo grande. Dimensione massima: 2 MB.");
      return;
    }

    setSelectedFile(file);
  }

  async function uploadSignature(technicianId: string, file: File) {
    setIsUploading(true);

    try {
      const extension = getFileExtension(file);
      const safeFileName = `${technicianId}-${Date.now()}.${extension}`;
      const storagePath = `technicians/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("technician-signatures")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage
        .from("technician-signatures")
        .getPublicUrl(storagePath);

      return data.publicUrl;
    } finally {
      setIsUploading(false);
    }
  }

  async function saveTechnician() {
    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const fullName = form.fullName.trim();
      const email = normalizeEmail(form.email);

      if (!fullName) {
        throw new Error("Inserisci il nome e cognome del tecnico.");
      }

      if (!isValidEmail(email)) {
        throw new Error("L’indirizzo email inserito non è valido.");
      }

      const duplicateName = technicians.find((technician) => {
        return (
          technician.full_name.trim().toLowerCase() === fullName.toLowerCase() &&
          technician.id !== editingId
        );
      });

      if (duplicateName) {
        throw new Error(
          "Esiste già un tecnico con lo stesso nome. Controlla l’elenco prima di creare un duplicato."
        );
      }

      let technicianId = editingId;
      let signatureUrl = form.signatureUrl.trim() || null;

      if (editingId) {
        const { error: updateError } = await supabase
          .from("calibration_technicians")
          .update({
            full_name: fullName,
            role: form.role.trim() || null,
            email: email || null,
            signature_url: signatureUrl,
            is_active: form.isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        const { data: insertedTechnician, error: insertError } = await supabase
          .from("calibration_technicians")
          .insert({
            full_name: fullName,
            role: form.role.trim() || null,
            email: email || null,
            signature_url: signatureUrl,
            is_active: form.isActive,
          })
          .select("id")
          .single();

        if (insertError || !insertedTechnician) {
          throw new Error(
            insertError?.message || "Errore durante la creazione del tecnico."
          );
        }

        technicianId = insertedTechnician.id;
      }

      if (!technicianId) {
        throw new Error("Tecnico non trovato dopo il salvataggio.");
      }

      if (selectedFile) {
        signatureUrl = await uploadSignature(technicianId, selectedFile);

        const { error: signatureUpdateError } = await supabase
          .from("calibration_technicians")
          .update({
            signature_url: signatureUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", technicianId);

        if (signatureUpdateError) {
          throw new Error(signatureUpdateError.message);
        }
      }

      if (
        editingId &&
        !form.isActive &&
        defaultDirectorTechnicianId === editingId
      ) {
        setDefaultDirectorTechnicianId("");

        await supabase.from("calibration_report_settings").upsert(
          {
            id: true,
            default_director_technician_id: null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );
      }

      setSaveMessage(
        editingId
          ? "Tecnico aggiornato correttamente."
          : "Tecnico creato correttamente."
      );

      resetForm();
      await loadTechnicians();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il salvataggio.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  }

  async function saveDirectorSettings() {
    setIsSavingSettings(true);
    setSettingsMessage("");
    setSettingsError("");

    try {
      const director = technicians.find(
        (technician) => technician.id === defaultDirectorTechnicianId
      );

      if (defaultDirectorTechnicianId && !director) {
        throw new Error("Il direttore selezionato non è stato trovato.");
      }

      if (director && !director.is_active) {
        throw new Error(
          "Il direttore selezionato è disattivato. Riattivalo oppure scegli un altro tecnico."
        );
      }

      if (director && !director.signature_url) {
        throw new Error(
          "Il direttore selezionato non ha una firma caricata. Carica la firma prima di salvarlo come direttore predefinito."
        );
      }

      const { error } = await supabase
        .from("calibration_report_settings")
        .upsert(
          {
            id: true,
            default_director_technician_id:
              defaultDirectorTechnicianId || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );

      if (error) {
        throw new Error(error.message);
      }

      setSettingsMessage(
        defaultDirectorTechnicianId
          ? "Direttore di laboratorio predefinito aggiornato correttamente."
          : "Direttore di laboratorio predefinito rimosso."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio delle impostazioni.";

      setSettingsError(message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function toggleTechnicianActive(technician: Technician) {
    setSaveError("");
    setSaveMessage("");

    if (
      technician.is_active &&
      defaultDirectorTechnicianId === technician.id
    ) {
      const confirmed = window.confirm(
        "Questo tecnico è impostato come Direttore di Laboratorio. Disattivandolo verrà rimosso anche come direttore predefinito. Vuoi continuare?"
      );

      if (!confirmed) {
        return;
      }
    }

    const { error } = await supabase
      .from("calibration_technicians")
      .update({
        is_active: !technician.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", technician.id);

    if (error) {
      setSaveError(error.message);
      return;
    }

    if (
      technician.is_active &&
      defaultDirectorTechnicianId === technician.id
    ) {
      setDefaultDirectorTechnicianId("");

      await supabase.from("calibration_report_settings").upsert(
        {
          id: true,
          default_director_technician_id: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );
    }

    setSaveMessage(
      technician.is_active
        ? "Tecnico disattivato correttamente."
        : "Tecnico riattivato correttamente."
    );

    await loadTechnicians();
  }

  async function removeSignature() {
    setForm((current) => ({
      ...current,
      signatureUrl: "",
    }));

    setSelectedFile(null);
    setSaveMessage("");
    setSaveError("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            {editingId ? "Modifica tecnico" : "Nuovo tecnico"}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Carica preferibilmente una firma in PNG con sfondo trasparente
            oppure una scansione pulita in JPG/PNG.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Nome e cognome *
              </span>
              <input
                value={form.fullName}
                onChange={(event) => updateForm("fullName", event.target.value)}
                placeholder="Es. Mario Rossi"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Ruolo</span>
              <input
                value={form.role}
                onChange={(event) => updateForm("role", event.target.value)}
                placeholder="Es. Tecnico addetto alle prove"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                placeholder="nome@azienda.it"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  updateForm("isActive", event.target.checked)
                }
                className="h-4 w-4"
              />
              Tecnico attivo e selezionabile nei rapporti
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Firma tecnico
              </span>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  handleSignatureFileChange(file);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />

              <span className="block text-xs text-slate-500">
                Formati ammessi: PNG, JPG, WEBP. Dimensione massima: 2 MB.
              </span>
            </label>

            {(selectedFile || form.signatureUrl) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  Anteprima firma
                </p>

                <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-white p-3">
                  {selectedFile ? (
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Anteprima firma selezionata"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : form.signatureUrl ? (
                    <img
                      src={form.signatureUrl}
                      alt="Firma tecnico"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={removeSignature}
                  className="mt-3 text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  Rimuovi firma dal modulo
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={saveTechnician}
                disabled={isSaving || isUploading}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving || isUploading
                  ? "Salvataggio..."
                  : editingId
                    ? "Aggiorna tecnico"
                    : "Crea tecnico"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving || isUploading}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  Annulla modifica
                </button>
              )}
            </div>

            {saveMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {saveMessage}
              </div>
            )}

            {saveError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {saveError}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Direttore di laboratorio
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Questo nominativo e la relativa firma verranno usati automaticamente
            in tutti i rapporti come firma del Direttore di Laboratorio.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Direttore predefinito
              </span>
              <select
                value={defaultDirectorTechnicianId}
                onChange={(event) => {
                  setDefaultDirectorTechnicianId(event.target.value);
                  setSettingsMessage("");
                  setSettingsError("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Nessun direttore selezionato</option>

                {activeTechnicians.map((technician) => (
                  <option
                    key={technician.id}
                    value={technician.id}
                    disabled={!technician.signature_url}
                  >
                    {technician.full_name}
                    {technician.role ? ` - ${technician.role}` : ""}
                    {!technician.signature_url ? " - firma mancante" : ""}
                  </option>
                ))}
              </select>
            </label>

            {selectedDirector && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {selectedDirector.full_name}
                </p>
                <p className="text-sm text-slate-600">
                  {selectedDirector.role ?? "Direttore di laboratorio"}
                </p>

                <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-white p-3">
                  {selectedDirector.signature_url ? (
                    <img
                      src={selectedDirector.signature_url}
                      alt={`Firma ${selectedDirector.full_name}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-slate-400">
                      Firma non caricata
                    </span>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={saveDirectorSettings}
              disabled={isSavingSettings}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSavingSettings
                ? "Salvataggio..."
                : "Salva direttore predefinito"}
            </button>

            {settingsMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {settingsMessage}
              </div>
            )}

            {settingsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {settingsError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {loadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore caricamento tecnici: {loadError}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tecnici attivi</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {activeTechnicians.length}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-900">
              Firme mancanti
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {activeTechniciansWithoutSignature.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tecnici disattivati</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {inactiveTechnicians.length}
            </p>
          </div>
        </section>

        {activeTechniciansWithoutSignature.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-bold">Attenzione: firme mancanti</p>
            <p className="mt-1">
              Alcuni tecnici attivi non hanno la firma caricata. Sono
              selezionabili nei rapporti solo se la logica del rapporto lo
              consente, ma per un rapporto completo conviene caricare sempre la
              firma.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Tecnici attivi
            </h2>
            <p className="text-sm text-slate-500">
              Questi nominativi saranno disponibili nella selezione firme del
              rapporto.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tecnico</th>
                  <th className="px-4 py-3">Ruolo</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Firma</th>
                  <th className="px-4 py-3">Aggiornato</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-slate-500">
                      Caricamento tecnici...
                    </td>
                  </tr>
                ) : activeTechnicians.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-slate-500">
                      Nessun tecnico attivo registrato.
                    </td>
                  </tr>
                ) : (
                  activeTechnicians.map((technician) => (
                    <tr key={technician.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {technician.full_name}
                        {technician.id === defaultDirectorTechnicianId && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            Direttore
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {technician.role ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {technician.email ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {technician.signature_url ? (
                          <div className="flex h-12 w-28 items-center justify-center rounded border border-slate-200 bg-white p-1">
                            <img
                              src={technician.signature_url}
                              alt={`Firma ${technician.full_name}`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                            Firma mancante
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatItalianDateTime(technician.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(technician)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Modifica
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleTechnicianActive(technician)}
                            className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Disattiva
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {inactiveTechnicians.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-950">
                Tecnici disattivati
              </h2>
              <p className="text-sm text-slate-500">
                Restano nello storico ma non saranno selezionabili nei nuovi
                rapporti.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tecnico</th>
                    <th className="px-4 py-3">Ruolo</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {inactiveTechnicians.map((technician) => (
                    <tr key={technician.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-500">
                        {technician.full_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {technician.role ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {technician.email ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(technician)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Modifica
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleTechnicianActive(technician)}
                            className="rounded-lg px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Riattiva
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}