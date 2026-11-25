"use client";

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

export type InternalInstrumentInitialData = {
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
  initialMeasurements: InternalInstrumentMeasurement[];
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

export default function EditInternalInstrumentForm({
  instrument,
  initialMeasurements,
}: EditInternalInstrumentFormProps) {
  const router = useRouter();

  const [name, setName] = useState(instrument.name);
  const [manufacturer, setManufacturer] = useState(valueOrEmpty(instrument.manufacturer));
  const [model, setModel] = useState(valueOrEmpty(instrument.model));
  const [serialNumber, setSerialNumber] = useState(valueOrEmpty(instrument.serial_number));
  const [internalCode, setInternalCode] = useState(valueOrEmpty(instrument.internal_code));
  const [location, setLocation] = useState(valueOrEmpty(instrument.location));
  const [department, setDepartment] = useState(valueOrEmpty(instrument.department));
  const [status, setStatus] = useState(instrument.status || "active");
  const [notes, setNotes] = useState(valueOrEmpty(instrument.notes));
  const [measurements, setMeasurements] = useState<InternalInstrumentMeasurement[]>(
    initialMeasurements.length > 0
      ? initialMeasurements
      : [
          {
            ...emptyInternalMeasurement(1),
            measurement_quantity: valueOrEmpty(instrument.measurement_quantity),
            unit: valueOrEmpty(instrument.unit),
            measurement_range: valueOrEmpty(instrument.measurement_range),
          },
        ]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  function resetSaveState() {
    setSaveError("");
    setSaveMessage("");
  }

  async function saveInstrument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      if (!name.trim()) throw new Error("Inserisci il nome dello strumento interno.");

      const normalizedMeasurements = normalizeInternalMeasurements(measurements);
      if (normalizedMeasurements.length === 0) {
        throw new Error("Inserisci almeno una grandezza misurata.");
      }

      const primary =
        normalizedMeasurements.find((row) => row.is_primary) ?? normalizedMeasurements[0];

      const { error: updateError } = await supabase
        .from("internal_instruments")
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", instrument.id);

      if (updateError) throw new Error(updateError.message || "Errore durante il salvataggio.");

      const { error: measurementsError } = await supabase.rpc(
        "replace_internal_instrument_measurements",
        {
          p_internal_instrument_id: instrument.id,
          p_measurements: measurementRowsForRpc(normalizedMeasurements),
        }
      );

      if (measurementsError) {
        throw new Error("Errore aggiornamento grandezze: " + measurementsError.message);
      }

      setMeasurements(normalizedMeasurements);
      setSaveMessage("Strumento interno e grandezze aggiornati correttamente.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Errore imprevisto durante il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={saveInstrument} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Dati strumento interno</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 lg:col-span-2"><span className="text-sm font-medium text-slate-700">Nome strumento *</span><input value={name} onChange={(e) => { setName(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Stato</span><select value={status} onChange={(e) => { setStatus(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="active">Attivo</option><option value="out_of_service">Fuori servizio</option><option value="dismissed">Dismesso</option></select></label>
          <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Codice interno</span><input value={internalCode} onChange={(e) => { setInternalCode(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Costruttore</span><input value={manufacturer} onChange={(e) => { setManufacturer(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Modello</span><input value={model} onChange={(e) => { setModel(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Matricola</span><input value={serialNumber} onChange={(e) => { setSerialNumber(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Reparto / settore</span><input value={department} onChange={(e) => { setDepartment(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Ubicazione</span><input value={location} onChange={(e) => { setLocation(e.target.value); resetSaveState(); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
        </div>
      </section>

      <InternalInstrumentMeasurementsEditor measurements={measurements} onChange={(rows) => { setMeasurements(rows); resetSaveState(); }} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block space-y-1"><span className="text-sm font-medium text-slate-700">Note generali</span><textarea value={notes} onChange={(e) => { setNotes(e.target.value); resetSaveState(); }} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
      </section>

      {saveError && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">{saveError}</div>}
      {saveMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-900">{saveMessage}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/strumenti-interni")} className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annulla</button>
        <button type="submit" disabled={isSaving} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">{isSaving ? "Salvataggio..." : "Salva modifiche"}</button>
      </div>
    </form>
  );
}
