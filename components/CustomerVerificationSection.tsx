"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type VerificationCustomerSite = {
  id: string;
  customer_id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
};

type CustomerOption = {
  id: string;
  customer_number?: string | null;
  business_name?: string | null;
  name?: string | null;
};

type CustomerInstrumentOption = {
  id: string;
  customer_id?: string | null;
  site_id?: string | null;
  site?: string | null;
  name?: string | null;
  description?: string | null;
  instrument_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  range?: string | null;
  resolution?: string | null;
};

type CustomerVerificationSectionProps = {
  customers: CustomerOption[];
  customerInstruments: CustomerInstrumentOption[];
  selectedCustomerId: string;
  selectedSiteId: string;
  selectedInstrumentId: string;
  onCustomerChange: (customerId: string) => void;
  onSiteChange: (siteId: string, site: VerificationCustomerSite | null) => void;
  onInstrumentChange: (instrumentId: string) => void;
};

export function getVerificationCustomerName(customer: CustomerOption | null | undefined) {
  return customer?.business_name || customer?.name || "Cliente senza nome";
}

export function getVerificationInstrumentName(
  instrument: CustomerInstrumentOption | null | undefined
) {
  return (
    instrument?.name ||
    instrument?.instrument_name ||
    instrument?.description ||
    "Strumento senza nome"
  );
}

export function getVerificationInstrumentRange(
  instrument: CustomerInstrumentOption | null | undefined
) {
  return instrument?.measurement_range || instrument?.range || null;
}

export function buildVerificationSiteDescription(
  site: VerificationCustomerSite | null | undefined
) {
  if (!site) {
    return "";
  }

  return [
    site.name,
    site.address,
    site.postal_code,
    site.city,
    site.province ? "(" + site.province + ")" : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function buildSiteOptionLabel(site: VerificationCustomerSite) {
  return [
    site.name,
    site.address,
    site.city,
    site.province ? "(" + site.province + ")" : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

export default function CustomerVerificationSection({
  customers,
  customerInstruments,
  selectedCustomerId,
  selectedSiteId,
  selectedInstrumentId,
  onCustomerChange,
  onSiteChange,
  onInstrumentChange,
}: CustomerVerificationSectionProps) {
  const [sites, setSites] = useState<VerificationCustomerSite[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [siteLoadError, setSiteLoadError] = useState("");
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [newSiteProvince, setNewSiteProvince] = useState("");
  const [newSitePostalCode, setNewSitePostalCode] = useState("");
  const [siteSaveError, setSiteSaveError] = useState("");

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredCustomerInstruments = useMemo(() => {
    if (!selectedCustomerId) {
      return [];
    }

    return customerInstruments.filter(
      (instrument) => instrument.customer_id === selectedCustomerId
    );
  }, [customerInstruments, selectedCustomerId]);

  const selectedInstrument = useMemo(
    () =>
      customerInstruments.find((instrument) => instrument.id === selectedInstrumentId) ??
      null,
    [customerInstruments, selectedInstrumentId]
  );

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSites() {
      setSiteLoadError("");

      if (!selectedCustomerId) {
        setSites([]);
        return;
      }

      setIsLoadingSites(true);

      const { data, error } = await supabase
        .from("customer_sites")
        .select("id, customer_id, name, address, city, province, postal_code")
        .eq("customer_id", selectedCustomerId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (cancelled) {
        return;
      }

      setIsLoadingSites(false);

      if (error) {
        setSites([]);
        setSiteLoadError(error.message);
        return;
      }

      const loadedSites = (data ?? []) as VerificationCustomerSite[];
      setSites(loadedSites);

      if (selectedSiteId) {
        const currentSite = loadedSites.find((site) => site.id === selectedSiteId) ?? null;
        onSiteChange(currentSite?.id ?? "", currentSite);
      }
    }

    loadSites();

    return () => {
      cancelled = true;
    };
    // La selezione del cliente è l'unico evento che deve ricaricare l'elenco sedi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);

  function handleCustomerChange(customerId: string) {
    setIsAddingSite(false);
    setSiteSaveError("");
    setSiteLoadError("");
    onCustomerChange(customerId);
    onSiteChange("", null);
    onInstrumentChange("");
  }

  function handleSiteChange(siteId: string) {
    const site = sites.find((item) => item.id === siteId) ?? null;
    onSiteChange(siteId, site);
  }

  async function saveNewSite() {
    setSiteSaveError("");

    if (!selectedCustomerId) {
      setSiteSaveError("Seleziona prima il cliente.");
      return;
    }

    if (!newSiteName.trim()) {
      setSiteSaveError("Inserisci almeno il nome del luogo prove.");
      return;
    }

    const { data: createdSite, error } = await supabase
      .from("customer_sites")
      .insert({
        customer_id: selectedCustomerId,
        name: newSiteName.trim(),
        address: newSiteAddress.trim() || null,
        city: newSiteCity.trim() || null,
        province: newSiteProvince.trim().toUpperCase() || null,
        postal_code: newSitePostalCode.trim() || null,
        is_active: true,
      })
      .select("id, customer_id, name, address, city, province, postal_code")
      .single();

    if (error || !createdSite) {
      setSiteSaveError(
        error?.message || "Errore durante il salvataggio del luogo prove."
      );
      return;
    }

    const site = createdSite as VerificationCustomerSite;
    setSites((current) => [...current, site]);
    onSiteChange(site.id, site);
    setNewSiteName("");
    setNewSiteAddress("");
    setNewSiteCity("");
    setNewSiteProvince("");
    setNewSitePostalCode("");
    setIsAddingSite(false);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Strumento cliente verificato
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Cliente *</span>
          <select
            value={selectedCustomerId}
            onChange={(event) => handleCustomerChange(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Seleziona cliente</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_number ? customer.customer_number + " - " : ""}
                {getVerificationCustomerName(customer)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Luogo prove *</span>
          <select
            value={selectedSiteId}
            onChange={(event) => handleSiteChange(event.target.value)}
            disabled={!selectedCustomerId || isLoadingSites}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">
              {!selectedCustomerId
                ? "Seleziona prima il cliente"
                : isLoadingSites
                  ? "Caricamento luoghi prove..."
                  : "Seleziona luogo prove"}
            </option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {buildSiteOptionLabel(site)}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2 md:col-span-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!selectedCustomerId}
              onClick={() => {
                setIsAddingSite((current) => !current);
                setSiteSaveError("");
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isAddingSite ? "Chiudi nuovo luogo" : "Aggiungi nuovo luogo prove"}
            </button>

            {selectedCustomerId && !isLoadingSites && sites.length === 0 && !siteLoadError && (
              <span className="text-sm text-amber-700">
                Nessun luogo prove salvato per questo cliente. Aggiungine uno.
              </span>
            )}
          </div>

          {siteLoadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              Errore caricamento luoghi prove: {siteLoadError}
            </div>
          )}

          {isAddingSite && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Nome luogo *</span>
                  <input
                    value={newSiteName}
                    onChange={(event) => setNewSiteName(event.target.value)}
                    placeholder="Es. Sede principale / Cantiere"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Indirizzo</span>
                  <input
                    value={newSiteAddress}
                    onChange={(event) => setNewSiteAddress(event.target.value)}
                    placeholder="Via / località"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">CAP</span>
                  <input
                    value={newSitePostalCode}
                    onChange={(event) => setNewSitePostalCode(event.target.value)}
                    placeholder="CAP"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Città</span>
                  <input
                    value={newSiteCity}
                    onChange={(event) => setNewSiteCity(event.target.value)}
                    placeholder="Città"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Provincia</span>
                  <input
                    value={newSiteProvince}
                    onChange={(event) => setNewSiteProvince(event.target.value)}
                    placeholder="BO"
                    maxLength={2}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </label>
              </div>

              {siteSaveError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  {siteSaveError}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={saveNewSite}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Salva luogo prove
                </button>
              </div>
            </div>
          )}
        </div>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Strumento *</span>
          <select
            value={selectedInstrumentId}
            onChange={(event) => onInstrumentChange(event.target.value)}
            disabled={!selectedCustomerId}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">
              {!selectedCustomerId ? "Seleziona prima il cliente" : "Seleziona strumento"}
            </option>
            {filteredCustomerInstruments.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                {instrument.internal_code ? instrument.internal_code + " - " : ""}
                {getVerificationInstrumentName(instrument)}
                {instrument.model ? " - " + instrument.model : ""}
                {instrument.serial_number ? " - Matr. " + instrument.serial_number : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedCustomer && selectedSite && filteredCustomerInstruments.length === 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Per questo cliente non risultano strumenti cliente registrati. Vai in “Strumenti
          cliente” e aggiungi l’attrezzatura prima di creare la verifica.
        </div>
      )}

      {selectedInstrument && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-semibold">Cliente</p>
              <p>
                {selectedCustomer?.customer_number
                  ? selectedCustomer.customer_number + " - "
                  : ""}
                {selectedCustomer ? getVerificationCustomerName(selectedCustomer) : "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold">Luogo prove</p>
              <p>{buildVerificationSiteDescription(selectedSite) || "-"}</p>
            </div>
            <div>
              <p className="font-semibold">Strumento</p>
              <p>{getVerificationInstrumentName(selectedInstrument)}</p>
            </div>
            <div>
              <p className="font-semibold">Costruttore / modello</p>
              <p>
                {[selectedInstrument.manufacturer, selectedInstrument.model]
                  .filter(Boolean)
                  .join(" - ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold">Matricola</p>
              <p>{selectedInstrument.serial_number ?? "-"}</p>
            </div>
            <div>
              <p className="font-semibold">Grandezza / unità</p>
              <p>
                {[
                  selectedInstrument.measurement_quantity,
                  selectedInstrument.unit,
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold">Fondo scala</p>
              <p>{getVerificationInstrumentRange(selectedInstrument) ?? "-"}</p>
            </div>
            <div>
              <p className="font-semibold">Risoluzione</p>
              <p>{selectedInstrument.resolution ?? "-"}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
