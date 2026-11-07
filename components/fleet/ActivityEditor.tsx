"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_PRIORITY_LABELS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  type Activity,
  type ActivityPriority,
  type ActivityStatus,
  type ActivityType,
  type AssignmentIssue,
  type CustomerOption,
  type Technician,
  type Vehicle,
  VEHICLE_STATUS_CLASSES,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  deleteActivity,
  fetchActivities,
  saveActivity,
  technicianAssignmentIssues,
  toDateTimeLocal,
  vehicleAssignmentIssues,
  vehicleLabel,
} from "@/lib/fleet";

type ActivityEditorProps = {
  activity: Activity | null;
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultVehicleId?: string;
  vehicles: Vehicle[];
  technicians: Technician[];
  customers: CustomerOption[];
  onClose: () => void;
  onSaved: () => void;
};

type VehicleSelection = {
  driverId: string;
  notes: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function IssueList({ issues }: { issues: AssignmentIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {issues.map((issue, index) => (
        <li
          key={index}
          className={`text-xs ${
            issue.severity === "error" ? "text-red-700" : "text-amber-700"
          }`}
        >
          {issue.severity === "error" ? "⛔ " : "⚠️ "}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function defaultPeriod(start?: Date, end?: Date) {
  const s = start ? new Date(start) : new Date();
  if (!start) {
    s.setDate(s.getDate() + 1);
    s.setHours(8, 0, 0, 0);
  }
  const e = end ? new Date(end) : new Date(s);
  if (!end) e.setHours(17, 0, 0, 0);
  if (e <= s) e.setTime(s.getTime() + 60 * 60 * 1000);
  return { start: toDateTimeLocal(s), end: toDateTimeLocal(e) };
}

export default function ActivityEditor({
  activity,
  defaultStart,
  defaultEnd,
  defaultVehicleId,
  vehicles,
  technicians,
  customers,
  onClose,
  onSaved,
}: ActivityEditorProps) {
  const initialPeriod = defaultPeriod(defaultStart, defaultEnd);

  const [title, setTitle] = useState(activity?.title ?? "");
  const [activityType, setActivityType] = useState<ActivityType>(
    activity?.activity_type ?? "site"
  );
  const [status, setStatus] = useState<ActivityStatus>(
    activity?.status ?? "planned"
  );
  const [priority, setPriority] = useState<ActivityPriority>(
    activity?.priority ?? "normal"
  );
  const [customerId, setCustomerId] = useState(activity?.customer_id ?? "");
  const [siteId, setSiteId] = useState(activity?.customer_site_id ?? "");
  const [location, setLocation] = useState(activity?.location ?? "");
  const [startAt, setStartAt] = useState(
    activity ? toDateTimeLocal(activity.start_at) : initialPeriod.start
  );
  const [endAt, setEndAt] = useState(
    activity ? toDateTimeLocal(activity.end_at) : initialPeriod.end
  );
  const [description, setDescription] = useState(activity?.description ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");

  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>(
    activity?.field_activity_technicians.map((t) => t.technician_id) ?? []
  );
  const [leadTechnicianId, setLeadTechnicianId] = useState(
    activity?.field_activity_technicians.find((t) => t.is_lead)
      ?.technician_id ?? ""
  );
  const [selectedVehicles, setSelectedVehicles] = useState<
    Record<string, VehicleSelection>
  >(() => {
    const initial: Record<string, VehicleSelection> = {};
    for (const v of activity?.field_activity_vehicles ?? []) {
      initial[v.vehicle_id] = { driverId: v.driver_id ?? "", notes: v.notes ?? "" };
    }
    if (!activity && defaultVehicleId) {
      initial[defaultVehicleId] = { driverId: "", notes: "" };
    }
    return initial;
  });

  const [otherActivities, setOtherActivities] = useState<Activity[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const startIso = useMemo(() => {
    const d = new Date(startAt);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [startAt]);

  const endIso = useMemo(() => {
    const d = new Date(endAt);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [endAt]);

  const isPeriodValid =
    startIso !== null && endIso !== null && endIso > startIso;

  // Carica le attività che si sovrappongono al periodo per verificare le disponibilità.
  useEffect(() => {
    if (!isPeriodValid || !startIso || !endIso) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsCheckingAvailability(true);
      try {
        const data = await fetchActivities(new Date(startIso), new Date(endIso));
        if (!cancelled) setOtherActivities(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Errore nel controllo disponibilità."
          );
        }
      } finally {
        if (!cancelled) setIsCheckingAvailability(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [startIso, endIso, isPeriodValid]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const sites = selectedCustomer?.customer_sites ?? [];

  const vehicleIssues = useMemo(() => {
    const result: Record<string, AssignmentIssue[]> = {};
    if (!isPeriodValid || !startIso || !endIso) return result;
    for (const vehicle of vehicles) {
      result[vehicle.id] = vehicleAssignmentIssues(
        vehicle,
        otherActivities,
        startIso,
        endIso,
        activity?.id
      );
    }
    return result;
  }, [vehicles, otherActivities, startIso, endIso, isPeriodValid, activity?.id]);

  const technicianIssues = useMemo(() => {
    const result: Record<string, AssignmentIssue[]> = {};
    if (!isPeriodValid || !startIso || !endIso) return result;
    for (const technician of technicians) {
      result[technician.id] = technicianAssignmentIssues(
        technician.id,
        otherActivities,
        startIso,
        endIso,
        activity?.id
      );
    }
    return result;
  }, [technicians, otherActivities, startIso, endIso, isPeriodValid, activity?.id]);

  const visibleVehicles = vehicles.filter(
    (v) => v.is_active || selectedVehicles[v.id]
  );
  const visibleTechnicians = technicians.filter(
    (t) => t.is_active || selectedTechnicians.includes(t.id)
  );

  const blockingVehicleIssues = Object.keys(selectedVehicles).flatMap((id) =>
    (vehicleIssues[id] ?? [])
      .filter((issue) => issue.severity === "error")
      .map((issue) => ({
        vehicle: vehicles.find((v) => v.id === id),
        issue,
      }))
  );

  const ignoresConflicts = status === "cancelled" || status === "completed";

  function toggleTechnician(id: string) {
    if (!selectedTechnicians.includes(id)) {
      setSelectedTechnicians([...selectedTechnicians, id]);
      return;
    }

    setSelectedTechnicians(selectedTechnicians.filter((t) => t !== id));
    if (leadTechnicianId === id) setLeadTechnicianId("");
    setSelectedVehicles((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (next[key].driverId === id) next[key] = { ...next[key], driverId: "" };
      }
      return next;
    });
  }

  function toggleVehicle(vehicle: Vehicle) {
    setSelectedVehicles((current) => {
      const next = { ...current };
      if (next[vehicle.id]) {
        delete next[vehicle.id];
      } else {
        next[vehicle.id] = {
          driverId:
            vehicle.default_driver_id &&
            selectedTechnicians.includes(vehicle.default_driver_id)
              ? vehicle.default_driver_id
              : "",
          notes: "",
        };
      }
      return next;
    });
  }

  function updateVehicle(id: string, patch: Partial<VehicleSelection>) {
    setSelectedVehicles((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function selectSite(id: string) {
    setSiteId(id);
    const site = sites.find((s) => s.id === id);
    if (site && !location.trim()) {
      setLocation([site.address, site.city].filter(Boolean).join(", "));
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Inserisci il titolo dell'attività.");
      return;
    }
    if (!isPeriodValid || !startIso || !endIso) {
      setError("Il termine dell'attività deve essere successivo all'inizio.");
      return;
    }
    if (!ignoresConflicts && blockingVehicleIssues.length > 0) {
      setError(
        "Alcuni mezzi selezionati non sono assegnabili: " +
          blockingVehicleIssues
            .map(({ vehicle, issue }) => `${vehicle?.plate ?? "?"} – ${issue.message}`)
            .join("; ")
      );
      return;
    }

    setIsSaving(true);
    try {
      await saveActivity(
        activity?.id ?? null,
        {
          title: title.trim(),
          activity_type: activityType,
          status,
          priority,
          customer_id: customerId || null,
          customer_site_id: siteId || null,
          location: location.trim() || null,
          start_at: startIso,
          end_at: endIso,
          description: description.trim() || null,
          notes: notes.trim() || null,
        },
        {
          technicians: selectedTechnicians.map((id) => ({
            technician_id: id,
            is_lead: id === leadTechnicianId,
          })),
          vehicles: Object.entries(selectedVehicles).map(([id, sel]) => ({
            vehicle_id: id,
            driver_id: sel.driverId || null,
            notes: sel.notes.trim() || null,
          })),
        }
      );
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Errore durante il salvataggio dell'attività."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!activity) return;
    if (!window.confirm(`Eliminare definitivamente l'attività "${activity.title}"?`)) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await deleteActivity(activity.id);
      onSaved();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Errore durante l'eliminazione."
      );
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-5xl space-y-5 rounded-3xl bg-slate-50 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {activity ? "Modifica attività" : "Nuova attività"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {title.trim() || "Attività di cantiere"}
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Dati attività</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Titolo*</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es. Verifica impianto – Cantiere Via Roma"
                className={inputClass}
                autoFocus
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tipo</span>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ActivityType)}
                className={inputClass}
              >
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Priorità</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                className={inputClass}
              >
                {Object.entries(ACTIVITY_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Inizio*</span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Fine*</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Stato</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                className={inputClass}
              >
                {Object.entries(ACTIVITY_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end text-xs text-slate-500">
              {!isPeriodValid
                ? "⚠️ Periodo non valido"
                : isCheckingAvailability
                  ? "Controllo disponibilità…"
                  : "Disponibilità aggiornata"}
            </div>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Cliente</span>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setSiteId("");
                }}
                className={inputClass}
              >
                <option value="">— Nessun cliente —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.business_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Sede / cantiere cliente
              </span>
              <select
                value={siteId}
                onChange={(e) => selectSite(e.target.value)}
                className={inputClass}
                disabled={sites.length === 0}
              >
                <option value="">
                  {sites.length === 0 ? "— Nessuna sede registrata —" : "— Seleziona sede —"}
                </option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                    {site.city ? ` (${site.city})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 md:col-span-2 lg:col-span-4">
              <span className="text-sm font-medium text-slate-700">
                Luogo / indirizzo cantiere
              </span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Via, città"
                className={inputClass}
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Descrizione lavori</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Note (attrezzatura, accessi, contatti in loco…)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-semibold text-slate-900">Tecnici</h3>
              <span className="text-xs text-slate-500">
                {selectedTechnicians.length} selezionati
              </span>
            </div>
            {visibleTechnicians.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Nessun tecnico registrato. Aggiungili da “Tecnici e firme”.
              </p>
            ) : (
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {visibleTechnicians.map((technician) => {
                  const checked = selectedTechnicians.includes(technician.id);
                  const issues = technicianIssues[technician.id] ?? [];
                  return (
                    <li
                      key={technician.id}
                      className={`rounded-xl border p-3 ${
                        checked ? "border-slate-400 bg-slate-50" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTechnician(technician.id)}
                          />
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">
                              {technician.full_name}
                            </span>
                            {technician.role && (
                              <span className="block text-xs text-slate-500">
                                {technician.role}
                              </span>
                            )}
                          </span>
                        </label>
                        {checked && (
                          <label className="flex items-center gap-1 text-xs text-slate-600">
                            <input
                              type="radio"
                              name="lead-technician"
                              checked={leadTechnicianId === technician.id}
                              onChange={() => setLeadTechnicianId(technician.id)}
                            />
                            Capo squadra
                          </label>
                        )}
                      </div>
                      {!ignoresConflicts && <IssueList issues={issues} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-semibold text-slate-900">Mezzi assegnati</h3>
              <span className="text-xs text-slate-500">
                {Object.keys(selectedVehicles).length} selezionati
              </span>
            </div>
            {visibleVehicles.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Nessun mezzo registrato. Aggiungili dalla sezione “Flotta”.
              </p>
            ) : (
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {visibleVehicles.map((vehicle) => {
                  const selection = selectedVehicles[vehicle.id];
                  const issues = vehicleIssues[vehicle.id] ?? [];
                  const hasError = issues.some((i) => i.severity === "error");
                  const disabled = !selection && hasError && !ignoresConflicts;
                  return (
                    <li
                      key={vehicle.id}
                      className={`rounded-xl border p-3 ${
                        selection
                          ? hasError && !ignoresConflicts
                            ? "border-red-300 bg-red-50"
                            : "border-slate-400 bg-slate-50"
                          : disabled
                            ? "border-slate-200 opacity-60"
                            : "border-slate-200"
                      }`}
                    >
                      <label
                        className={`flex items-center gap-3 ${
                          disabled ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selection)}
                          disabled={disabled}
                          onChange={() => toggleVehicle(vehicle)}
                        />
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: vehicle.color }}
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {vehicleLabel(vehicle)}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {VEHICLE_TYPE_LABELS[vehicle.vehicle_type]}
                            {vehicle.seats ? ` · ${vehicle.seats} posti` : ""}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            VEHICLE_STATUS_CLASSES[vehicle.status]
                          }`}
                        >
                          {VEHICLE_STATUS_LABELS[vehicle.status]}
                        </span>
                      </label>
                      {!ignoresConflicts && <IssueList issues={issues} />}
                      {selection && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <select
                            value={selection.driverId}
                            onChange={(e) =>
                              updateVehicle(vehicle.id, { driverId: e.target.value })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">Autista: non indicato</option>
                            {technicians
                              .filter((t) => selectedTechnicians.includes(t.id))
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  Autista: {t.full_name}
                                </option>
                              ))}
                          </select>
                          <input
                            value={selection.notes}
                            onChange={(e) =>
                              updateVehicle(vehicle.id, { notes: e.target.value })
                            }
                            placeholder="Note mezzo (carico, ritiro…)"
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <div>
            {activity && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="rounded-xl border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {isDeleting ? "Eliminazione…" : "Elimina attività"}
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
              disabled={isSaving || isDeleting}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Salvataggio…" : "Salva attività"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
