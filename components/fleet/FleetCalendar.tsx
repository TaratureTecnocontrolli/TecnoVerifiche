"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ActivityEditor from "@/components/fleet/ActivityEditor";
import { useFleetReferenceData } from "@/components/fleet/useFleetReferenceData";
import {
  ACTIVITY_STATUS_CLASSES,
  ACTIVITY_STATUS_LABELS,
  type Activity,
  type Technician,
  type Vehicle,
  activityTouchesDay,
  addDays,
  fetchActivities,
  formatPeriod,
  formatTime,
  isSameDay,
  startOfDay,
  startOfWeek,
  toDateKey,
  vehicleWorstDeadline,
} from "@/lib/fleet";

type ViewMode = "month" | "vehicles" | "technicians";

type EditorState =
  | { mode: "closed" }
  | {
      mode: "open";
      activity: Activity | null;
      start?: Date;
      end?: Date;
      vehicleId?: string;
    };

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const VIEW_LABELS: Record<ViewMode, string> = {
  month: "Mese",
  vehicles: "Planning mezzi",
  technicians: "Planning tecnici",
};

function dayDefaults(day: Date) {
  const start = new Date(day);
  start.setHours(8, 0, 0, 0);
  const end = new Date(day);
  end.setHours(17, 0, 0, 0);
  return { start, end };
}

function ActivityChip({
  activity,
  day,
  vehicles,
  onClick,
  compact = false,
}: {
  activity: Activity;
  day: Date;
  vehicles: Vehicle[];
  onClick: () => void;
  compact?: boolean;
}) {
  const start = new Date(activity.start_at);
  const end = new Date(activity.end_at);
  const startsToday = isSameDay(start, day);
  const endsToday = isSameDay(end, day) || end.getTime() === addDays(startOfDay(day), 1).getTime();

  const timeLabel = startsToday
    ? endsToday
      ? `${formatTime(start)}–${formatTime(end)}`
      : `dalle ${formatTime(start)}`
    : endsToday
      ? `fino ${formatTime(end)}`
      : "tutto il giorno";

  const assignedVehicles = activity.field_activity_vehicles
    .map((v) => vehicles.find((vehicle) => vehicle.id === v.vehicle_id))
    .filter((v): v is Vehicle => Boolean(v));

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={`${activity.title}\n${formatPeriod(activity.start_at, activity.end_at)}\n${
        ACTIVITY_STATUS_LABELS[activity.status]
      }`}
      className={`block w-full rounded-lg border px-2 py-1 text-left text-[11px] leading-tight transition hover:shadow ${
        ACTIVITY_STATUS_CLASSES[activity.status]
      }`}
    >
      <span className="block truncate font-semibold">
        {activity.priority === "urgent" && "🔴 "}
        {activity.title}
      </span>
      <span className="block truncate opacity-80">
        {timeLabel}
        {!compact && activity.customers ? ` · ${activity.customers.business_name}` : ""}
      </span>
      {!compact && assignedVehicles.length > 0 && (
        <span className="mt-0.5 flex flex-wrap gap-1">
          {assignedVehicles.map((vehicle) => (
            <span
              key={vehicle.id}
              className="rounded bg-white/70 px-1 font-mono text-[10px] text-slate-800"
              style={{ borderLeft: `3px solid ${vehicle.color}` }}
            >
              {vehicle.plate}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

export default function FleetCalendar() {
  const { vehicles, technicians, customers, isLoading, error, reload } =
    useFleetReferenceData();

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesError, setActivitiesError] = useState("");
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [hideCancelled, setHideCancelled] = useState(true);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");

  const days = useMemo(() => {
    if (view === "month") {
      const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const gridStart = startOfWeek(firstOfMonth);
      const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      const gridEnd = addDays(startOfWeek(lastOfMonth), 7);
      const result: Date[] = [];
      for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) result.push(d);
      return result;
    }
    const weekStart = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [view, anchor]);

  const rangeStart = days[0];
  const rangeEnd = addDays(days[days.length - 1], 1);
  const rangeStartTime = rangeStart.getTime();
  const rangeEndTime = rangeEnd.getTime();

  const loadActivities = useCallback(async () => {
    setIsLoadingActivities(true);
    setActivitiesError("");
    try {
      setActivities(
        await fetchActivities(new Date(rangeStartTime), new Date(rangeEndTime))
      );
    } catch (loadError) {
      setActivitiesError(
        loadError instanceof Error
          ? loadError.message
          : "Errore nel caricamento delle attività."
      );
    } finally {
      setIsLoadingActivities(false);
    }
  }, [rangeStartTime, rangeEndTime]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dati al cambio periodo
    loadActivities();
  }, [loadActivities]);

  const visibleActivities = useMemo(
    () =>
      activities.filter((activity) => {
        if (hideCancelled && activity.status === "cancelled") return false;
        if (
          vehicleFilter &&
          !activity.field_activity_vehicles.some((v) => v.vehicle_id === vehicleFilter)
        )
          return false;
        if (
          technicianFilter &&
          !activity.field_activity_technicians.some(
            (t) => t.technician_id === technicianFilter
          )
        )
          return false;
        return true;
      }),
    [activities, hideCancelled, vehicleFilter, technicianFilter]
  );

  function move(direction: -1 | 1) {
    if (view === "month") {
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
    } else {
      setAnchor(addDays(anchor, 7 * direction));
    }
  }

  function openNew(day: Date, vehicleId?: string) {
    const { start, end } = dayDefaults(day);
    setEditor({ mode: "open", activity: null, start, end, vehicleId });
  }

  function openExisting(activity: Activity) {
    setEditor({ mode: "open", activity });
  }

  const title =
    view === "month"
      ? new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(anchor)
      : `${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(
          days[0]
        )} – ${new Intl.DateTimeFormat("it-IT", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(days[6])}`;

  const today = startOfDay(new Date());

  const activeVehicles = vehicles.filter((v) => v.is_active);
  const activeTechnicians = technicians.filter((t) => t.is_active);

  const dayStats = useMemo(() => {
    const todayActivities = visibleActivities.filter((a) => activityTouchesDay(a, today));
    const busyVehicles = new Set(
      todayActivities.flatMap((a) => a.field_activity_vehicles.map((v) => v.vehicle_id))
    );
    const busyTechnicians = new Set(
      todayActivities.flatMap((a) =>
        a.field_activity_technicians.map((t) => t.technician_id)
      )
    );
    return {
      activities: todayActivities.length,
      busyVehicles: busyVehicles.size,
      busyTechnicians: busyTechnicians.size,
      withoutVehicle: visibleActivities.filter(
        (a) =>
          a.status !== "cancelled" &&
          a.status !== "completed" &&
          a.field_activity_vehicles.length === 0
      ).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `today` cambia solo a mezzanotte
  }, [visibleActivities]);

  return (
    <div className="space-y-5">
      {(error || activitiesError) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error || activitiesError}
          <p className="mt-1 text-xs">
            Se le tabelle non esistono ancora, esegui su Supabase lo script
            <code className="mx-1 rounded bg-white px-1">
              supabase/migrations/20261107_flotta_cantieri.sql
            </code>
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Attività oggi</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{dayStats.activities}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Mezzi impegnati oggi</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {dayStats.busyVehicles}
            <span className="text-base font-medium text-slate-400"> / {activeVehicles.length}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Tecnici impegnati oggi</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {dayStats.busyTechnicians}
            <span className="text-base font-medium text-slate-400">
              {" "}
              / {activeTechnicians.length}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Attività senza mezzo (periodo)</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              dayStats.withoutVehicle > 0 ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {dayStats.withoutVehicle}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              aria-label="Periodo precedente"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setAnchor(startOfDay(new Date()))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Oggi
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              aria-label="Periodo successivo"
            >
              →
            </button>
            <h2 className="ml-2 text-xl font-bold capitalize text-slate-900">{title}</h2>
            {isLoadingActivities && (
              <span className="text-xs text-slate-400">Caricamento…</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    view === mode
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {VIEW_LABELS[mode]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openNew(anchor < today ? today : anchor)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              + Nuova attività
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5"
          >
            <option value="">Tutti i mezzi</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
                {v.model ? ` – ${v.model}` : ""}
              </option>
            ))}
          </select>
          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5"
          >
            <option value="">Tutti i tecnici</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={hideCancelled}
              onChange={(e) => setHideCancelled(e.target.checked)}
            />
            Nascondi annullate
          </label>
          <div className="flex flex-wrap gap-1 text-[11px]">
            {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity["status"][]).map((s) => (
              <span
                key={s}
                className={`rounded-full border px-2 py-0.5 ${ACTIVITY_STATUS_CLASSES[s]}`}
              >
                {ACTIVITY_STATUS_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Caricamento anagrafiche…
        </div>
      ) : view === "month" ? (
        <MonthGrid
          days={days}
          anchor={anchor}
          today={today}
          activities={visibleActivities}
          vehicles={vehicles}
          onNew={openNew}
          onOpen={openExisting}
        />
      ) : view === "vehicles" ? (
        <ResourceGrid
          days={days}
          today={today}
          rows={activeVehicles
            .filter((v) => !vehicleFilter || v.id === vehicleFilter)
            .map((vehicle) => ({
              id: vehicle.id,
              title: vehicle.plate,
              subtitle: [vehicle.brand, vehicle.model].filter(Boolean).join(" "),
              color: vehicle.color,
              badge:
                vehicle.status !== "available"
                  ? vehicle.status === "maintenance"
                    ? "In manutenzione"
                    : "Fuori servizio"
                  : vehicleWorstDeadline(vehicle) === "expired"
                    ? "Scadenze superate"
                    : vehicleWorstDeadline(vehicle) === "warning"
                      ? "Scadenze vicine"
                      : null,
              activities: visibleActivities.filter((a) =>
                a.field_activity_vehicles.some((v) => v.vehicle_id === vehicle.id)
              ),
              onNew: (day: Date) => openNew(day, vehicle.id),
            }))}
          unassigned={{
            title: "Senza mezzo",
            activities: visibleActivities.filter(
              (a) => a.field_activity_vehicles.length === 0
            ),
          }}
          vehicles={vehicles}
          onOpen={openExisting}
          emptyMessage="Nessun mezzo attivo. Aggiungi i mezzi dalla sezione Flotta."
        />
      ) : (
        <ResourceGrid
          days={days}
          today={today}
          rows={activeTechnicians
            .filter((t) => !technicianFilter || t.id === technicianFilter)
            .map((technician: Technician) => ({
              id: technician.id,
              title: technician.full_name,
              subtitle: technician.role ?? "",
              color: "#64748b",
              badge: null,
              activities: visibleActivities.filter((a) =>
                a.field_activity_technicians.some(
                  (t) => t.technician_id === technician.id
                )
              ),
              onNew: (day: Date) => openNew(day),
            }))}
          unassigned={{
            title: "Senza tecnici",
            activities: visibleActivities.filter(
              (a) => a.field_activity_technicians.length === 0
            ),
          }}
          vehicles={vehicles}
          onOpen={openExisting}
          emptyMessage="Nessun tecnico attivo. Aggiungili da Tecnici e firme."
        />
      )}

      {editor.mode === "open" && (
        <ActivityEditor
          key={editor.activity?.id ?? "new"}
          activity={editor.activity}
          defaultStart={editor.start}
          defaultEnd={editor.end}
          defaultVehicleId={editor.vehicleId}
          vehicles={vehicles}
          technicians={technicians}
          customers={customers}
          onClose={() => setEditor({ mode: "closed" })}
          onSaved={() => {
            setEditor({ mode: "closed" });
            loadActivities();
            reload();
          }}
        />
      )}
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  today,
  activities,
  vehicles,
  onNew,
  onOpen,
}: {
  days: Date[];
  anchor: Date;
  today: Date;
  activities: Activity[];
  vehicles: Vehicle[];
  onNew: (day: Date) => void;
  onOpen: (activity: Activity) => void;
}) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[840px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.getMonth() === anchor.getMonth();
            const isToday = isSameDay(day, today);
            const dayActivities = activities.filter((a) => activityTouchesDay(a, day));
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div
                key={toDateKey(day)}
                onClick={() => onNew(day)}
                className={`group min-h-[120px] cursor-pointer border-b border-r border-slate-100 p-1.5 transition hover:bg-slate-50 ${
                  inMonth ? (isWeekend ? "bg-slate-50/60" : "bg-white") : "bg-slate-50 text-slate-400"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday ? "bg-red-600 text-white" : ""
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">
                    + aggiungi
                  </span>
                </div>
                <div className="space-y-1">
                  {dayActivities.slice(0, 4).map((activity) => (
                    <ActivityChip
                      key={activity.id}
                      activity={activity}
                      day={day}
                      vehicles={vehicles}
                      onClick={() => onOpen(activity)}
                    />
                  ))}
                  {dayActivities.length > 4 && (
                    <p className="px-1 text-[11px] font-semibold text-slate-500">
                      +{dayActivities.length - 4} altre
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type ResourceRow = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  badge: string | null;
  activities: Activity[];
  onNew: (day: Date) => void;
};

function ResourceGrid({
  days,
  today,
  rows,
  unassigned,
  vehicles,
  onOpen,
  emptyMessage,
}: {
  days: Date[];
  today: Date;
  rows: ResourceRow[];
  unassigned: { title: string; activities: Activity[] };
  vehicles: Vehicle[];
  onOpen: (activity: Activity) => void;
  emptyMessage: string;
}) {
  const dayFormatter = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1000px] table-fixed text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-48 border-b border-slate-200 px-3 py-2 text-left">Risorsa</th>
            {days.map((day) => (
              <th
                key={toDateKey(day)}
                className={`border-b border-l border-slate-200 px-2 py-2 text-center ${
                  isSameDay(day, today) ? "bg-red-50 text-red-700" : ""
                }`}
              >
                {dayFormatter.format(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="border-b border-slate-100 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{row.title}</p>
                    {row.subtitle && (
                      <p className="truncate text-xs text-slate-500">{row.subtitle}</p>
                    )}
                    {row.badge && (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {row.badge}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              {days.map((day) => {
                const cellActivities = row.activities.filter((a) =>
                  activityTouchesDay(a, day)
                );
                const busy = cellActivities.filter((a) => a.status !== "cancelled");
                return (
                  <td
                    key={toDateKey(day)}
                    onClick={() => row.onNew(day)}
                    className={`group h-20 cursor-pointer border-b border-l border-slate-100 p-1 transition hover:bg-slate-50 ${
                      busy.length > 1 ? "bg-red-50/60" : ""
                    }`}
                    title={busy.length > 1 ? "Più attività nello stesso giorno" : undefined}
                  >
                    <div className="space-y-1">
                      {cellActivities.map((activity) => (
                        <ActivityChip
                          key={activity.id}
                          activity={activity}
                          day={day}
                          vehicles={vehicles}
                          onClick={() => onOpen(activity)}
                          compact
                        />
                      ))}
                      {cellActivities.length === 0 && (
                        <span className="block py-5 text-center text-[11px] text-slate-300 opacity-0 group-hover:opacity-100">
                          + assegna
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="align-top bg-amber-50/40">
            <td className="border-b border-slate-100 px-3 py-2">
              <p className="font-semibold text-amber-800">{unassigned.title}</p>
              <p className="text-xs text-amber-700">da assegnare</p>
            </td>
            {days.map((day) => (
              <td key={toDateKey(day)} className="border-b border-l border-slate-100 p-1">
                <div className="space-y-1">
                  {unassigned.activities
                    .filter((a) => activityTouchesDay(a, day))
                    .map((activity) => (
                      <ActivityChip
                        key={activity.id}
                        activity={activity}
                        day={day}
                        vehicles={vehicles}
                        onClick={() => onOpen(activity)}
                        compact
                      />
                    ))}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
