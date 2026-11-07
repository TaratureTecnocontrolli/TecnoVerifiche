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

## Deploy

Qualsiasi hosting compatibile con Next.js (es. [Vercel](https://vercel.com))
va bene; ricorda di impostare le stesse variabili d'ambiente
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) nel pannello del
provider di hosting.
