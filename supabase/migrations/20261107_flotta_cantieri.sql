-- ============================================================================
-- Modulo Flotta aziendale, Attività di cantiere e Calendario
-- ----------------------------------------------------------------------------
-- Da eseguire una sola volta dall'SQL Editor di Supabase.
-- Riutilizza le tabelle esistenti `calibration_technicians` (tecnici),
-- `customers` e `customer_sites` (clienti / cantieri).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Mezzi aziendali
-- ----------------------------------------------------------------------------
create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  brand text,
  model text,
  vehicle_type text not null default 'van'
    check (vehicle_type in ('car', 'van', 'truck', 'trailer', 'equipment', 'other')),
  fuel_type text
    check (fuel_type is null or fuel_type in ('diesel', 'petrol', 'hybrid', 'electric', 'lpg', 'methane', 'other')),
  registration_year integer,
  seats integer,
  current_km integer,
  status text not null default 'available'
    check (status in ('available', 'maintenance', 'out_of_service')),
  default_driver_id uuid references public.calibration_technicians (id) on delete set null,
  insurance_expiry date,
  inspection_expiry date,
  road_tax_expiry date,
  next_service_date date,
  next_service_km integer,
  color text not null default '#2563eb',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Registro interventi / manutenzioni / rifornimenti dei mezzi
create table if not exists public.fleet_vehicle_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  log_date date not null default current_date,
  log_type text not null default 'service'
    check (log_type in ('service', 'repair', 'tyres', 'inspection', 'fuel', 'km', 'other')),
  km integer,
  cost numeric(10, 2),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists fleet_vehicle_logs_vehicle_idx
  on public.fleet_vehicle_logs (vehicle_id, log_date desc);

-- ----------------------------------------------------------------------------
-- Attività di cantiere / interventi tecnici
-- ----------------------------------------------------------------------------
create table if not exists public.field_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  activity_type text not null default 'site'
    check (activity_type in ('site', 'calibration', 'installation', 'maintenance', 'inspection', 'other')),
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  customer_id uuid references public.customers (id) on delete set null,
  customer_site_id uuid references public.customer_sites (id) on delete set null,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_activities_dates_check check (end_at > start_at)
);

create index if not exists field_activities_period_idx
  on public.field_activities (start_at, end_at);

-- Tecnici assegnati all'attività
create table if not exists public.field_activity_technicians (
  activity_id uuid not null references public.field_activities (id) on delete cascade,
  technician_id uuid not null references public.calibration_technicians (id) on delete cascade,
  is_lead boolean not null default false,
  primary key (activity_id, technician_id)
);

-- Mezzi assegnati all'attività
create table if not exists public.field_activity_vehicles (
  activity_id uuid not null references public.field_activities (id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  driver_id uuid references public.calibration_technicians (id) on delete set null,
  notes text,
  primary key (activity_id, vehicle_id)
);

create index if not exists field_activity_vehicles_vehicle_idx
  on public.field_activity_vehicles (vehicle_id);

create index if not exists field_activity_technicians_technician_idx
  on public.field_activity_technicians (technician_id);

-- ----------------------------------------------------------------------------
-- updated_at automatico
-- ----------------------------------------------------------------------------
create or replace function public.fleet_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fleet_vehicles_updated_at on public.fleet_vehicles;
create trigger fleet_vehicles_updated_at
  before update on public.fleet_vehicles
  for each row execute function public.fleet_set_updated_at();

drop trigger if exists field_activities_updated_at on public.field_activities;
create trigger field_activities_updated_at
  before update on public.field_activities
  for each row execute function public.fleet_set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security: accesso completo agli utenti autenticati
-- (stesso modello del resto del gestionale)
-- ----------------------------------------------------------------------------
alter table public.fleet_vehicles enable row level security;
alter table public.fleet_vehicle_logs enable row level security;
alter table public.field_activities enable row level security;
alter table public.field_activity_technicians enable row level security;
alter table public.field_activity_vehicles enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'fleet_vehicles',
    'fleet_vehicle_logs',
    'field_activities',
    'field_activity_technicians',
    'field_activity_vehicles'
  ]
  loop
    execute format('drop policy if exists "%1$s_authenticated_all" on public.%1$I', t);
    execute format(
      'create policy "%1$s_authenticated_all" on public.%1$I
         for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end;
$$;
