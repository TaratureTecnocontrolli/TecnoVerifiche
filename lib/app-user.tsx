"use client";

import { createContext, useContext } from "react";

export type AppRole = "master" | "technician";

export type AppUserProfile = {
  user_id: string;
  email: string | null;
  role: AppRole;
  technician_id: string | null;
  technician_name: string | null;
  technician_signature_url: string | null;
  is_active: boolean;
};

type AppUserContextValue = {
  profile: AppUserProfile;
};

const AppUserContext = createContext<AppUserContextValue | null>(null);

export function AppUserProvider({
  profile,
  children,
}: {
  profile: AppUserProfile;
  children: React.ReactNode;
}) {
  return (
    <AppUserContext.Provider value={{ profile }}>
      {children}
    </AppUserContext.Provider>
  );
}

export function useAppUser() {
  const context = useContext(AppUserContext);

  if (!context) {
    throw new Error("useAppUser deve essere usato all'interno di AuthGate.");
  }

  return context;
}

export function isMasterProfile(profile: AppUserProfile) {
  return profile.role === "master";
}
