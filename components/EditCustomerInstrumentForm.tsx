"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
  sites: CustomerSite[];
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

export default function EditCustomerInstrumentForm({
  instrument,
  customers,
  sites,
}: EditCustomerInstrumentFormProps) {
  const router = useRouter();

  const [selectedCustomerId, setSelectedCustomerId] = useState(
    valueOrEmpty(instrument.customer_id)
  );
  const [selectedSiteId, setSelectedSiteId] = useState(
    valueOrEmpty(instrument.site_id)
  );

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
  const [unit, setUnit] = useState(valueOrEmpty(instrument.unit));
  const [measurementRange, setMeasurementRange] = useState(
    valueOrEmpty(instrument.measurement_range)
  );
  const [resolution, setResolution] = useState(
    valueOrEmpty(instrument.resolution)
  );
  const [acceptanceClass, setAcceptanceClass] = useState(
    valueOrEmpty(instrument.acceptance_class)
  );
  const [notes, setNotes] = useState(valueOrEmpty(instrument.notes));

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const filteredSites = useMemo(() => {
    return sites.filter((site) => site.customer_id === selectedCustomerId);
  }, [sites, selectedCustomerId]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  const selectedSite = sites.find((site) => site.id === selectedSiteId);

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    setSelectedSiteId("");
    setSaveMessage("");
    setSaveError("");
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

      if (!selectedSite) {
        throw new Error("Seleziona la sede del cliente.");
      }

      if (!name.trim()) {
        throw new Error("Inserisci il nome dello strumento.");
      }

      const siteLabel = [
        selectedSite.name,
        selectedSite.city,
        selectedSite.province ? "(" + selectedSite.province + ")" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const { error } = await supabase
        .from("customer_instruments")
        .update({
          customer_id: selectedCustomer.id,
          site_id: selectedSite.id,
          customer_name: selectedCustomer.business_name,
          site: siteLabel || selectedSite.name,
          name: name.trim(),
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          serial_number: serialNumber.trim() || null,
          internal_code: internalCode.trim() || null,
          measurement_quantity: measurementQuantity.trim() || null,
          unit: unit.trim() || null,
          measurement_range: measurementRange.trim() || null,
          resolution: resolution.trim() || null,
          acceptance_class: acceptanceClass.trim() || null,
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
        <h2 className="text-lg font-semibold text-slate-900">
          Cliente e sede
        </h2>

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

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Sede *</span>
            <select
              value={selectedSiteId}
              onChange={(event) => {
                setSelectedSiteId(event.target.value);
                setSaveMessage("");
                setSaveError("");
              }}
              disabled={!selectedCustomerId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">
                {!selectedCustomerId
                  ? "Seleziona prima il cliente"
                  : "Seleziona sede"}
              </option>

              {filteredSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                  {site.city ? " - " + site.city : ""}
                  {site.province ? " (" + site.province + ")" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
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
              onChange={(event) => setName(event.target.value)}
              placeholder="Es. Pressa, manometro, cella di carico..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Codice interno
            </span>
            <input
              value={internalCode}
              onChange={(event) => setInternalCode(event.target.value)}
              placeholder="Codice interno cliente"
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
              placeholder="Matricola / serial number"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Grandezza misurata
            </span>
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

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Risoluzione
            </span>
            <input
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="Es. 0,1 bar"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Classe / tolleranza
            </span>
            <input
              value={acceptanceClass}
              onChange={(event) => setAcceptanceClass(event.target.value)}
              placeholder="Es. classe 1 / tolleranza interna"
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
