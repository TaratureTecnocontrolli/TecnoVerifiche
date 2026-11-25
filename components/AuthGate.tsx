"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isViOnlyMode } from "@/lib/app-mode";
import { AppUserProvider, type AppUserProfile } from "@/lib/app-user";

type AuthGateProps = {
  children: React.ReactNode;
};

const VI_ONLY_BLOCKED_PREFIXES = [
  "/clienti",
  "/strumenti-cliente",
  "/importa/clienti",
  "/importa/strumenti-cliente",
];

const MASTER_ONLY_PREFIXES = [
  "/utenti",
  "/tecnici-firme",
  "/importa",
  "/audit-log",
  "/registro-attivita",
];

const MASTER_ONLY_EXACT_PATHS = ["/strumenti-cliente/nuovo", "/clienti/nuovo"];

function isBlockedInViMode(pathname: string) {
  if (!isViOnlyMode) return false;
  if (
    VI_ONLY_BLOCKED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    )
  ) {
    return true;
  }
  return /^\/verifiche\/[^/]+\/rapporto(?:\/|$)/.test(pathname);
}

function requiresMaster(pathname: string) {
  if (MASTER_ONLY_EXACT_PATHS.includes(pathname)) return true;
  return MASTER_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function normalizeProfile(data: unknown): AppUserProfile | null {
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object") return null;

  const profile = raw as Record<string, unknown>;
  const role =
    profile.role === "master"
      ? "master"
      : profile.role === "technician"
        ? "technician"
        : null;
  if (!role || typeof profile.user_id !== "string") return null;

  return {
    user_id: profile.user_id,
    email: typeof profile.email === "string" ? profile.email : null,
    role,
    technician_id:
      typeof profile.technician_id === "string" ? profile.technician_id : null,
    technician_name:
      typeof profile.technician_name === "string"
        ? profile.technician_name
        : null,
    technician_signature_url:
      typeof profile.technician_signature_url === "string"
        ? profile.technician_signature_url
        : null,
    is_active: profile.is_active === true,
  };
}

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isChecking, setIsChecking] = useState(true);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      setIsChecking(true);
      setAccessError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session) {
        setProfile(null);
        setIsChecking(false);
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.rpc("get_my_app_profile");
      if (!isMounted) return;

      if (error) {
        setProfile(null);
        setAccessError(
          "Profilo applicativo non disponibile. Verifica di aver eseguito la migrazione Fase B su Supabase."
        );
        setIsChecking(false);
        return;
      }

      const loadedProfile = normalizeProfile(data);

      if (!loadedProfile || !loadedProfile.is_active) {
        setProfile(null);
        setAccessError(
          "Account non configurato o disattivato. Contatta un profilo MASTER."
        );
        setIsChecking(false);
        return;
      }

      if (
        loadedProfile.role === "technician" &&
        (!loadedProfile.technician_id || !loadedProfile.technician_name)
      ) {
        setProfile(null);
        setAccessError(
          "Il profilo TECNICO non è associato a un nominativo tecnico valido. Contatta un profilo MASTER."
        );
        setIsChecking(false);
        return;
      }

      if (isBlockedInViMode(pathname)) {
        setProfile(null);
        setIsChecking(false);
        router.replace("/");
        return;
      }

      if (loadedProfile.role !== "master" && requiresMaster(pathname)) {
        setProfile(null);
        setIsChecking(false);
        router.replace("/");
        return;
      }

      setProfile(loadedProfile);
      setIsChecking(false);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        router.replace("/login");
        return;
      }

      void checkSession();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (isChecking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
          Verifica accesso in corso...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-950">Accesso non disponibile</h1>
          <p className="mt-2 text-sm text-red-800">{accessError || "Profilo non disponibile."}</p>
          <button
            type="button"
            onClick={() =>
              void supabase.auth
                .signOut()
                .then(() => router.replace("/login"))
            }
            className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Esci
          </button>
        </div>
      </div>
    );
  }

  if (isBlockedInViMode(pathname) || (profile.role !== "master" && requiresMaster(pathname))) return null;

  return <AppUserProvider profile={profile}>{children}</AppUserProvider>;
}
