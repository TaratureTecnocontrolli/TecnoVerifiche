import { supabase } from "@/lib/supabase";

/* -------------------------------------------------------------------------- */
/* Tipi                                                                       */
/* -------------------------------------------------------------------------- */

export type VehicleType =
  | "car"
  | "van"
  | "truck"
  | "trailer"
  | "equipment"
  | "other";

export type VehicleStatus = "available" | "maintenance" | "out_of_service";

export type Vehicle = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  vehicle_type: VehicleType;
  fuel_type: string | null;
  registration_year: number | null;
  seats: number | null;
  current_km: number | null;
  status: VehicleStatus;
  default_driver_id: string | null;
  insurance_expiry: string | null;
  inspection_expiry: string | null;
  road_tax_expiry: string | null;
  next_service_date: string | null;
  next_service_km: number | null;
  color: string;
  notes: string | null;
  is_active: boolean;
};

export type VehicleLog = {
  id: string;
  vehicle_id: string;
  log_date: string;
  log_type: string;
  km: number | null;
  cost: number | null;
  description: string | null;
};

export type Technician = {
  id: string;
  full_name: string;
  role: string | null;
  is_active: boolean;
};

export type CustomerOption = {
  id: string;
  business_name: string;
  customer_sites:
    | {
        id: string;
        name: string;
        address: string | null;
        city: string | null;
      }[]
    | null;
};

export type ActivityType =
  | "site"
  | "calibration"
  | "installation"
  | "maintenance"
  | "inspection"
  | "other";

export type ActivityStatus =
  | "planned"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ActivityPriority = "low" | "normal" | "high" | "urgent";

export type Activity = {
  id: string;
  title: string;
  activity_type: ActivityType;
  status: ActivityStatus;
  priority: ActivityPriority;
  customer_id: string | null;
  customer_site_id: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  description: string | null;
  notes: string | null;
  customers: { id: string; business_name: string } | null;
  customer_sites: { id: string; name: string; city: string | null } | null;
  field_activity_technicians: { technician_id: string; is_lead: boolean }[];
  field_activity_vehicles: {
    vehicle_id: string;
    driver_id: string | null;
    notes: string | null;
  }[];
};

/* -------------------------------------------------------------------------- */
/* Etichette                                                                  */
/* -------------------------------------------------------------------------- */

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: "Autovettura",
  van: "Furgone",
  truck: "Autocarro",
  trailer: "Rimorchio",
  equipment: "Attrezzatura / mezzo d'opera",
  other: "Altro",
};

export const FUEL_TYPE_LABELS: Record<string, string> = {
  diesel: "Diesel",
  petrol: "Benzina",
  hybrid: "Ibrido",
  electric: "Elettrico",
  lpg: "GPL",
  methane: "Metano",
  other: "Altro",
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  available: "Disponibile",
  maintenance: "In manutenzione",
  out_of_service: "Fuori servizio",
};

export const VEHICLE_STATUS_CLASSES: Record<VehicleStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  maintenance: "bg-amber-100 text-amber-800",
  out_of_service: "bg-slate-200 text-slate-700",
};

export const LOG_TYPE_LABELS: Record<string, string> = {
  service: "Tagliando",
  repair: "Riparazione",
  tyres: "Pneumatici",
  inspection: "Revisione",
  fuel: "Rifornimento",
  km: "Lettura km",
  other: "Altro",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  site: "Cantiere",
  calibration: "Verifica / taratura in campo",
  installation: "Installazione",
  maintenance: "Manutenzione",
  inspection: "Sopralluogo",
  other: "Altro",
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: "Pianificata",
  confirmed: "Confermata",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
};

export const ACTIVITY_STATUS_CLASSES: Record<ActivityStatus, string> = {
  planned: "bg-sky-100 text-sky-800 border-sky-200",
  confirmed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-amber-100 text-amber-900 border-amber-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 line-through",
};

export const ACTIVITY_PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: "Bassa",
  normal: "Normale",
  high: "Alta",
  urgent: "Urgente",
};

export const ACTIVITY_PRIORITY_CLASSES: Record<ActivityPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-slate-100 text-slate-700",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

/* -------------------------------------------------------------------------- */
/* Date                                                                       */
/* -------------------------------------------------------------------------- */

const DAY_MS = 1000 * 60 * 60 * 24;

export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Lunedì della settimana che contiene `date`. */
export function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const weekday = (result.getDay() + 6) % 7; // 0 = lunedì
  return addDays(result, -weekday);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "YYYY-MM-DD" in ora locale. */
export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Valore per <input type="datetime-local"> in ora locale. */
export function toDateTimeLocal(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${toDateKey(date)}T${hours}:${minutes}`;
}

export function formatDate(value: string | Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

export function formatDateTime(value: string | Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatPeriod(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (isSameDay(start, end)) {
    return `${formatDate(start)} ${formatTime(start)}–${formatTime(end)}`;
  }

  return `${formatDateTime(start)} → ${formatDateTime(end)}`;
}

/** Intervalli semiaperti [start, end): si sovrappongono? */
export function periodsOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date,
  endB: string | Date
) {
  return (
    new Date(startA).getTime() < new Date(endB).getTime() &&
    new Date(startB).getTime() < new Date(endA).getTime()
  );
}

/** L'attività occupa (anche parzialmente) il giorno indicato? */
export function activityTouchesDay(activity: Activity, day: Date) {
  const dayStart = startOfDay(day);
  return periodsOverlap(
    activity.start_at,
    activity.end_at,
    dayStart,
    addDays(dayStart, 1)
  );
}

export function daysUntil(date: string | null) {
  if (!date) return null;
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(date));
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

/* -------------------------------------------------------------------------- */
/* Scadenze mezzi                                                             */
/* -------------------------------------------------------------------------- */

export type DeadlineLevel = "ok" | "warning" | "expired" | "missing";

export const DEADLINE_WARNING_DAYS = 30;

export function deadlineLevel(date: string | null): DeadlineLevel {
  const days = daysUntil(date);
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= DEADLINE_WARNING_DAYS) return "warning";
  return "ok";
}

export const DEADLINE_CLASSES: Record<DeadlineLevel, string> = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  expired: "bg-red-50 text-red-800 border-red-200",
  missing: "bg-slate-50 text-slate-500 border-slate-200",
};

export type VehicleDeadline = {
  key: "insurance" | "inspection" | "road_tax" | "service" | "service_km";
  label: string;
  date: string | null;
  level: DeadlineLevel;
  detail: string;
};

export function vehicleDeadlines(vehicle: Vehicle): VehicleDeadline[] {
  const dated: VehicleDeadline[] = [
    {
      key: "insurance",
      label: "Assicurazione",
      date: vehicle.insurance_expiry,
      level: deadlineLevel(vehicle.insurance_expiry),
      detail: formatDate(vehicle.insurance_expiry),
    },
    {
      key: "inspection",
      label: "Revisione",
      date: vehicle.inspection_expiry,
      level: deadlineLevel(vehicle.inspection_expiry),
      detail: formatDate(vehicle.inspection_expiry),
    },
    {
      key: "road_tax",
      label: "Bollo",
      date: vehicle.road_tax_expiry,
      level: deadlineLevel(vehicle.road_tax_expiry),
      detail: formatDate(vehicle.road_tax_expiry),
    },
    {
      key: "service",
      label: "Tagliando",
      date: vehicle.next_service_date,
      level: deadlineLevel(vehicle.next_service_date),
      detail: formatDate(vehicle.next_service_date),
    },
  ];

  if (vehicle.next_service_km !== null) {
    const remaining =
      vehicle.current_km === null
        ? null
        : vehicle.next_service_km - vehicle.current_km;

    dated.push({
      key: "service_km",
      label: "Tagliando (km)",
      date: null,
      level:
        remaining === null
          ? "missing"
          : remaining < 0
            ? "expired"
            : remaining <= 1000
              ? "warning"
              : "ok",
      detail:
        remaining === null
          ? `a ${vehicle.next_service_km.toLocaleString("it-IT")} km`
          : remaining < 0
            ? `superato di ${Math.abs(remaining).toLocaleString("it-IT")} km`
            : `tra ${remaining.toLocaleString("it-IT")} km`,
    });
  }

  return dated;
}

/** Peggior livello tra le scadenze del mezzo (ignora quelle non compilate). */
export function vehicleWorstDeadline(vehicle: Vehicle): DeadlineLevel {
  const levels = vehicleDeadlines(vehicle).map((d) => d.level);
  if (levels.includes("expired")) return "expired";
  if (levels.includes("warning")) return "warning";
  return "ok";
}

export function vehicleLabel(vehicle: Pick<Vehicle, "plate" | "brand" | "model">) {
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  return name ? `${vehicle.plate} · ${name}` : vehicle.plate;
}

/* -------------------------------------------------------------------------- */
/* Conflitti di assegnazione                                                  */
/* -------------------------------------------------------------------------- */

export type AssignmentIssue = {
  severity: "error" | "warning";
  message: string;
};

/** Attività (non annullate) diverse da `excludeId` che si sovrappongono al periodo. */
export function overlappingActivities(
  activities: Activity[],
  startAt: string,
  endAt: string,
  excludeId?: string | null
) {
  return activities.filter(
    (activity) =>
      activity.id !== excludeId &&
      activity.status !== "cancelled" &&
      periodsOverlap(activity.start_at, activity.end_at, startAt, endAt)
  );
}

/**
 * Problemi nell'assegnare `vehicle` a un'attività nel periodo indicato:
 * doppie prenotazioni (errore), stato del mezzo e scadenze (avvisi/errori).
 */
export function vehicleAssignmentIssues(
  vehicle: Vehicle,
  activities: Activity[],
  startAt: string,
  endAt: string,
  excludeActivityId?: string | null
): AssignmentIssue[] {
  const issues: AssignmentIssue[] = [];

  if (!vehicle.is_active || vehicle.status === "out_of_service") {
    issues.push({ severity: "error", message: "Mezzo fuori servizio" });
  } else if (vehicle.status === "maintenance") {
    issues.push({ severity: "warning", message: "Mezzo in manutenzione" });
  }

  for (const other of overlappingActivities(
    activities,
    startAt,
    endAt,
    excludeActivityId
  )) {
    if (other.field_activity_vehicles.some((v) => v.vehicle_id === vehicle.id)) {
      issues.push({
        severity: "error",
        message: `Già assegnato a "${other.title}" (${formatPeriod(
          other.start_at,
          other.end_at
        )})`,
      });
    }
  }

  const end = new Date(endAt);
  const legal: [string, string | null][] = [
    ["Assicurazione", vehicle.insurance_expiry],
    ["Revisione", vehicle.inspection_expiry],
    ["Bollo", vehicle.road_tax_expiry],
  ];

  for (const [label, date] of legal) {
    if (!date) continue;
    // La scadenza vale per l'intero giorno indicato.
    const expiry = addDays(startOfDay(new Date(date)), 1);
    if (expiry.getTime() <= new Date(startAt).getTime()) {
      issues.push({
        severity: "error",
        message: `${label} scaduta il ${formatDate(date)}`,
      });
    } else if (expiry.getTime() < end.getTime()) {
      issues.push({
        severity: "warning",
        message: `${label} scade durante l'attività (${formatDate(date)})`,
      });
    }
  }

  if (
    vehicle.next_service_date &&
    startOfDay(new Date(vehicle.next_service_date)).getTime() <
      end.getTime()
  ) {
    issues.push({
      severity: "warning",
      message: `Tagliando previsto il ${formatDate(vehicle.next_service_date)}`,
    });
  }

  return issues;
}

export function technicianAssignmentIssues(
  technicianId: string,
  activities: Activity[],
  startAt: string,
  endAt: string,
  excludeActivityId?: string | null
): AssignmentIssue[] {
  return overlappingActivities(activities, startAt, endAt, excludeActivityId)
    .filter((other) =>
      other.field_activity_technicians.some(
        (t) => t.technician_id === technicianId
      )
    )
    .map((other) => ({
      severity: "warning" as const,
      message: `Impegnato in "${other.title}" (${formatPeriod(
        other.start_at,
        other.end_at
      )})`,
    }));
}

/* -------------------------------------------------------------------------- */
/* Accesso dati                                                               */
/* -------------------------------------------------------------------------- */

export const VEHICLE_COLUMNS = `
  id,
  plate,
  brand,
  model,
  vehicle_type,
  fuel_type,
  registration_year,
  seats,
  current_km,
  status,
  default_driver_id,
  insurance_expiry,
  inspection_expiry,
  road_tax_expiry,
  next_service_date,
  next_service_km,
  color,
  notes,
  is_active
`;

export const ACTIVITY_COLUMNS = `
  id,
  title,
  activity_type,
  status,
  priority,
  customer_id,
  customer_site_id,
  location,
  start_at,
  end_at,
  description,
  notes,
  customers ( id, business_name ),
  customer_sites ( id, name, city ),
  field_activity_technicians ( technician_id, is_lead ),
  field_activity_vehicles ( vehicle_id, driver_id, notes )
`;

export async function fetchVehicles() {
  const { data, error } = await supabase
    .from("fleet_vehicles")
    .select(VEHICLE_COLUMNS)
    .order("plate", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Vehicle[];
}

export async function fetchTechnicians() {
  const { data, error } = await supabase
    .from("calibration_technicians")
    .select("id, full_name, role, is_active")
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Technician[];
}

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, business_name, customer_sites ( id, name, address, city )")
    .eq("is_active", true)
    .order("business_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CustomerOption[];
}

/** Attività che si sovrappongono all'intervallo [from, to). */
export async function fetchActivities(from?: Date, to?: Date) {
  let query = supabase
    .from("field_activities")
    .select(ACTIVITY_COLUMNS)
    .order("start_at", { ascending: true });

  if (from) query = query.gt("end_at", from.toISOString());
  if (to) query = query.lt("start_at", to.toISOString());

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Activity[];
}

export type ActivityInput = {
  title: string;
  activity_type: ActivityType;
  status: ActivityStatus;
  priority: ActivityPriority;
  customer_id: string | null;
  customer_site_id: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  description: string | null;
  notes: string | null;
};

export type ActivityAssignments = {
  technicians: { technician_id: string; is_lead: boolean }[];
  vehicles: { vehicle_id: string; driver_id: string | null; notes: string | null }[];
};

/** Crea o aggiorna un'attività e sostituisce le assegnazioni di tecnici e mezzi. */
export async function saveActivity(
  activityId: string | null,
  input: ActivityInput,
  assignments: ActivityAssignments
) {
  let id = activityId;

  if (id) {
    const { error } = await supabase
      .from("field_activities")
      .update(input)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("field_activities")
      .insert(input)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = (data as { id: string }).id;
  }

  const { error: deleteTechError } = await supabase
    .from("field_activity_technicians")
    .delete()
    .eq("activity_id", id);
  if (deleteTechError) throw new Error(deleteTechError.message);

  const { error: deleteVehError } = await supabase
    .from("field_activity_vehicles")
    .delete()
    .eq("activity_id", id);
  if (deleteVehError) throw new Error(deleteVehError.message);

  if (assignments.technicians.length > 0) {
    const { error } = await supabase.from("field_activity_technicians").insert(
      assignments.technicians.map((t) => ({ ...t, activity_id: id }))
    );
    if (error) throw new Error(error.message);
  }

  if (assignments.vehicles.length > 0) {
    const { error } = await supabase.from("field_activity_vehicles").insert(
      assignments.vehicles.map((v) => ({ ...v, activity_id: id }))
    );
    if (error) throw new Error(error.message);
  }

  return id as string;
}

export async function deleteActivity(activityId: string) {
  const { error } = await supabase
    .from("field_activities")
    .delete()
    .eq("id", activityId);
  if (error) throw new Error(error.message);
}
