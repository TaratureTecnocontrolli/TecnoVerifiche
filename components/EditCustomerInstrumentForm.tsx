"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  customer_number: string | null;
  business_name: string;
};

type CustomerSite = {
  id: string;
  customer_id: string;
  name: string;
  city: string | null;
  province: string | null;
};

type CustomerInstrumentInitialData = {
  id: string;
  customer_id: string | null;
  site_id: string | null;
  customer_name: string | null;
  site: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  measurement_quantity: string | null;
  unit: string | null;
  measurement_range: string | null;
  resolution: string | null;
  acceptance_class: string | null;
  notes: string | null;
};

type EditCustomerInstrumentFormProps = {
  instrument: CustomerInstrumentInitialData;
  customers: Customer[];
  sites?: CustomerSite[];
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

export default function EditCustomerInstrumentForm({
  instrument,
  customers,
}: EditCustomerInstrumentFormProps) {
  const router = useRouter();

  const initialUnit = valueOrEmpty(instrument.unit);
  const initialUnitIsListed = initialUnit === "" || unitOptions.includes(initialUnit);

  const [selectedCustomerId, setSelectedCustomerId] = useState(
    valueOrEmpty(instrument.customer_id)
  );

  const [name, setName] = useState(instrument.name);
  const [manufacturer, setManufacturer] = useState(
    valueOrEmpty(instrument.manufacturer)
  );
  const [model, setModel] = useState(valueOrEmpty(instrument.model));
  const [serialNumber, setSerialNumber] = useState(
    valueOrEmpty(instrument.serial_number)
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
  const [notes, setNotes] = useState(valueOrEmpty(instrument.notes));

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const effectiveUnit = unit === "Altro" ? customUnit.trim() : unit;

  function resetSaveState() {
    setSaveMessage("");
    setSaveError("");
  }

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    resetSaveState();
  }

  function handleMeasurementQuantityChange(value: string) {
    setMeasurementQuantity(value);
    resetSaveState();
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
      if (!selectedCustomer) {
        throw new Error("Seleziona il cliente.");
      }

      if (!name.trim()) {
        throw new Error("Inserisci il nome dello strumento.");
      }

      if (unit === "Altro" && !customUnit.trim()) {
        throw new Error("Inserisci l’unità di misura personalizzata.");
      }

      const { error } = await supabase
        .from("customer_instruments")
        .update({
          customer_id: selectedCustomer.id,

          /*
            Lo strumento cliente resta collegato al cliente.
            Il luogo prove viene scelto in fase di creazione della verifica.
          */
          site_id: null,
          customer_name: selectedCustomer.business_name,
          site: null,

          name: name.trim(),
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          serial_number: serialNumber.trim() || null,
          internal_code: null,
          measurement_quantity: measurementQuantity.trim() || null,
          unit: effectiveUnit || null,
          measurement_range: measurementRange.trim() || null,
          resolution: null,
          acceptance_class: null,
          notes: notes.trim() || null,
        })
        .eq("id", instrument.id);

      if (error) {
        throw new Error(
          error.message || "Errore durante l’aggiornamento dello strumento."
        );
      }

      setSaveMessage("Strumento cliente aggiornato correttamente.");
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
        <h2 className="text-lg font-semibold text-slate-900">Cliente</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Cliente *
            </span>
            <select
              value={selectedCustomerId}
              onChange={(event) => handleCustomerChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleziona cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_number
                    ? customer.customer_number + " - "
                    : ""}
                  {customer.business_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedCustomer && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <strong>Cliente selezionato:</strong>{" "}
              {selectedCustomer.customer_number
                ? selectedCustomer.customer_number + " - "
                : ""}
              {selectedCustomer.business_name}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati strumento
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
              placeholder="Es. Pressa, manometro, cella di carico..."
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
              placeholder="Costruttore"
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
              placeholder="Modello"
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
              placeholder="Matricola / serial number"
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
                onChange={(event) => {
                  setCustomUnit(event.target.value);
                  resetSaveState();
                }}
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
              onChange={(event) => {
                setMeasurementRange(event.target.value);
                resetSaveState();
              }}
              placeholder="Es. 0 - 300 kN"
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
            placeholder="Note sullo strumento"
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
          onClick={() => router.push("/strumenti-cliente")}
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