"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ActivityEditor from "@/components/fleet/ActivityEditor";
import { useFleetReferenceData } from "@/components/fleet/useFleetReferenceData";
import {
  ACTIVITY_PRIORITY_CLASSES,
  ACTIVITY_PRIORITY_LABELS,
  ACTIVITY_STATUS_CLASSES,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  type Activity,
  type ActivityStatus,
  addDays,
  fetchActivities,
  formatPeriod,
  startOfDay,
} from "@/lib/fleet";

type PeriodFilter = "upcoming" | "next7" | "past30" | "all";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  upcoming: "Da oggi in poi",
  next7: "Prossimi 7 giorni",
  past30: "Ultimi 30 giorni",
  all: "Tutte",
};

function periodRange(period: PeriodFilter): [Date | undefined, Date | undefined] {
  const today = startOfDay(new Date());
  switch (period) {
    case "upcoming":
      return [today, undefined];
    case "next7":
      return [today, addDays(today, 8)];
    case "past30":
      return [addDays(today, -30), addDays(today, 1)];
    default:
      return [undefined, undefined];
  }
}

export default function ActivitiesManager() {
  const { vehicles, technicians, customers, error: refError, reload } =
    useFleetReferenceData();

  const [period, setPeriod] = useState<PeriodFilter>("upcoming");
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | "">("");
  const [search, setSearch] = useState("");
  const [onlyMissingVehicle, setOnlyMissingVehicle] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Activity | "new" | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [from, to] = periodRange(period);
      setActivities(await fetchActivities(from, to));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Errore nel caricamento."
      );
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dati al cambio filtro
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = activities.filter((activity) => {
      if (statusFilter && activity.status !== statusFilter) return false;
      if (onlyMissingVehicle && activity.field_activity_vehicles.length > 0) return false;
      if (!term) return true;
      return [
        activity.title,
        activity.location,
        activity.customers?.business_name,
        activity.customer_sites?.name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });
    return period === "past30" ? [...list].reverse() : list;
  }, [activities, statusFilter, onlyMissingVehicle, search, period]);

  const technicianName = (id: string) =>
    technicians.find((t) => t.id === id)?.full_name ?? "?";
  const vehicleById = (id: string) => vehicles.find((v) => v.id === id);

  return (
    <div className="space-y-6">
      {(error || refError) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error || refError}
          <p className="mt-1 text-xs">
            Se le tabelle non esistono ancora, esegui su Supabase lo script
            <code className="mx-1 rounded bg-white px-1">
              supabase/migrations/20261107_flotta_cantieri.sql
            </code>
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Elenco attività</h2>
            <p className="text-sm text-slate-500">{filtered.length} attività</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca titolo, cliente, luogo…"
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className="rounded-xl border border-slate-300 px-3 py-2"
            >
              {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ActivityStatus | "")}
              className="rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="">Tutti gli stati</option>
              {Object.entries(ACTIVITY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                checked={onlyMissingVehicle}
                onChange={(e) => setOnlyMissingVehicle(e.target.checked)}
              />
              Solo senza mezzo
            </label>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-700"
            >
              Nuova attività
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nessuna attività trovata.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Periodo</th>
                  <th className="px-4 py-3">Attività</th>
                  <th className="px-4 py-3">Cliente / luogo</th>
                  <th className="px-4 py-3">Tecnici</th>
                  <th className="px-4 py-3">Mezzi</th>
                  <th className="px-4 py-3">Stato</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((activity) => (
                  <tr key={activity.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatPeriod(activity.start_at, activity.end_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditing(activity)}
                        className="text-left font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {activity.title}
                      </button>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                        {activity.priority !== "normal" && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              ACTIVITY_PRIORITY_CLASSES[activity.priority]
                            }`}
                          >
                            {ACTIVITY_PRIORITY_LABELS[activity.priority]}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{activity.customers?.business_name ?? "-"}</p>
                      <p className="text-xs text-slate-500">
                        {[activity.customer_sites?.name, activity.location]
                          .filter(Boolean)
                          .join(" · ") || ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {activity.field_activity_technicians.length === 0 ? (
                        <span className="text-xs text-amber-700">Nessun tecnico</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {activity.field_activity_technicians.map((t) => (
                            <li key={t.technician_id}>
                              {technicianName(t.technician_id)}
                              {t.is_lead && (
                                <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">
                                  capo
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {activity.field_activity_vehicles.length === 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Da assegnare
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {activity.field_activity_vehicles.map((assignment) => {
                            const vehicle = vehicleById(assignment.vehicle_id);
                            return (
                              <span
                                key={assignment.vehicle_id}
                                className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold"
                                style={{
                                  borderLeft: `4px solid ${vehicle?.color ?? "#94a3b8"}`,
                                }}
                                title={
                                  assignment.driver_id
                                    ? `Autista: ${technicianName(assignment.driver_id)}`
                                    : undefined
                                }
                              >
                                {vehicle?.plate ?? "?"}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          ACTIVITY_STATUS_CLASSES[activity.status]
                        }`}
                      >
                        {ACTIVITY_STATUS_LABELS[activity.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditing(activity)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Modifica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ActivityEditor
          key={editing === "new" ? "new" : editing.id}
          activity={editing === "new" ? null : editing}
          vehicles={vehicles}
          technicians={technicians}
          customers={customers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            reload();
          }}
        />
      )}
    </div>
  );
}
