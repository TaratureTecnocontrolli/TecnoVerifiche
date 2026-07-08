"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CustomerForm() {
  const router = useRouter();

  const [customerNumber, setCustomerNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [siteName, setSiteName] = useState("Sede principale");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteCity, setSiteCity] = useState("");
  const [siteProvince, setSiteProvince] = useState("");
  const [sitePostalCode, setSitePostalCode] = useState("");
  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");

    try {
      if (!businessName.trim()) {
        throw new Error("Inserisci almeno la ragione sociale del cliente.");
      }

      if (!siteName.trim()) {
        throw new Error("Inserisci almeno il nome della sede.");
      }

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
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
          is_active: true,
        })
        .select("id")
        .single();

      if (customerError || !customer) {
        if (
          customerError?.message?.toLowerCase().includes("duplicate") ||
          customerError?.code === "23505"
        ) {
          throw new Error(
            "Numero cliente già presente. Inserisci un numero cliente diverso."
          );
        }

        throw new Error(
          customerError?.message || "Errore durante il salvataggio del cliente."
        );
      }

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
        is_active: true,
      });

      if (siteError) {
        throw new Error(
          siteError.message ||
            "Cliente creato, ma errore durante il salvataggio della sede."
        );
      }

      router.push("/clienti");
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
        <h2 className="text-lg font-semibold text-slate-900">
          Dati cliente
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Numero cliente
            </span>
            <input
              value={customerNumber}
              onChange={(event) => setCustomerNumber(event.target.value)}
              placeholder="Es. C001 / 1001"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Ragione sociale *
            </span>
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Es. Cliente S.r.l."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Partita IVA
            </span>
            <input
              value={vatNumber}
              onChange={(event) => setVatNumber(event.target.value)}
              placeholder="Partita IVA"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Codice fiscale
            </span>
            <input
              value={taxCode}
              onChange={(event) => setTaxCode(event.target.value)}
              placeholder="Codice fiscale"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Indirizzo
            </span>
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
            <span className="text-sm font-medium text-slate-700">
              Provincia
            </span>
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
        <h2 className="text-lg font-semibold text-slate-900">
          Contatti
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Referente
            </span>
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
            <span className="text-sm font-medium text-slate-700">
              Telefono
            </span>
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
        <h2 className="text-lg font-semibold text-slate-900">
          Prima sede operativa
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Ogni cliente deve avere almeno una sede. Potrà essere modificata o
          ampliata più avanti.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Nome sede *
            </span>
            <input
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              placeholder="Sede principale"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Indirizzo sede
            </span>
            <input
              value={siteAddress}
              onChange={(event) => setSiteAddress(event.target.value)}
              placeholder="Se vuoto, usa l’indirizzo del cliente"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Città sede
            </span>
            <input
              value={siteCity}
              onChange={(event) => setSiteCity(event.target.value)}
              placeholder="Se vuoto, usa la città del cliente"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Provincia sede
            </span>
            <input
              value={siteProvince}
              onChange={(event) => setSiteProvince(event.target.value)}
              placeholder="BO"
              maxLength={2}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              CAP sede
            </span>
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
          {isSaving ? "Salvataggio..." : "Salva cliente"}
        </button>
      </div>
    </form>
  );
}
