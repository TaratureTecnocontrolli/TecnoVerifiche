"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SuiteIcon } from "@/components/SuiteIcon";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAppUser } from "@/lib/app-user";

type CalibrationRecord = {
  id: string;
  status: string | null;
  report_status: string | null;
  verification_scope: string | null;
};

type ReferenceInstrument = {
  id: string;
  name: string | null;
  internal_code: string | null;
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
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(date);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateLabel(days: number | null) {
  if (days === null) return "Senza data";
  if (days < 0) return "Scaduto";
  if (days === 0) return "Scade oggi";
  if (days === 1) return "Scade domani";
  return `Scade tra ${days} gg`;
}

function KpiCard({title, value, subtitle, tone, href, icon}: {
  title: string; value: string | number; subtitle: string;
  tone: "slate" | "green" | "amber" | "red"; href: string; icon: string;
}) {
  return <Link href={href} className="tc-kpi">
    <span className={"tc-kpi-icon tc-tone-" + tone}><SuiteIcon icon={icon} /></span>
    <div className="min-w-0"><p className="tc-kpi-value">{value}</p><p className="tc-kpi-title">{title}</p><p className="tc-kpi-description">{subtitle}</p></div>
    <span className="tc-kpi-arrow"><SuiteIcon icon="arrow" /></span>
  </Link>;
}

function SectionCard({title, icon, children}: {title: string; icon: string; children: React.ReactNode}) {
  return <section className="tc-dashboard-panel"><h2 className="tc-section-heading"><SuiteIcon icon={icon} />{title}</h2>{children}</section>;
}

function HomeContent() {
  const { profile } = useAppUser();
  const isMaster = profile.role === "master";
  const [state, setState] = useState<DashboardState>({
    records: [],
    referenceInstruments: [],
    isLoading: true,
    error: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setState((currentState) => ({ ...currentState, isLoading: true, error: "" }));

      const { data: recordsData, error: recordsError } = await supabase
        .from("calibration_records")
        .select("id, status, report_status, verification_scope")
        .eq("verification_scope", "VI");

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

      const { data: referenceInstrumentsData, error: referenceError } = await supabase
        .from("reference_instruments")
        .select("id, name, internal_code, status, certificate_expiry, certificate_file_url");

      if (referenceError) {
        if (isMounted) {
          setState({
            records: (recordsData ?? []) as CalibrationRecord[],
            referenceInstruments: [],
            isLoading: false,
            error: "Errore caricamento strumenti campione: " + referenceError.message,
          });
        }
        return;
      }

      if (isMounted) {
        setState({
          records: (recordsData ?? []) as CalibrationRecord[],
          referenceInstruments: (referenceInstrumentsData ?? []) as ReferenceInstrument[],
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
    const draftRecords = state.records.filter(
      (record) =>
        record.report_status !== "issued" && (record.status === "draft" ||
        record.report_status === "draft" ||
        record.report_status === "reopened")
    ).length;

    const readyReports = state.records.filter((record) => record.report_status === "ready").length;
    const issuedReports = state.records.filter((record) => record.report_status === "issued").length;

    const referenceSummaries = state.referenceInstruments.map((instrument) => ({
      ...instrument,
      days: daysToExpiry(instrument.certificate_expiry),
    }));

    const expiringReferences = referenceSummaries.filter(
      (item) => item.status !== "out_of_service" && item.days !== null && item.days >= 0 && item.days <= 30
    );

    const expiredReferences = referenceSummaries.filter(
      (item) => item.status !== "out_of_service" && item.days !== null && item.days < 0
    );

    const upcoming = [...expiringReferences]
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
      .slice(0, 4);

    const chart = [
      { label: "0–30 gg", min: 0, max: 30 },
      { label: "31–60 gg", min: 31, max: 60 },
      { label: "61–90 gg", min: 61, max: 90 },
    ].map(({label, min, max}) => ({ label, value: referenceSummaries.filter(
      (item) => item.status !== "out_of_service" && item.days !== null && item.days >= min && item.days <= max
    ).length }));

    return {
      totalRecords: state.records.length,
      draftRecords,
      readyReports,
      issuedReports,
      expiringReferences: expiringReferences.length,
      expiredReferences: expiredReferences.length,
      upcoming,
      chart,
    };
  }, [state.records, state.referenceInstruments]);

  const maxChartValue = Math.max(...stats.chart.map((item) => item.value), 1);

  const display = (value: number) => state.isLoading || state.error ? "—" : value;
  const actions: {href: string; icon: string; label: string; primary?: boolean}[] = [
    {href: "/nuova-verifica", icon: "plus", label: "Nuova verifica interna", primary: true},
    {href: "/verifiche", icon: "checklist", label: "Archivio verifiche"},
    {href: "/strumenti-interni", icon: "tool", label: "Strumenti interni"},
    {href: "/strumenti-campione", icon: "calendar", label: "Campioni e LAT"},
    {href: "/rapporti", icon: "report", label: "Rapportini VI"},
    ...(isMaster ? [{href: "/registro-attivita", icon: "activity", label: "Registro attività"}] : []),
  ];
  return (
    <div className="tc-dashboard">
      <div className="tc-dashboard-title"><div><p className="tc-eyebrow">METROLOGIA / OPERATIVO</p><h1>Dashboard</h1><p>Verifiche interne, rapportini e certificati LAT.</p></div><Link href="/nuova-verifica" className="tc-action tc-action-primary"><SuiteIcon icon="plus" /> Nuova VI</Link></div>
      {state.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{state.error}</div>}
      <div className="tc-kpi-grid">
        <KpiCard title="Strumenti campione" value={display(state.referenceInstruments.length)} subtitle="Archivio campioni" tone="slate" href="/strumenti-campione" icon="gauge" />
        <KpiCard title="VI da completare" value={display(stats.draftRecords)} subtitle="Bozze o riaperture" tone="green" href="/verifiche" icon="checklist" />
        <KpiCard title="LAT in scadenza" value={display(stats.expiringReferences)} subtitle="Entro 30 giorni" tone="amber" href="/strumenti-campione" icon="calendar" />
        <KpiCard title="Rapportini emessi" value={display(stats.issuedReports)} subtitle="Documenti ufficiali" tone="red" href="/rapporti" icon="report" />
      </div>
      <div className="tc-dashboard-grid">
        <SectionCard title="Scadenze LAT · prossimi 90 giorni" icon="chart">
          {state.isLoading || state.error ? <p className="tc-empty">{state.isLoading ? "Caricamento dati…" : "Dati non disponibili"}</p> : <div className="tc-chart" role="img" aria-label={stats.chart.map(x=>x.label+": "+x.value).join(", ")}>
            {stats.chart.map((item,index)=><div className="tc-chart-column" key={item.label}><div className="tc-chart-track"><span>{item.value}</span><div className={"tc-chart-bar tc-chart-bar-"+index} style={{height: `${item.value/maxChartValue*112}px`}} /></div><span className="tc-chart-label">{item.label}</span></div>)}
          </div>}
          <div className="tc-section-footer"><span className="text-sm text-slate-600">Campioni scaduti: <strong className={stats.expiredReferences ? "text-red-700" : ""}>{display(stats.expiredReferences)}</strong></span><Link href="/strumenti-campione">Archivio campioni <SuiteIcon icon="arrow" /></Link></div>
        </SectionCard>
        <SectionCard title="Prossime scadenze" icon="calendar">
          {state.isLoading || state.error ? <p className="tc-empty">{state.isLoading ? "Caricamento dati…" : "Dati non disponibili"}</p> : stats.upcoming.length===0 ? <p className="tc-empty">Nessun certificato in scadenza entro 30 giorni.</p> : <div className="tc-expiry-list">{stats.upcoming.map(item=><Link key={item.id} href={`/strumenti-campione/${item.id}`}><span className="tc-expiry-icon"><SuiteIcon icon="calendar" /></span><span className="min-w-0 flex-1"><strong>{item.name || `Campione ${item.id.slice(0,8).toUpperCase()}`}{item.internal_code ? ` · ${item.internal_code}` : ""}</strong><small>{item.certificate_expiry ? new Date(item.certificate_expiry).toLocaleDateString("it-IT", {timeZone:"UTC"}) : "—"}</small></span><span className="tc-expiry-badge">{formatDateLabel(item.days)}</span></Link>)}</div>}
          <div className="tc-section-footer"><span className="text-sm text-slate-600">Rapportini pronti: <strong>{display(stats.readyReports)}</strong></span><Link href="/rapporti">Rapportini <SuiteIcon icon="arrow" /></Link></div>
        </SectionCard>
      </div>
      <SectionCard title="Azioni rapide" icon="activity"><div className="tc-quick-actions">{actions.map(action=><Link key={action.href} href={action.href} className={"tc-action "+(action.primary ? "tc-action-primary" : "")}><SuiteIcon icon={action.icon} />{action.label}</Link>)}</div></SectionCard>
    </div>
  );
}

export default function HomePage() {
  return <AppShell><HomeContent /></AppShell>;
}
