"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { SuiteIcon } from "@/components/SuiteIcon";
import LogoutButton from "@/components/LogoutButton";
import { isViOnlyMode } from "@/lib/app-mode";
import { useAppUser } from "@/lib/app-user";

type AppShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const OPERATIVE_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/nuova-verifica", label: "Nuova VI", icon: "plus" },
  { href: "/verifiche", label: "Verifiche interne", icon: "checklist" },
  { href: "/rapporti", label: "Rapportini VI", icon: "report" },
];

const REGISTRY_ITEMS: NavItem[] = [
  { href: "/strumenti-interni", label: "Strumenti interni", icon: "tool" },
  { href: "/strumenti-campione", label: "Strumenti campione / LAT", icon: "calendar" },
  { href: "/tecnici-firme", label: "Tecnici e firme", icon: "users" },
];

const MASTER_ITEMS: NavItem[] = [
  { href: "/registro-attivita", label: "Registro attività", icon: "activity" },
  { href: "/importa", label: "Importazioni", icon: "upload" },
  { href: "/utenti", label: "Utenti e permessi", icon: "lock" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={"tc-nav-link " + (active ? "tc-nav-active" : "")}>
      <SuiteIcon icon={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const { profile } = useAppUser();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const update = () => {
      setShowBackToTop(pathname !== "/" && Math.max(main.scrollTop, window.scrollY, ...Array.from(main.querySelectorAll<HTMLElement>(".tc-sticky-table"), el=>el.scrollTop)) > 200);
    };
    main.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      main.removeEventListener("scroll", update, true);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  function scrollToTop() {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    mainRef.current?.querySelectorAll<HTMLElement>(".tc-sticky-table").forEach(el=>el.scrollTo({top:0,behavior}));
    mainRef.current?.scrollTo({ top: 0, behavior });
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior });
  }
  const isMaster = profile.role === "master";
  const fullName = profile.technician_name || profile.email || "Utente";
  const groups = [
    { title: "Operativo", items: OPERATIVE_ITEMS },
    { title: "Strumentazione", items: REGISTRY_ITEMS.filter(item => item.href !== "/tecnici-firme") },
    { title: "Gestione metrologica", items: [
      { href: "/registro-metrologico/interni", label: "Registro strumenti interni", icon: "checklist" },
      { href: "/registro-metrologico/campioni", label: "Registro campioni", icon: "calendar" },
    ] },
    ...(isMaster ? [{ title: "Amministrazione", items: [...REGISTRY_ITEMS.filter(item => item.href === "/tecnici-firme"), ...MASTER_ITEMS] }] : []),
  ];
  const navigation = groups.map(group => (
    <div key={group.title} className="tc-nav-group">
      <p>{group.title}</p>
      {group.items.map(item => <NavLink key={item.href} item={item} pathname={pathname} />)}
    </div>
  ));

  return (
    <div className={"tc-shell" + (pathname === "/" ? " tc-shell-dashboard" : "")}>
      <header className="tc-banner print-hidden">
        <Link href="/" className="tc-brand-link" aria-label="Dashboard Gestionale Metrologico">
          <Image
            src="/images/metrologico-shield.png"
            alt="Simbolo gestionale metrologico"
            width={220}
            height={220}
            className="tc-brand-shield"
            priority
          />
          <div className="tc-brand-text">
            <Image
              src="/images/tecnocontrolli-logo.png"
              alt="Tecnocontrolli"
              width={314}
              height={160}
              className="tc-brand-company-logo"
              priority
            />
            <p className="tc-brand-module">Gestionale Metrologico</p>
            <p className="tc-brand-description">Sistema integrato per la gestione delle Tarature interne, delle Verifiche Interne e delle Tarature LAT.</p>
          </div>
        </Link>
      </header>
      <div className="tc-shell-body">
        <aside className="tc-sidebar print-hidden">
          <div className="tc-sidebar-top"><span>SUITE GESTIONALI</span><span className="tc-sidebar-dot" /></div>
          <nav aria-label="Menu principale" className="tc-sidebar-nav">{navigation}</nav>
          <div className="tc-sidebar-account">
            <p className="tc-account-name" title={fullName}>{fullName}</p>
            <p className="tc-account-role">{isMaster ? "MASTER" : "TECNICO"} · {isViOnlyMode ? "VI" : "Operativo"}</p>
            <LogoutButton />
          </div>
        </aside>
        <div className="tc-shell-content">
          <details className="tc-mobile-nav print-hidden" key={pathname}>
            <summary><SuiteIcon icon="menu" /> Menu <span>{isMaster ? "MASTER" : "TECNICO"}</span></summary>
            <nav aria-label="Navigazione mobile">{navigation}<div className="p-3"><LogoutButton /></div></nav>
          </details>
          <main ref={mainRef} className="tc-main" tabIndex={0} aria-label="Area di lavoro">{children}</main>
          {showBackToTop && (
            <button type="button" className="tc-back-to-top print-hidden" onClick={scrollToTop} aria-label="Torna in alto" title="Torna in alto">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20V4m-7 7 7-7 7 7" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: AppShellProps) {
  return <AuthGate><AppShellContent>{children}</AppShellContent></AuthGate>;
}
