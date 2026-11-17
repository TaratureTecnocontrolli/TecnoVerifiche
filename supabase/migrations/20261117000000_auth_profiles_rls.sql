-- =============================================================================
-- Login + RLS: profili utente con ruolo e blocco accesso non autenticato
-- =============================================================================
-- Da eseguire una sola volta nel SQL Editor di Supabase (Dashboard > SQL Editor).
-- Operazione additiva e sicura: non cancella e non modifica dati esistenti.
--
-- Cosa fa:
-- 1) Crea la tabella public.profiles (un profilo per ogni utente che fa login,
--    con ruolo di default 'tecnico'), popolata automaticamente alla creazione
--    di ogni nuovo utente in Supabase Auth.
-- 2) Attiva la Row Level Security su tutte le tabelle applicative e consente
--    l'accesso (lettura/scrittura) solo a utenti autenticati. Senza login,
--    nessuna riga è più leggibile o scrivibile tramite l'anon key pubblica.
-- 3) Attiva policy equivalenti sugli storage bucket usati dall'app (lettura
--    pubblica, dato che gli URL dei file sono incorporati nei rapporti
--    stampati; scrittura/upload solo per utenti autenticati).
--
-- Dopo aver eseguito questo script, crea gli account dei tecnici da
-- Supabase Dashboard > Authentication > Users > Add user (email + password).
-- Un profilo con ruolo 'tecnico' viene creato automaticamente per ciascuno.
-- Per cambiare il ruolo di un utente (es. 'responsabile' o 'direttore'),
-- esegui: update public.profiles set role = 'responsabile' where email = '...';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabella profili + ruoli + provisioning automatico
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'tecnico',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Nessuna policy di insert/update/delete per gli utenti normali in questo
-- giro: il profilo viene creato solo dal trigger (security definer) e il
-- ruolo si cambia da Dashboard. Verrà aperto nel prossimo giro insieme al
-- collegamento ruoli/firme.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'tecnico'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Crea i profili per eventuali utenti già esistenti in auth.users che non
-- ne hanno ancora uno (nessun effetto se non ce ne sono).
insert into public.profiles (id, email, full_name, role)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.email), 'tecnico'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- -----------------------------------------------------------------------------
-- 2) Row Level Security sulle tabelle applicative: solo utenti autenticati
-- -----------------------------------------------------------------------------

do $$
declare
  table_name text;
  app_tables text[] := array[
    'audit_logs',
    'calibration_measurements',
    'calibration_procedures',
    'calibration_record_scales',
    'calibration_records',
    'calibration_report_details',
    'calibration_report_photos',
    'calibration_report_settings',
    'calibration_report_signatures',
    'calibration_technicians',
    'calibration_types',
    'customer_instruments',
    'customer_sites',
    'customers',
    'internal_instruments',
    'reference_instrument_certificates',
    'reference_instruments'
  ];
begin
  foreach table_name in array app_tables loop
    execute format('alter table if exists public.%I enable row level security;', table_name);

    execute format('drop policy if exists %I on public.%I;', table_name || '_authenticated_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      table_name || '_authenticated_all',
      table_name
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Storage: lettura pubblica, scrittura solo autenticati
-- -----------------------------------------------------------------------------

do $$
declare
  bucket_name text;
  app_buckets text[] := array[
    'reference-certificates',
    'calibration-photos',
    'technician-signatures'
  ];
begin
  foreach bucket_name in array app_buckets loop
    execute format('drop policy if exists %I on storage.objects;', bucket_name || '_public_read');
    execute format(
      'create policy %I on storage.objects for select to public using (bucket_id = %L);',
      bucket_name || '_public_read',
      bucket_name
    );

    execute format('drop policy if exists %I on storage.objects;', bucket_name || '_authenticated_write');
    execute format(
      'create policy %I on storage.objects for all to authenticated using (bucket_id = %L) with check (bucket_id = %L);',
      bucket_name || '_authenticated_write',
      bucket_name,
      bucket_name
    );
  end loop;
end;
$$;
