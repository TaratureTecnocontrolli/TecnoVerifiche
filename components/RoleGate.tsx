"use client";

import { useAppUser, type AppRole } from "@/lib/app-user";

export default function RoleGate({
  allow,
  children,
  fallback = null,
}: {
  allow: AppRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { profile } = useAppUser();

  if (!allow.includes(profile.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
