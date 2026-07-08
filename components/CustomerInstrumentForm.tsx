"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  business_name: string;
};

type CustomerSite = {
  id: string;
  customer_id: string;
  name: string;
  city: string | null;
  province: string | null;
};

export default function CustomerInstrumentForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");

  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [measurementQuantity, setMeasurementQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [measurementRange, setMeasurementRange] = useState("");
  const [resolution, setResolution] = useState("");
  const [acceptanceClass, setAcceptanceClass] = useState("");
  const [notes, setNotes] = useState("");

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const filteredSites = useMemo(() => {
    return sites.filter((site) => site.customer_id === selectedCustomerId);
  }, [sites, selectedCustomerId]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  const selectedSite = sites.find((site) => site.id === selectedSiteId);

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
        setSites([]);
        setIsLoadingCustomers(false);
        return;
      }

      const { data: sitesData, error: sitesError } = await supabase
        .from("customer_sites")
        .select("id, customer_id, name, city, province")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (sitesError) {
        setLoadError(sitesError.message);
        setCustomers((customersData ?? []) as Customer[]);
        setSites([]);
        setIsLoadingCustomers(false);
        return;
      }

      setCustomers((customersData ?? []) as Customer[]);
      setSites((sitesData ?? []) as CustomerSite[]);
      setIsLoadingCustomers(false);
    }

    loadData();
  }, []);

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    setSelectedSiteId("");
  }

  async function saveInstrument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");

    try {
      if (!selectedCustomer) {
        throw new Error("Seleziona il cliente.");
      }

      if (!selectedSite) {
        throw new Error("Seleziona la sede del cliente.");
      }

      if (!name.trim()) {
        throw new Error("Inserisci almeno il nome dello strumento cliente.");
      }

      const siteLabel = [
        selectedSite.name,
        selectedSite.city,
        selectedSite.province,
      ]
        .filter(Boolean)
        .join(" - ");

      const { error } = await supabase.from("customer_instruments").insert({
        customer_id: selectedCustomer.id,
        site_id: selectedSite.id,

        /*
          Manteniamo ancora questi due campi testuali per compatibilità
          con le pagine già create. Più avanti, quando tutto userà le relazioni,
          potremo anche non considerarli più.
        */
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
        <h2 className="text-lg font-semibold text-slate-900">
          Cliente e sede
        </h2>

        {loadError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Errore caricamento clienti/sedi: {loadError}
          </div>
        )}

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
              <option value="">
                {isLoadingCustomers ? "Caricamento clienti..." : "Seleziona cliente"}
              </option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.business_name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Sede *
            </span>
            <select
              value={selectedSiteId}
              onChange={(event) => setSelectedSiteId(event.target.value)}
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
                  {site.city ? ` - ${site.city}` : ""}
                  {site.province ? ` (${site.province})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedCustomer && selectedSite && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <strong>Cliente selezionato:</strong>{" "}
              {selectedCustomer.business_name}
            </p>
            <p>
              <strong>Sede selezionata:</strong> {selectedSite.name}
              {selectedSite.city ? ` - ${selectedSite.city}` : ""}
              {selectedSite.province ? ` (${selectedSite.province})` : ""}
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

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Codice interno cliente
            </span>
            <input
              value={internalCode}
              onChange={(event) => setInternalCode(event.target.value)}
              placeholder="Codice interno"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Caratteristiche metrologiche
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Grandezza
            </span>
            <input
              value={measurementQuantity}
              onChange={(event) => setMeasurementQuantity(event.target.value)}
              placeholder="Es. Forza"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Unità</span>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="Es. kN"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Campo di misura
            </span>
            <input
              value={measurementRange}
              onChange={(event) => setMeasurementRange(event.target.value)}
              placeholder="Es. 0 - 1000 kN"
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
              placeholder="Es. 0,01 kN"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Classe / tolleranza
            </span>
            <input
              value={acceptanceClass}
              onChange={(event) => setAcceptanceClass(event.target.value)}
              placeholder="Es. Classe 1 / ±1%"
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