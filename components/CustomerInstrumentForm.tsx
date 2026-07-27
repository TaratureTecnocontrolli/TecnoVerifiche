"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  business_name: string;
};

type MeasurementOption = {
  label: string;
  quantity: string;
};

const measurementOptions: MeasurementOption[] = [
  {
    label: "Forza",
    quantity: "Forza",
  },
  {
    label: "Pressione",
    quantity: "Pressione",
  },
  {
    label: "Coppia",
    quantity: "Coppia",
  },
  {
    label: "Portata / volume",
    quantity: "Portata / volume",
  },
  {
    label: "Temperatura",
    quantity: "Temperatura",
  },
  {
    label: "Dimensionale",
    quantity: "Dimensionale",
  },
  {
    label: "Massa",
    quantity: "Massa",
  },
  {
    label: "Sclerometro / rimbalzo",
    quantity: "Sclerometro / rimbalzo",
  },
  {
    label: "Pull-off",
    quantity: "Pull-off",
  },
  {
    label: "Altro",
    quantity: "Altro",
  },
];

const unitOptions = [
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

export default function CustomerInstrumentForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [measurementQuantity, setMeasurementQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [measurementRange, setMeasurementRange] = useState("");
  const [notes, setNotes] = useState("");

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const effectiveUnit = unit === "Altro" ? customUnit.trim() : unit;

  useEffect(() => {
    async function loadData() {
      setIsLoadingCustomers(true);
      setLoadError("");

      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, business_name")
        .eq("is_active", true)
        .order("business_name", { ascending: true });

      if (customersError) {
        setLoadError(customersError.message);
        setCustomers([]);
        setIsLoadingCustomers(false);
        return;
      }

      setCustomers((customersData ?? []) as Customer[]);
      setIsLoadingCustomers(false);
    }

    loadData();
  }, []);

  async function saveInstrument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");

    try {
      if (!selectedCustomer) {
        throw new Error("Seleziona il cliente.");
      }

      if (!name.trim()) {
        throw new Error("Inserisci almeno il nome dello strumento cliente.");
      }

      if (unit === "Altro" && !customUnit.trim()) {
        throw new Error("Inserisci l’unità di misura personalizzata.");
      }

      const { error } = await supabase.from("customer_instruments").insert({
        customer_id: selectedCustomer.id,
        site_id: null,

        /*
          Lo strumento viene collegato al cliente, non al luogo prove.
          Il luogo prove viene scelto di volta in volta durante la nuova verifica.
        */
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
      });

      if (error) {
        throw new Error(error.message);
      }

      router.push("/strumenti-cliente");
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

        {loadError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Errore caricamento clienti: {loadError}
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Cliente *
            </span>
            <select
              value={selectedCustomerId}
              onChange={(event) => setSelectedCustomerId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">
                {isLoadingCustomers
                  ? "Caricamento clienti..."
                  : "Seleziona cliente"}
              </option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
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
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Nome strumento *
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Es. Pressa, bilancia, manometro..."
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
            <span className="text-sm font-medium text-slate-700">
              Matricola
            </span>
            <input
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="Matricola"
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
              Grandezza
            </span>
            <select
              value={measurementQuantity}
              onChange={(event) => setMeasurementQuantity(event.target.value)}
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
              onChange={(event) => {
                setUnit(event.target.value);
                if (event.target.value !== "Altro") {
                  setCustomUnit("");
                }
              }}
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
              placeholder="Es. 0 - 1000 kN"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Note operative, limiti, condizioni particolari..."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {saveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {saveError}
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
          {isSaving ? "Salvataggio..." : "Salva strumento"}
        </button>
      </div>
    </form>
  );
}