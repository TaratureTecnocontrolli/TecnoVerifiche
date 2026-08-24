"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type CalibrationRecord = {
  id: string;
  status: string | null;
  report_status: string | null;
};

type ReferenceInstrument = {
  id: string;
  status: string | null;
  certificate_expiry: string | null;
  certificate_file_url: string | null;
};

type DashboardState = {
  records: CalibrationRecord[];
  referenceInstruments: ReferenceInstrument[];
  isLoading: boolean;
  error: string;
};

function daysToExpiry(date: string | null) {
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(date);
  expiry.setHours(0, 0, 0, 0);

  const differenceMs = expiry.getTime() - today.getTime();

  return Math.ceil(differenceMs / (1000 * 60 * 60 * 24));
}

function isReferenceInstrumentExpiring(instrument: ReferenceInstrument) {
  if (instrument.status === "out_of_service") {
    return false;
  }

  const days = daysToExpiry(instrument.certificate_expiry);

  if (days === null) {
    return false;
  }

  return days >= 0 && days <= 30;
}

function isReferenceInstrumentExpired(instrument: ReferenceInstrument) {
  if (instrument.status === "out_of_service") {
    return false;
  }

  const days = daysToExpiry(instrument.certificate_expiry);

  if (days === null) {
    return false;
  }

  return days < 0;
}

function StatCard({
  href,
  label,
  value,
  description,
  tone = "slate",
}: {
  href: string;
  label: string;
  value: number;
  description: string;
  tone?: "slate" | "emerald" | "amber" | "red" | "orange" | "blue";
}) {
  const styles = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950",
    orange: "border-orange-200 bg-orange-50 text-orange-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
  };

  return (
    <Link
      href={href}
      className={
        "group rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md " +
        styles[tone]
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-70">
            {label}
          </p>
          <p className="mt-2 text-4xl font-black tracking-tight">{value}</p>
        </div>

        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold opacity-80 transition group-hover:opacity-100">
          Apri
        </span>
      </div>

      <p className="mt-3 text-sm leading-5 opacity-75">{description}</p>
    </Link>
  );
}

function QuickActionCard({
  href,
  kicker,
  title,
  description,
  primary = false,
}: {
  href: string;
  kicker: string;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "group rounded-2xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md " +
        (primary
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950")
      }
    >
      <p
        className={
          "text-xs font-black uppercase tracking-wide " +
          (primary ? "text-slate-300" : "text-slate-500")
        }
      >
        {kicker}
      </p>

      <h2 className="mt-2 text-xl font-black">{title}</h2>

      <p
        className={
          "mt-2 text-sm leading-6 " +
          (primary ? "text-slate-300" : "text-slate-600")
        }
      >
        {description}
      </p>

      <div
        className={
          "mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-bold transition " +
          (primary
            ? "bg-white text-slate-950 group-hover:bg-slate-100"
            : "bg-slate-100 text-slate-800 group-hover:bg-slate-200")
        }
      >
        Vai →
      </div>
    </Link>
  );
}

function RegistryCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
    </Link>
  );
}

export default function HomePage() {
  const [state, setState] = useState<DashboardState>({
    records: [],
    referenceInstruments: [],
    isLoading: true,
    error: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: "",
      }));

      const { data: recordsData, error: recordsError } = await supabase
        .from("calibration_records")
        .select("id, status, report_status");

      if (recordsError) {
        if (isMounted) {
          setState({
            records: [],
            referenceInstruments: [],
            isLoading: false,
            error: "Errore caricamento verifiche: " + recordsError.message,
          });
        }

        return;
      }

      const { data: referenceInstrumentsData, error: referenceError } =
        await supabase
          .from("reference_instruments")
          .select("id, status, certificate_expiry, certificate_file_url");

      if (referenceError) {
        if (isMounted) {
          setState({
            records: (recordsData ?? []) as CalibrationRecord[],
            referenceInstruments: [],
            isLoading: false,
            error:
              "Errore caricamento strumenti campione: " +
              referenceError.message,
          });
        }

        return;
      }

      if (isMounted) {
        setState({
          records: (recordsData ?? []) as CalibrationRecord[],
          referenceInstruments:
            (referenceInstrumentsData ?? []) as ReferenceInstrument[],
          isLoading: false,
          error: "",
        });
      }
    }

    void loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const records = state.records;
    const referenceInstruments = state.referenceInstruments;

    const draftRecords = records.filter((record) => {
      return (
        record.status === "draft" ||
        record.report_status === "draft" ||
        record.report_status === "reopened"
      );
    }).length;

    const issuedReports = records.filter((record) => {
      return record.report_status === "issued";
    }).length;

    const readyReports = records.filter((record) => {
      return record.report_status === "ready";
    }).length;

    const expiringReferences = referenceInstruments.filter(
      isReferenceInstrumentExpiring
    ).length;

    const expiredReferences = referenceInstruments.filter(
      isReferenceInstrumentExpired
    ).length;

    const missingCertificateFiles = referenceInstruments.filter(
      (instrument) => !instrument.certificate_file_url
    ).length;

    return {
      totalRecords: records.length,
      draftRecords,
      issuedReports,
      readyReports,
      expiringReferences,
      expiredReferences,
      missingCertificateFiles,
    };
  }, [state.records, state.referenceInstruments]);

  return (
    <AppShell>
      <div className="space-y-8">
        {state.error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-900">
            {state.error}
          </section>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="p-7 lg:p-8">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                Gestionale interno
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                TecnoVerifiche
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                Software interno per gestione verifiche di taratura,
                elaborazione risultati, misure, foto, rapporti finali,
                rapportini VI e tracciabilità tecnica.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/nuova-verifica"
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Nuova verifica
                </Link>

                <Link
                  href="/verifiche"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                >
                  Verifiche aperte
                </Link>

                <Link
                  href="/rapporti"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                >
                  Archivio rapporti
                </Link>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-950 p-7 text-white lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Stato archivio
              </p>

              <p className="mt-4 text-5xl font-black">
                {state.isLoading ? "..." : stats.totalRecords}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                verifiche totali registrate nel gestionale
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-slate-400">Pronte</p>
                  <p className="mt-1 text-2xl font-black">
                    {state.isLoading ? "..." : stats.readyReports}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-slate-400">Emesse</p>
                  <p className="mt-1 text-2xl font-black">
                    {state.isLoading ? "..." : stats.issuedReports}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            href="/verifiche"
            label="Bozze / da correggere"
            value={state.isLoading ? 0 : stats.draftRecords}
            description="Verifiche da completare o rapporti riaperti."
            tone="slate"
          />

          <StatCard
            href="/rapporti"
            label="Rapporti emessi"
            value={state.isLoading ? 0 : stats.issuedReports}
            description="Documenti considerati ufficialmente emessi."
            tone="emerald"
          />

          <StatCard
            href="/strumenti-campione"
            label="Campioni in scadenza"
            value={state.isLoading ? 0 : stats.expiringReferences}
            description="Certificati in scadenza entro 30 giorni."
            tone="amber"
          />

          <StatCard
            href="/strumenti-campione"
            label="Campioni scaduti"
            value={state.isLoading ? 0 : stats.expiredReferences}
            description="Campioni da verificare prima dell'utilizzo."
            tone="red"
          />

          <StatCard
            href="/strumenti-campione"
            label="Certificati mancanti"
            value={state.isLoading ? 0 : stats.missingCertificateFiles}
            description="Strumenti senza file certificato allegato."
            tone="orange"
          />
        </section>

        <section>
          <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                Azioni rapide
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Lavoro operativo
              </h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <QuickActionCard
              href="/nuova-verifica"
              kicker="Avvio guidato"
              title="Nuova verifica"
              description="Scegli il modulo corretto e compila dati tecnici, misure, foto e rapporti."
              primary
            />

            <QuickActionCard
              href="/verifiche"
              kicker="Lavorazioni"
              title="Verifiche elaborate"
              description="Riprendi verifiche in bozza, completa misure, controlla rapporti e rapportini."
            />
          </div>
        </section>

        <section>
          <div className="mb-4">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">
              Anagrafiche e configurazioni
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Archivi principali
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <RegistryCard
              href="/clienti"
              title="Clienti"
              description="Anagrafiche, numero cliente, sedi e riferimenti."
            />

            <RegistryCard
              href="/strumenti-cliente"
              title="Strumenti cliente"
              description="Strumenti da verificare, dati tecnici e matricole."
            />

            <RegistryCard
              href="/strumenti-campione"
              title="Strumenti campione"
              description="Campioni, certificati, scadenze e stato operativo."
            />

            <RegistryCard
              href="/tecnici-firme"
              title="Tecnici e firme"
              description="Firme digitalizzate e direttore di laboratorio."
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}