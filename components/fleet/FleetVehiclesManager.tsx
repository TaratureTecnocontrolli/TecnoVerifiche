"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEADLINE_CLASSES,
  FUEL_TYPE_LABELS,
  LOG_TYPE_LABELS,
  type Technician,
  type Vehicle,
  type VehicleLog,
  type VehicleStatus,
  type VehicleType,
  VEHICLE_STATUS_CLASSES,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  fetchTechnicians,
  fetchVehicles,
  formatDate,
  vehicleDeadlines,
  vehicleWorstDeadline,
} from "@/lib/fleet";

const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

const PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#4b5563",
];

type VehicleForm = {
  plate: string;
  brand: string;
  model: string;
  vehicle_type: VehicleType;
  fuel_type: string;
  registration_year: string;
  seats: string;
  current_km: string;
  status: VehicleStatus;
  default_driver_id: string;
  insurance_expiry: string;
  inspection_expiry: string;
  road_tax_expiry: string;
  next_service_date: string;
  next_service_km: string;
  color: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: VehicleForm = {
  plate: "",
  brand: "",
  model: "",
  vehicle_type: "van",
  fuel_type: "diesel",
  registration_year: "",
  seats: "",
  current_km: "",
  status: "available",
  default_driver_id: "",
  insurance_expiry: "",
  inspection_expiry: "",
  road_tax_expiry: "",
  next_service_date: "",
  next_service_km: "",
  color: PALETTE[0],
  notes: "",
  is_active: true,
};

function toForm(vehicle: Vehicle): VehicleForm {
  return {
    plate: vehicle.plate,
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    vehicle_type: vehicle.vehicle_type,
    fuel_type: vehicle.fuel_type ?? "",
    registration_year: vehicle.registration_year?.toString() ?? "",
    seats: vehicle.seats?.toString() ?? "",
    current_km: vehicle.current_km?.toString() ?? "",
    status: vehicle.status,
    default_driver_id: vehicle.default_driver_id ?? "",
    insurance_expiry: vehicle.insurance_expiry ?? "",
    inspection_expiry: vehicle.inspection_expiry ?? "",
    road_tax_expiry: vehicle.road_tax_expiry ?? "",
    next_service_date: vehicle.next_service_date ?? "",
    next_service_km: vehicle.next_service_km?.toString() ?? "",
    color: vehicle.color || PALETTE[0],
    notes: vehicle.notes ?? "",
    is_active: vehicle.is_active,
  };
}

function toInt(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value.replace(/\./g, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function FleetVehiclesManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [logsVehicle, setLogsVehicle] = useState<Vehicle | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [v, t] = await Promise.all([fetchVehicles(), fetchTechnicians()]);
      setVehicles(v);
      setTechnicians(t);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Errore nel caricamento della flotta."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale dati
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      if (!showInactive && !vehicle.is_active) return false;
      if (!term) return true;
      return [vehicle.plate, vehicle.brand, vehicle.model]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });
  }, [vehicles, search, showInactive]);

  const activeVehicles = vehicles.filter((v) => v.is_active);
  const stats = {
    total: activeVehicles.length,
    available: activeVehicles.filter((v) => v.status === "available").length,
    maintenance: activeVehicles.filter((v) => v.status === "maintenance").length,
    expired: activeVehicles.filter((v) => vehicleWorstDeadline(v) === "expired").length,
    warning: activeVehicles.filter((v) => vehicleWorstDeadline(v) === "warning").length,
  };

  const technicianName = (id: string | null) =>
    technicians.find((t) => t.id === id)?.full_name ?? "-";

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Errore nel caricamento: {loadError}
          <p className="mt-1 text-xs">
            Se le tabelle non esistono ancora, esegui su Supabase lo script
            <code className="mx-1 rounded bg-white px-1">
              supabase/migrations/20261107_flotta_cantieri.sql
            </code>
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Mezzi attivi", value: stats.total, tone: "text-slate-900" },
          { label: "Disponibili", value: stats.available, tone: "text-emerald-700" },
          { label: "In manutenzione", value: stats.maintenance, tone: "text-amber-700" },
          { label: "Scadenze entro 30 gg", value: stats.warning, tone: "text-amber-700" },
          { label: "Scadenze superate", value: stats.expired, tone: "text-red-700" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Parco mezzi</h2>
            <p className="text-sm text-slate-500">
              {filtered.length} mezzi visualizzati
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca targa, marca, modello…"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Mostra dismessi
            </label>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Nuovo mezzo
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nessun mezzo registrato.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Targa</th>
                  <th className="px-4 py-3">Mezzo</th>
                  <th className="px-4 py-3">Stato</th>
                  <th className="px-4 py-3">Km</th>
                  <th className="px-4 py-3">Autista abituale</th>
                  <th className="px-4 py-3">Scadenze</th>
                  <th className="px-4 py-3">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className={`hover:bg-slate-50 ${vehicle.is_active ? "" : "opacity-60"}`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-sm font-bold tracking-wider text-slate-900"
                        style={{ borderLeft: `6px solid ${vehicle.color}` }}
                      >
                        {vehicle.plate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-semibold text-slate-900">
                        {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {VEHICLE_TYPE_LABELS[vehicle.vehicle_type]}
                        {vehicle.fuel_type
                          ? ` · ${FUEL_TYPE_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}`
                          : ""}
                        {vehicle.seats ? ` · ${vehicle.seats} posti` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                          VEHICLE_STATUS_CLASSES[vehicle.status]
                        }`}
                      >
                        {vehicle.is_active
                          ? VEHICLE_STATUS_LABELS[vehicle.status]
                          : "Dismesso"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {vehicle.current_km !== null
                        ? vehicle.current_km.toLocaleString("it-IT")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {technicianName(vehicle.default_driver_id)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {vehicleDeadlines(vehicle).map((deadline) => (
                          <span
                            key={deadline.key}
                            className={`rounded-lg border px-2 py-0.5 text-[11px] ${
                              DEADLINE_CLASSES[deadline.level]
                            }`}
                          >
                            <span className="font-semibold">{deadline.label}:</span>{" "}
                            {deadline.detail}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(vehicle)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogsVehicle(vehicle)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Registro
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <VehicleFormDialog
          vehicle={editing === "new" ? null : editing}
          technicians={technicians}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {logsVehicle && (
        <VehicleLogsDialog
          vehicle={logsVehicle}
          onClose={() => setLogsVehicle(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

function VehicleFormDialog({
  vehicle,
  technicians,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle | null;
  technicians: Technician[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<VehicleForm>(vehicle ? toForm(vehicle) : emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof VehicleForm>(field: K, value: VehicleForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plate = form.plate.trim().toUpperCase().replace(/\s+/g, "");
    if (!plate) {
      setError("Inserisci la targa (o un codice identificativo) del mezzo.");
      return;
    }

    setIsSaving(true);
    const payload = {
      plate,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      vehicle_type: form.vehicle_type,
      fuel_type: form.fuel_type || null,
      registration_year: toInt(form.registration_year),
      seats: toInt(form.seats),
      current_km: toInt(form.current_km),
      status: form.status,
      default_driver_id: form.default_driver_id || null,
      insurance_expiry: form.insurance_expiry || null,
      inspection_expiry: form.inspection_expiry || null,
      road_tax_expiry: form.road_tax_expiry || null,
      next_service_date: form.next_service_date || null,
      next_service_km: toInt(form.next_service_km),
      color: form.color,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };

    const { error: saveError } = vehicle
      ? await supabase.from("fleet_vehicles").update(payload).eq("id", vehicle.id)
      : await supabase.from("fleet_vehicles").insert(payload);

    setIsSaving(false);

    if (saveError) {
      setError(
        saveError.code === "23505"
          ? "Esiste già un mezzo con questa targa."
          : saveError.message
      );
      return;
    }

    onSaved();
  }

  async function remove() {
    if (!vehicle) return;
    if (
      !window.confirm(
        `Eliminare definitivamente il mezzo ${vehicle.plate}? Verranno rimosse anche le sue assegnazioni alle attività. Per conservare lo storico, disattivalo invece di eliminarlo.`
      )
    )
      return;
    setIsSaving(true);
    const { error: deleteError } = await supabase
      .from("fleet_vehicles")
      .delete()
      .eq("id", vehicle.id);
    setIsSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog onClose={onClose}>
      <form
        onSubmit={save}
        className="w-full max-w-4xl space-y-5 rounded-3xl bg-slate-50 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-bold text-slate-950">
            {vehicle ? `Modifica mezzo ${vehicle.plate}` : "Nuovo mezzo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Dati mezzo</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Targa / codice*</span>
              <input
                value={form.plate}
                onChange={(e) => update("plate", e.target.value)}
                placeholder="AB123CD"
                className={`${inputClass} font-mono uppercase`}
                autoFocus
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Marca</span>
              <input
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Modello</span>
              <input
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tipologia</span>
              <select
                value={form.vehicle_type}
                onChange={(e) => update("vehicle_type", e.target.value as VehicleType)}
                className={inputClass}
              >
                {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Alimentazione</span>
              <select
                value={form.fuel_type}
                onChange={(e) => update("fuel_type", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Anno</span>
                <input
                  inputMode="numeric"
                  value={form.registration_year}
                  onChange={(e) => update("registration_year", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Posti</span>
                <input
                  inputMode="numeric"
                  value={form.seats}
                  onChange={(e) => update("seats", e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Stato</span>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as VehicleStatus)}
                className={inputClass}
              >
                {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Autista abituale</span>
              <select
                value={form.default_driver_id}
                onChange={(e) => update("default_driver_id", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {technicians
                  .filter((t) => t.is_active || t.id === form.default_driver_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Km attuali</span>
              <input
                inputMode="numeric"
                value={form.current_km}
                onChange={(e) => update("current_km", e.target.value)}
                className={inputClass}
              />
            </label>
            <div className="space-y-1 md:col-span-3">
              <span className="text-sm font-medium text-slate-700">
                Colore nel calendario
              </span>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => update("color", color)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      form.color === color ? "border-slate-900" : "border-white"
                    } shadow`}
                    style={{ backgroundColor: color }}
                    aria-label={`Colore ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Scadenze</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {(
              [
                ["insurance_expiry", "Assicurazione"],
                ["inspection_expiry", "Revisione"],
                ["road_tax_expiry", "Bollo"],
                ["next_service_date", "Prossimo tagliando"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="space-y-1">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <input
                  type="date"
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  className={inputClass}
                />
              </label>
            ))}
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tagliando a km</span>
              <input
                inputMode="numeric"
                value={form.next_service_km}
                onChange={(e) => update("next_service_km", e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Note</span>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update("is_active", e.target.checked)}
            />
            Mezzo attivo in flotta (deseleziona se venduto / dismesso)
          </label>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <div>
            {vehicle && (
              <button
                type="button"
                onClick={remove}
                disabled={isSaving}
                className="rounded-xl border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Elimina mezzo
              </button>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Salvataggio…" : "Salva mezzo"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function VehicleLogsDialog({
  vehicle,
  onClose,
  onChanged,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logType, setLogType] = useState("service");
  const [km, setKm] = useState("");
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");
  const [updateKm, setUpdateKm] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    const { data, error: loadError } = await supabase
      .from("fleet_vehicle_logs")
      .select("id, vehicle_id, log_date, log_type, km, cost, description")
      .eq("vehicle_id", vehicle.id)
      .order("log_date", { ascending: false });
    if (loadError) setError(loadError.message);
    setLogs((data ?? []) as VehicleLog[]);
    setIsLoading(false);
  }, [vehicle.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale dati
    loadLogs();
  }, [loadLogs]);

  const totalCost = logs.reduce((sum, log) => sum + (Number(log.cost) || 0), 0);

  async function addLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const kmValue = toInt(km);
    const costValue = cost.trim() ? Number(cost.replace(",", ".")) : null;
    if (costValue !== null && Number.isNaN(costValue)) {
      setError("Importo non valido.");
      return;
    }

    setIsSaving(true);
    const { error: insertError } = await supabase.from("fleet_vehicle_logs").insert({
      vehicle_id: vehicle.id,
      log_date: logDate,
      log_type: logType,
      km: kmValue,
      cost: costValue,
      description: description.trim() || null,
    });

    if (!insertError && updateKm && kmValue !== null && kmValue > (vehicle.current_km ?? 0)) {
      await supabase.from("fleet_vehicles").update({ current_km: kmValue }).eq("id", vehicle.id);
      onChanged();
    }

    setIsSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setKm("");
    setCost("");
    setDescription("");
    loadLogs();
  }

  async function removeLog(id: string) {
    if (!window.confirm("Eliminare questa registrazione?")) return;
    const { error: deleteError } = await supabase
      .from("fleet_vehicle_logs")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    loadLogs();
  }

  return (
    <Dialog onClose={onClose}>
      <div className="w-full max-w-4xl space-y-5 rounded-3xl bg-slate-50 p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Registro interventi
            </p>
            <h2 className="text-2xl font-bold text-slate-950">
              {vehicle.plate}{" "}
              <span className="text-base font-medium text-slate-500">
                {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={addLog}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-6"
        >
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-700">Data</span>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-700">Tipo</span>
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value)}
              className={inputClass}
            >
              {Object.entries(LOG_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-700">Km</span>
            <input
              inputMode="numeric"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-700">Costo €</span>
            <input
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-700">Descrizione</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-4">
            <input
              type="checkbox"
              checked={updateKm}
              onChange={(e) => setUpdateKm(e.target.checked)}
            />
            Aggiorna i km attuali del mezzo se superiori (attuali:{" "}
            {vehicle.current_km?.toLocaleString("it-IT") ?? "n.d."})
          </label>
          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {isSaving ? "Salvataggio…" : "Aggiungi"}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm">
            <span className="font-semibold text-slate-900">{logs.length} registrazioni</span>
            <span className="text-slate-600">
              Totale costi:{" "}
              <strong>
                {totalCost.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </strong>
            </span>
          </div>
          {isLoading ? (
            <p className="p-5 text-sm text-slate-500">Caricamento…</p>
          ) : logs.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nessuna registrazione.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Km</th>
                  <th className="px-4 py-2">Costo</th>
                  <th className="px-4 py-2">Descrizione</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2">{formatDate(log.log_date)}</td>
                    <td className="px-4 py-2">{LOG_TYPE_LABELS[log.log_type] ?? log.log_type}</td>
                    <td className="px-4 py-2">{log.km?.toLocaleString("it-IT") ?? "-"}</td>
                    <td className="px-4 py-2">
                      {log.cost !== null
                        ? Number(log.cost).toLocaleString("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          })
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{log.description ?? "-"}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLog(log.id)}
                        className="text-xs font-semibold text-red-700 hover:underline"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Dialog>
  );
}
