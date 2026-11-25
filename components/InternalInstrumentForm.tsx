"use client";

import LabSiteSelect from "@/components/LabSiteSelect";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import InternalInstrumentMeasurementsEditor from "@/components/InternalInstrumentMeasurementsEditor";
import {
  emptyInternalMeasurement,
  measurementRowsForRpc,
  normalizeInternalMeasurements,
  type InternalInstrumentMeasurement,
} from "@/lib/internal-instrument-measurements";

export default function InternalInstrumentForm() {
  const [labSite,setLabSite]=useState("");
  const router = useRouter();

  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [location, setLocation] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [measurements, setMeasurements] = useState<InternalInstrumentMeasurement[]>([
    emptyInternalMeasurement(1),
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function resetError() {
    setSaveError("");
  }

  async function saveInstrument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");

    let insertedId: string | null = null;

    try {
      if (!name.trim()) {
        throw new Error("Inserisci il nome dello strumento interno.");
      }

      const normalizedMeasurements = normalizeInternalMeasurements(measurements);
      if (normalizedMeasurements.length === 0) {
        throw new Error("Inserisci almeno una grandezza misurata.");
      }

      const primary =
        normalizedMeasurements.find((row) => row.is_primary) ?? normalizedMeasurements[0];

      const { data, error } = await supabase
        .from("internal_instruments")
        .insert({
          lab_site: labSite || null,
          name: name.trim(),
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          serial_number: serialNumber.trim() || null,
          internal_code: internalCode.trim() || null,
          measurement_quantity: primary.measurement_quantity || null,
          unit: primary.unit || null,
          measurement_range: primary.measurement_range || null,
          location: location.trim() || null,
          department: department.trim() || null,
          status,
          notes: notes.trim() || null,
          is_active: status !== "dismissed",
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Errore durante il salvataggio.");
      }

      insertedId = data.id;

      const { error: measurementsError } = await supabase.rpc(
        "replace_internal_instrument_measurements",
        {
          p_internal_instrument_id: data.id,
          p_measurements: measurementRowsForRpc(normalizedMeasurements),
        }
      );

      if (measurementsError) {
        throw new Error(
          "Strumento creato ma grandezze non salvate: " + measurementsError.message
        );
      }

      router.push("/strumenti-interni");
      router.refresh();
    } catch (error) {
      if (insertedId) {
        await supabase.from("internal_instruments").delete().eq("id", insertedId);
      }

      setSaveError(
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il salvataggio."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={saveInstrument} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Dati strumento interno</h2>
        <div className="mt-3 max-w-xs"><LabSiteSelect value={labSite} onChange={setLabSite} disabled={isSaving}/></div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Nome strumento *</span>
            <input value={name} onChange={(e) => { setName(e.target.value); resetError(); }} placeholder="Es. Mescolatrice, manometro interno, cella di carico..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Stato</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); resetError(); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="active">Attivo</option>
              <option value="out_of_service">Fuori servizio</option>
              <option value="dismissed">Dismesso</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Codice interno</span>
            <input value={internalCode} onChange={(e) => { setInternalCode(e.target.value); resetError(); }} placeholder="Codice interno / inventario" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Costruttore</span>
            <input value={manufacturer} onChange={(e) => { setManufacturer(e.target.value); resetError(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Modello</span>
            <input value={model} onChange={(e) => { setModel(e.target.value); resetError(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Matricola</span>
            <input value={serialNumber} onChange={(e) => { setSerialNumber(e.target.value); resetError(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Reparto / settore</span>
            <input value={department} onChange={(e) => { setDepartment(e.target.value); resetError(); }} placeholder="Es. Laboratorio, geotecnica..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Ubicazione</span>
            <input value={location} onChange={(e) => { setLocation(e.target.value); resetError(); }} placeholder="Es. Calderara, laboratorio..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
      </section>

      <InternalInstrumentMeasurementsEditor
        measurements={measurements}
        onChange={(rows) => { setMeasurements(rows); resetError(); }}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note generali</span>
          <textarea value={notes} onChange={(e) => { setNotes(e.target.value); resetError(); }} rows={3} placeholder="Note operative, limiti, condizioni particolari..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </section>

      {saveError && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">{saveError}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/strumenti-interni")} className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annulla</button>
        <button type="submit" disabled={isSaving} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">{isSaving ? "Salvataggio..." : "Salva strumento interno"}</button>
      </div>
    </form>
  );
}
