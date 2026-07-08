"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type CustomerInitialData = {
  id: string;
  customer_number: string | null;
  business_name: string;
  vat_number: string | null;
  tax_code: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  notes: string | null;
  is_active: boolean;
};

type CustomerSiteInitialData = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type EditCustomerFormProps = {
  customer: CustomerInitialData;
  mainSite: CustomerSiteInitialData | null;
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

export default function EditCustomerForm({
  customer,
  mainSite,
}: EditCustomerFormProps) {
  const router = useRouter();

  const [customerNumber, setCustomerNumber] = useState(
    valueOrEmpty(customer.customer_number)
  );
  const [businessName, setBusinessName] = useState(customer.business_name);
  const [vatNumber, setVatNumber] = useState(valueOrEmpty(customer.vat_number));
  const [taxCode, setTaxCode] = useState(valueOrEmpty(customer.tax_code));
  const [address, setAddress] = useState(valueOrEmpty(customer.address));
  const [city, setCity] = useState(valueOrEmpty(customer.city));
  const [province, setProvince] = useState(valueOrEmpty(customer.province));
  const [postalCode, setPostalCode] = useState(valueOrEmpty(customer.postal_code));
  const [email, setEmail] = useState(valueOrEmpty(customer.email));
  const [phone, setPhone] = useState(valueOrEmpty(customer.phone));
  const [contactPerson, setContactPerson] = useState(valueOrEmpty(customer.contact_person));
  const [isActive, setIsActive] = useState(customer.is_active);
  const [notes, setNotes] = useState(valueOrEmpty(customer.notes));

  const [siteName, setSiteName] = useState(valueOrEmpty(mainSite?.name) || "Sede principale");
  const [siteAddress, setSiteAddress] = useState(valueOrEmpty(mainSite?.address));
  const [siteCity, setSiteCity] = useState(valueOrEmpty(mainSite?.city));
  const [siteProvince, setSiteProvince] = useState(valueOrEmpty(mainSite?.province));
  const [sitePostalCode, setSitePostalCode] = useState(valueOrEmpty(mainSite?.postal_code));
  const [siteIsActive, setSiteIsActive] = useState(mainSite?.is_active ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      if (!businessName.trim()) {
        throw new Error("Inserisci almeno la ragione sociale del cliente.");
      }

      if (!siteName.trim()) {
        throw new Error("Inserisci almeno il nome della sede principale.");
      }

      const { error: customerError } = await supabase
        .from("customers")
        .update({
          customer_number: customerNumber.trim() || null,
          business_name: businessName.trim(),
          vat_number: vatNumber.trim() || null,
          tax_code: taxCode.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          province: province.trim() || null,
          postal_code: postalCode.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          contact_person: contactPerson.trim() || null,
          notes: notes.trim() || null,
          is_active: isActive,
        })
        .eq("id", customer.id);

      if (customerError) {
        if (
          customerError.code === "23505" ||
          customerError.message.toLowerCase().includes("duplicate")
        ) {
          throw new Error("Numero cliente già presente. Inserisci un numero cliente diverso.");
        }

        throw new Error(customerError.message || "Errore durante l’aggiornamento del cliente.");
      }

      if (mainSite) {
        const { error: siteError } = await supabase
          .from("customer_sites")
          .update({
            name: siteName.trim(),
            address: siteAddress.trim() || address.trim() || null,
            city: siteCity.trim() || city.trim() || null,
            province: siteProvince.trim() || province.trim() || null,
            postal_code: sitePostalCode.trim() || postalCode.trim() || null,
            contact_person: contactPerson.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            is_active: siteIsActive,
          })
          .eq("id", mainSite.id);

        if (siteError) {
          throw new Error(siteError.message || "Cliente aggiornato, ma errore durante l’aggiornamento della sede.");
        }
      } else {
        const { error: siteError } = await supabase.from("customer_sites").insert({
          customer_id: customer.id,
          name: siteName.trim(),
          address: siteAddress.trim() || address.trim() || null,
          city: siteCity.trim() || city.trim() || null,
          province: siteProvince.trim() || province.trim() || null,
          postal_code: sitePostalCode.trim() || postalCode.trim() || null,
          contact_person: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          is_active: siteIsActive,
        });

        if (siteError) {
          throw new Error(siteError.message || "Cliente aggiornato, ma errore durante la creazione della sede principale.");
        }
      }

      setSaveMessage("Cliente aggiornato correttamente.");
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
    <form onSubmit={saveCustomer} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dati cliente</h2>
            <p className="mt-1 text-sm text-slate-500">
              Modifica anagrafica, numero cliente e stato del cliente.
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4"
            />
            Cliente attivo
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Numero cliente</span>
            <input
              value={customerNumber}
              onChange={(event) => setCustomerNumber(event.target.value)}
              placeholder="Es. C001 / 1001"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Ragione sociale *</span>
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Es. Cliente S.r.l."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Partita IVA</span>
            <input
              value={vatNumber}
              onChange={(event) => setVatNumber(event.target.value)}
              placeholder="Partita IVA"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Codice fiscale</span>
            <input
              value={taxCode}
              onChange={(event) => setTaxCode(event.target.value)}
              placeholder="Codice fiscale"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Indirizzo</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Indirizzo sede legale"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">CAP</span>
            <input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              placeholder="CAP"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Città</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Città"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Provincia</span>
            <input
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              placeholder="BO"
              maxLength={2}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Contatti</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Referente</span>
            <input
              value={contactPerson}
              onChange={(event) => setContactPerson(event.target.value)}
              placeholder="Nome referente"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@cliente.it"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Telefono</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Telefono"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sede principale</h2>
            <p className="mt-1 text-sm text-slate-500">
              Se il cliente ha più sedi, qui viene modificata la prima sede registrata.
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={siteIsActive}
              onChange={(event) => setSiteIsActive(event.target.checked)}
              className="h-4 w-4"
            />
            Sede attiva
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Nome sede *</span>
            <input
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              placeholder="Sede principale"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Indirizzo sede</span>
            <input
              value={siteAddress}
              onChange={(event) => setSiteAddress(event.target.value)}
              placeholder="Se vuoto, usa l’indirizzo del cliente"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Città sede</span>
            <input
              value={siteCity}
              onChange={(event) => setSiteCity(event.target.value)}
              placeholder="Se vuoto, usa la città del cliente"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Provincia sede</span>
            <input
              value={siteProvince}
              onChange={(event) => setSiteProvince(event.target.value)}
              placeholder="BO"
              maxLength={2}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">CAP sede</span>
            <input
              value={sitePostalCode}
              onChange={(event) => setSitePostalCode(event.target.value)}
              placeholder="Se vuoto, usa il CAP del cliente"
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
            placeholder="Note cliente"
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
          onClick={() => router.push("/clienti")}
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
