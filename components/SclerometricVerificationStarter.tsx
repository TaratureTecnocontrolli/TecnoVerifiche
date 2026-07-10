"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  combineReferenceInstrumentNames,
  getSclerometricReportDefaults,
} from "@/lib/report-defaults";
import ReferenceInstrumentMultiSelect, {
  getEffectiveReferenceInstrumentStatus,
  isReferenceInstrumentBlocked,
} from "@/components/ReferenceInstrumentMultiSelect";

type Customer = {
  id: string;
  customer_number?: string | null;
  business_name?: string | null;
  name?: string | null;
};

type CustomerInstrument = {
  id: string;
  customer_id?: string | null;
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
  notes?: string | null;
};

type ReferenceInstrument = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  range?: string | null;
  resolution?: string | null;
  certificate_number?: string | null;
  certificate_expiry?: string | null;
  certificate_file_url?: string | null;
  certificate_file_name?: string | null;
  status?: string | null;
};

type SclerometricVerificationStarterProps = {
  customers: Customer[];
  customerInstruments: CustomerInstrument[];
  referenceInstruments: ReferenceInstrument[];
};

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatItalianDate(date: string | null | undefined) {
  if (!date) {
    return "-";
  }

  const parts = date.split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

function statusLabel(status: string) {
  if (status === "valid") return "Valido";
  if (status === "expiring") return "In scadenza";
  if (status === "expired") return "Scaduto";
  if (status === "out_of_service") return "Fuori servizio";

  return status;
}

function statusClass(status: string) {
  if (status === "valid") return "bg-emerald-100 text-emerald-800";
  if (status === "expiring") return "bg-amber-100 text-amber-800";
  if (status === "expired") return "bg-red-100 text-red-800";
  if (status === "out_of_service") return "bg-slate-200 text-slate-700";

  return "bg-slate-100 text-slate-700";
}

function getCustomerName(customer: Customer) {
  return customer.business_name || customer.name || "Cliente senza nome";
}

function getCustomerInstrumentName(instrument: CustomerInstrument) {
  return (
    instrument.name ||
    instrument.instrument_name ||
    instrument.description ||
    "Strumento senza nome"
  );
}

function getRange(instrument: {
  measurement_range?: string | null;
  range?: string | null;
}) {
  return instrument.measurement_range || instrument.range || null;
}

function buildCustomerInstrumentSnapshot(
  instrument: CustomerInstrument,
  customer: Customer
) {
  return {
    customer_id: customer.id,
    customer_number: customer.customer_number ?? null,
    customer_name: getCustomerName(customer),
    customer_instrument_id: instrument.id,
    instrument_name: getCustomerInstrumentName(instrument),
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    serial_number: instrument.serial_number ?? null,
    internal_code: instrument.internal_code ?? null,
    measurement_quantity: instrument.measurement_quantity ?? null,
    unit: instrument.unit ?? null,
    measurement_range: getRange(instrument),
    resolution: instrument.resolution ?? null,
    notes: instrument.notes ?? null,
  };
}

function buildReferenceInstrumentSnapshot(instrument: ReferenceInstrument) {
  return {
    id: instrument.id,
    name: instrument.name ?? null,
    manufacturer: instrument.manufacturer ?? null,
    model: instrument.model ?? null,
    serial_number: instrument.serial_number ?? null,
    internal_code: instrument.internal_code ?? null,
    measurement_quantity: instrument.measurement_quantity ?? null,
    unit: instrument.unit ?? null,
    measurement_range: getRange(instrument),
    resolution: instrument.resolution ?? null,
    certificate_number: instrument.certificate_number ?? null,
    certificate_expiry: instrument.certificate_expiry ?? null,
    certificate_file_url: instrument.certificate_file_url ?? null,
    certificate_file_name: instrument.certificate_file_name ?? null,
    status: getEffectiveReferenceInstrumentStatus(
      instrument.status,
      instrument.certificate_expiry
    ),
  };
}

function buildProcedureSnapshot() {
  return {
    code: "PROC_SCLEROMETRIC",
    name: "Procedura verifica sclerometri / prova non distruttiva a rimbalzo",
    revision: "0",
    calculation_engine_version: "sclerometric-v1",
  };
}

export default function SclerometricVerificationStarter({
  customers,
  customerInstruments,
  referenceInstruments,
}: SclerometricVerificationStarterProps) {
  const router = useRouter();

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerInstrumentId, setSelectedCustomerInstrumentId] =
    useState("");
  const [selectedReferenceInstrumentIds, setSelectedReferenceInstrumentIds] =
    useState<string[]>([]);
  const [verificationDate, setVerificationDate] = useState(todayInputDate());
  const [location, setLocation] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  const filteredCustomerInstruments = useMemo(() => {
    if (!selectedCustomerId) {
      return [];
    }

    return customerInstruments.filter(
      (instrument) => instrument.customer_id === selectedCustomerId
    );
  }, [customerInstruments, selectedCustomerId]);

  const selectedCustomerInstrument = useMemo(() => {
    return (
      customerInstruments.find(
        (instrument) => instrument.id === selectedCustomerInstrumentId
      ) ?? null
    );
  }, [customerInstruments, selectedCustomerInstrumentId]);

  const sclerometricReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) => {
      const text = [
        instrument.name,
        instrument.measurement_quantity,
        instrument.unit,
        getRange(instrument),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        text.includes("sclerometr") ||
        text.includes("incudine") ||
        text.includes("rimbalzo") ||
        text.includes("schmidt") ||
        text.includes("durezza")
      );
    });
  }, [referenceInstruments]);

  const availableReferenceInstruments =
    sclerometricReferenceInstruments.length > 0
      ? sclerometricReferenceInstruments
      : referenceInstruments;

  function toggleReferenceInstrument(instrumentId: string) {
    setSelectedReferenceInstrumentIds((current) =>
      current.includes(instrumentId)
        ? current.filter((id) => id !== instrumentId)
        : [...current, instrumentId]
    );
    setSaveError("");
  }

  const selectedReferenceInstruments = useMemo(() => {
    return referenceInstruments.filter((instrument) =>
      selectedReferenceInstrumentIds.includes(instrument.id)
    );
  }, [referenceInstruments, selectedReferenceInstrumentIds]);

  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(
    (instrument) =>
      isReferenceInstrumentBlocked(
        getEffectiveReferenceInstrumentStatus(
          instrument.status,
          instrument.certificate_expiry
        )
      )
  );

  async function createVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setSaveError("");

    try {
      if (!selectedCustomer) {
        throw new Error("Seleziona il cliente.");
      }

      if (!selectedCustomerInstrument) {
        throw new Error("Seleziona lo strumento cliente da verificare.");
      }

      if (selectedReferenceInstruments.length === 0) {
        throw new Error(
          "Seleziona almeno un'incudine di riferimento da utilizzare."
        );
      }

      if (hasBlockedReferenceInstrument) {
        throw new Error(
          "Una delle incudini di riferimento selezionate è scaduta o fuori servizio. Seleziona solo campioni validi."
        );
      }

      if (!verificationDate) {
        throw new Error("Inserisci la data della verifica.");
      }

      const customerSnapshot = buildCustomerInstrumentSnapshot(
        selectedCustomerInstrument,
        selectedCustomer
      );

      const referenceSnapshots = selectedReferenceInstruments.map(
        buildReferenceInstrumentSnapshot
      );
      const primaryReference = selectedReferenceInstruments[0];
      const primaryReferenceSnapshot = referenceSnapshots[0];

      const procedureSnapshot = buildProcedureSnapshot();

      const { data: insertedRecord, error: insertError } = await supabase
        .from("calibration_records")
        .insert({
          record_number: null,
          mode: "sclerometro",
          verification_module: "SCLEROMETRIC",
          verification_date: verificationDate,
          operator_name: operatorName.trim() || null,
          location: location.trim() || null,
          environmental_conditions: null,
          status: "draft",
          report_status: "draft",
          final_result: null,
          notes: notes.trim() || null,
          customer_instrument_snapshot: customerSnapshot,
          reference_instrument_snapshot: primaryReferenceSnapshot,
          procedure_snapshot: procedureSnapshot,
        })
        .select("id")
        .single();

      if (insertError || !insertedRecord) {
        throw new Error(
          insertError?.message || "Errore durante la creazione della verifica."
        );
      }

      const customerName = getCustomerName(selectedCustomer);
      const instrumentName = getCustomerInstrumentName(selectedCustomerInstrument);
      const referenceName =
        selectedReferenceInstruments.length > 1
          ? combineReferenceInstrumentNames(selectedReferenceInstruments)
          : primaryReference.name || "Incudine di riferimento";

      const reportDefaults = getSclerometricReportDefaults({
        customerName,
        customerNumber: selectedCustomer.customer_number,
        instrumentName,
        instrumentManufacturer: selectedCustomerInstrument.manufacturer,
        instrumentModel: selectedCustomerInstrument.model,
        instrumentSerial: selectedCustomerInstrument.serial_number,
        instrumentRange: getRange(selectedCustomerInstrument),
        referenceName,
        referenceManufacturer:
          selectedReferenceInstruments.length === 1
            ? primaryReference.manufacturer
            : null,
        referenceModel:
          selectedReferenceInstruments.length === 1 ? primaryReference.model : null,
        referenceSerial:
          selectedReferenceInstruments.length === 1
            ? primaryReference.serial_number
            : null,
        referenceInternalCode:
          selectedReferenceInstruments.length === 1
            ? primaryReference.internal_code
            : null,
        location,
        testDate: verificationDate,
      });

      const { error: reportDetailsError } = await supabase
        .from("calibration_report_details")
        .insert({
          calibration_record_id: insertedRecord.id,
          main_report_number: null,
          technical_annex_number: null,
          acceptance_number: null,
          acceptance_date: null,
          report_date: null,
          test_date: verificationDate,
          customer_name: customerName,
          site_description: location.trim() || null,
          work_object: reportDefaults.work_object,
          requested_tests: reportDefaults.requested_tests,
          premise_text: reportDefaults.premise_text,
          scope_text: reportDefaults.scope_text,
          apparatus_description: reportDefaults.apparatus_description,
          execution_method: reportDefaults.execution_method,
          results_text: reportDefaults.results_text,
          temperature: null,
          humidity: null,
          technician_name: operatorName.trim() || null,
          reviewer_name: null,
          director_name: null,
          instrument_photo_url: null,
          notes: null,
        });

      if (reportDetailsError) {
        throw new Error(reportDetailsError.message);
      }

      const { error: scaleError } = await supabase
        .from("calibration_record_scales")
        .insert({
          calibration_record_id: insertedRecord.id,
          scale_order: 1,
          scale_name: "Prova sclerometrica",
          scale_range:
            getRange(selectedCustomerInstrument) ||
            getRange(primaryReference) ||
            null,
          reference_instrument_id: primaryReference.id,
          reference_instrument_snapshot: primaryReferenceSnapshot,
          reference_instrument_ids: selectedReferenceInstruments.map(
            (instrument) => instrument.id
          ),
          reference_instruments_snapshot: referenceSnapshots,
          notes: null,
        });

      if (scaleError) {
        throw new Error(scaleError.message);
      }

      router.push(`/verifiche/${insertedRecord.id}/misure-sclerometro`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante la creazione della verifica.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={createVerification} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dati iniziali verifica sclerometrica
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Cliente *
            </span>
            <select
              value={selectedCustomerId}
              onChange={(event) => {
                setSelectedCustomerId(event.target.value);
                setSelectedCustomerInstrumentId("");
                setSaveError("");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleziona cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_number ? customer.customer_number + " - " : ""}
                  {getCustomerName(customer)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Strumento cliente da verificare *
            </span>
            <select
              value={selectedCustomerInstrumentId}
              onChange={(event) => {
                setSelectedCustomerInstrumentId(event.target.value);
                setSaveError("");
              }}
              disabled={!selectedCustomerId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">
                {selectedCustomerId
                  ? "Seleziona strumento cliente"
                  : "Seleziona prima un cliente"}
              </option>

              {filteredCustomerInstruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.internal_code ? instrument.internal_code + " - " : ""}
                  {getCustomerInstrumentName(instrument)}
                  {instrument.model ? " - " + instrument.model : ""}
                  {instrument.serial_number
                    ? " - Matr. " + instrument.serial_number
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Data verifica *
            </span>
            <input
              type="date"
              value={verificationDate}
              onChange={(event) => setVerificationDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Luogo verifica
            </span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Laboratorio / sede verifica"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Operatore
            </span>
            <input
              value={operatorName}
              onChange={(event) => setOperatorName(event.target.value)}
              placeholder="Nome tecnico / operatore"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4">
          <ReferenceInstrumentMultiSelect
            instruments={availableReferenceInstruments}
            selectedIds={selectedReferenceInstrumentIds}
            onToggle={toggleReferenceInstrument}
            label="Incudini di riferimento usate *"
          />
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Note iniziali sulla verifica"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {selectedCustomerInstrument && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Anteprima strumento cliente
          </h2>

          <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-700">Strumento</p>
              <p className="text-slate-600">
                {getCustomerInstrumentName(selectedCustomerInstrument)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Costruttore / modello</p>
              <p className="text-slate-600">
                {[selectedCustomerInstrument.manufacturer, selectedCustomerInstrument.model]
                  .filter(Boolean)
                  .join(" - ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Matricola</p>
              <p className="text-slate-600">
                {selectedCustomerInstrument.serial_number ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Grandezza / unità</p>
              <p className="text-slate-600">
                {[selectedCustomerInstrument.measurement_quantity, selectedCustomerInstrument.unit]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Campo</p>
              <p className="text-slate-600">
                {getRange(selectedCustomerInstrument) ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Risoluzione</p>
              <p className="text-slate-600">
                {selectedCustomerInstrument.resolution ?? "-"}
              </p>
            </div>
          </div>
        </section>
      )}

      {selectedReferenceInstruments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Anteprima incudini di riferimento selezionate
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Questi snapshot verranno salvati nella verifica.
          </p>

          <div className="mt-4 space-y-4">
            {selectedReferenceInstruments.map((instrument) => {
              const status = getEffectiveReferenceInstrumentStatus(
                instrument.status,
                instrument.certificate_expiry
              );
              const blocked = isReferenceInstrumentBlocked(status);

              return (
                <div
                  key={instrument.id}
                  className="rounded-xl border border-slate-100 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <p className="font-semibold text-slate-900">
                      {instrument.name || "Incudine di riferimento"}
                    </p>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                        status
                      )}`}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-4 text-sm md:grid-cols-4">
                    <div>
                      <p className="font-semibold text-slate-700">Codice</p>
                      <p className="text-slate-600">
                        {instrument.internal_code ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Campo</p>
                      <p className="text-slate-600">
                        {getRange(instrument) ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Certificato</p>
                      <p className="text-slate-600">
                        {instrument.certificate_number ?? "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Scadenza: {formatItalianDate(instrument.certificate_expiry)}
                      </p>
                    </div>
                    <div>
                      {instrument.certificate_file_url ? (
                        <a
                          href={instrument.certificate_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Apri certificato
                        </a>
                      ) : (
                        <p className="text-xs text-amber-700">
                          File certificato mancante
                        </p>
                      )}
                    </div>
                  </div>

                  {blocked && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      Questa incudine di riferimento non è utilizzabile perché
                      risulta scaduta o fuori servizio.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {saveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {saveError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/nuova-verifica")}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Annulla
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Creazione..." : "Crea verifica sclerometrica"}
        </button>
      </div>
    </form>
  );
}
