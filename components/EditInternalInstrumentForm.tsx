"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InternalInstrumentInitialData = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  location: string | null;
  department: string | null;
  status: string;
  notes: string | null;
  is_active: boolean;
};

type EditInternalInstrumentFormProps = {
  instrument: InternalInstrumentInitialData;
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


function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

export default function EditInternalInstrumentForm({
  instrument,
}: EditInternalInstrumentFormProps) {
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
  const [location, setLocation] = useState(valueOrEmpty(instrument.location));
  const [department, setDepartment] = useState(valueOrEmpty(instrument.department));
  const [status, setStatus] = useState(instrument.status || "active");
  const [notes, setNotes] = useState(valueOrEmpty(instrument.notes));

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const effectiveUnit = unit === "Altro" ? customUnit.trim() : unit;

  function resetSaveState() {
    setSaveError("");
    setSaveMessage("");
  }

  function handleUnitChange(value: string) {
    setUnit(value);

    if (value !== "Altro") {
      setCustomUnit("");
    }

    resetSaveState();
  }

  async function saveInstrument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      if (!name.trim()) {
        throw new Error("Inserisci il nome dello strumento interno.");
      }

      if (unit === "Altro" && !customUnit.trim()) {
        throw new Error("Inserisci l’unità di misura personalizzata.");
      }

      const { error } = await supabase
        .from("internal_instruments")
        .update({
          name: name.trim(),
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          serial_number: serialNumber.trim() || null,
          internal_code: internalCode.trim() || null,
          measurement_quantity: measurementQuantity.trim() || null,
          unit: effectiveUnit || null,
          measurement_range: measurementRange.trim() || null,
          location: location.trim() || null,
          department: department.trim() || null,
          status,
          notes: notes.trim() || null,
          is_active: status !== "dismissed",
        })
        .eq("id", instrument.id);

      if (error) {
        throw new Error(error.message || "Errore durante il salvataggio.");
      }

      setSaveMessage("Strumento interno aggiornato correttamente.");
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
          Dati strumento interno
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Nome strumento *
            </span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Stato</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Attivo</option>
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
              onChange={(event) => {
                setInternalCode(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Costruttore
            </span>
            <input
              value={manufacturer}
              onChange={(event) => {
                setManufacturer(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Modello</span>
            <input
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Matricola
            </span>
            <input
              value={serialNumber}
              onChange={(event) => {
                setSerialNumber(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Reparto / settore
            </span>
            <input
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Ubicazione
            </span>
            <input
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
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
              onChange={(event) => {
                setMeasurementQuantity(event.target.value);
                resetSaveState();
              }}
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
                onChange={(event) => {
                  setCustomUnit(event.target.value);
                  resetSaveState();
                }}
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
              onChange={(event) => {
                setMeasurementRange(event.target.value);
                resetSaveState();
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              resetSaveState();
            }}
            rows={3}
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
          onClick={() => router.push("/strumenti-interni")}
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