# TecnoTarature

Gestionale interno per la gestione delle verifiche di taratura: anagrafica
clienti e strumenti, strumenti campione con scadenze certificati, verifiche
(compressione/trazione, pressione, chiavi dinamometriche, portata/contalitri,
temperatura, dimensionale, massa/bilance, prove sclerometriche, pull-off),
calcoli di errore e ripetibilità, rapporti di taratura e audit log.

Applicazione [Next.js](https://nextjs.org) con [Supabase](https://supabase.com)
come backend (database + storage dei certificati/firme).

## Requisiti

- Node.js 20+
- Un progetto Supabase (gratuito) con lo schema del database già creato

## Configurazione

1. Installa le dipendenze:

   ```bash
   npm install
   ```

2. Copia `.env.example` in `.env.local` e inserisci URL e anon key del tuo
   progetto Supabase (`Project Settings > API` su supabase.com):

   ```bash
   cp .env.example .env.local
   ```

   Senza queste due variabili (`NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) l'app non parte: `lib/supabase.ts` lancia
   un errore all'avvio se mancano.

3. Assicurati che sul progetto Supabase esistano le tabelle usate
   dall'applicazione (nessuna migrazione è versionata in questo repository,
   lo schema va gestito direttamente su Supabase):
   `customers`, `customer_sites`, `customer_instruments`,
   `reference_instruments`, `calibration_types`, `calibration_procedures`,
   `calibration_records`, `calibration_record_scales`,
   `calibration_measurements`, `calibration_report_details`,
   `calibration_report_settings`, `calibration_report_signatures`,
   `calibration_technicians`, `audit_logs`.

4. Avvia il server di sviluppo:

   ```bash
   npm run dev
   ```

   Apri [http://localhost:3000](http://localhost:3000).

## Script disponibili

- `npm run dev` — avvia il server di sviluppo (Turbopack)
- `npm run build` — build di produzione
- `npm run start` — avvia la build di produzione
- `npm run lint` — esegue eslint

## Moduli di verifica

| Modulo | Stato |
| --- | --- |
| Compressione / trazione (CT) | Attivo |
| Pressione / manometri | Attivo |
| Chiavi dinamometriche | Attivo |
| Portata / contalitri | Attivo |
| Temperatura | Attivo |
| Dimensionale | Attivo |
| Massa / bilance | Attivo |
| Prove sclerometriche | Attivo |
| Pull-off | Attivo |

## Flotta aziendale, attività di cantiere e calendario

Modulo per la gestione dei mezzi aziendali e la pianificazione delle attività
di cantiere / interventi tecnici, con assegnazione dei mezzi.

- **Flotta** (`/flotta`): anagrafica mezzi (targa, tipologia, alimentazione,
  km, autista abituale, colore nel calendario), stato (disponibile / in
  manutenzione / fuori servizio), scadenze di assicurazione, revisione, bollo
  e tagliando (per data e per km) con evidenza di quelle entro 30 giorni o
  superate, registro interventi e costi per mezzo.
- **Attività** (`/attivita`): elenco filtrabile delle attività con cliente,
  sede/cantiere, periodo, priorità, stato, tecnici (con capo squadra) e mezzi
  assegnati (con autista).
- **Calendario** (`/calendario`): vista mensile, planning settimanale per
  mezzo e per tecnico, creazione rapida cliccando su un giorno o sulla cella
  di un mezzo.

Durante l'assegnazione il sistema blocca le doppie prenotazioni di un mezzo,
i mezzi fuori servizio e quelli con assicurazione/revisione/bollo già scaduti
alla data dell'attività, e segnala come avviso i mezzi in manutenzione, le
scadenze che cadono durante l'attività e i tecnici già impegnati.

I tecnici sono quelli della tabella esistente `calibration_technicians`
(pagina "Tecnici e firme"); clienti e sedi sono quelli dell'anagrafica clienti.

**Setup database:** eseguire una volta nell'SQL Editor di Supabase lo script
`supabase/migrations/20261107_flotta_cantieri.sql`, che crea le tabelle
`fleet_vehicles`, `fleet_vehicle_logs`, `field_activities`,
`field_activity_technicians`, `field_activity_vehicles` con le relative
policy RLS per gli utenti autenticati.

## Deploy

Qualsiasi hosting compatibile con Next.js (es. [Vercel](https://vercel.com))
va bene; ricorda di impostare le stesse variabili d'ambiente
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) nel pannello del
provider di hosting.
