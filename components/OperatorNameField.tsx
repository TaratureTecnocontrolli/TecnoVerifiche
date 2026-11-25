"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppUser } from "@/lib/app-user";

type Technician = {
  id: string;
  full_name: string;
  is_active: boolean;
};

export default function OperatorNameField({
  value,
  onChange,
  label = "Tecnico",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}) {
  const { profile } = useAppUser();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (profile.role === "technician") {
      onChange(profile.technician_name ?? "");
      return;
    }

    let mounted = true;

    async function loadTechnicians() {
      const { data, error } = await supabase
        .from("calibration_technicians")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (!mounted) return;

      if (error) {
        setLoadError(error.message);
        return;
      }

      setTechnicians((data ?? []) as Technician[]);
    }

    void loadTechnicians();

    return () => {
      mounted = false;
    };
  }, [profile.role, profile.technician_name]);

  const knownNames = useMemo(
    () => new Set(technicians.map((technician) => technician.full_name)),
    [technicians]
  );

  if (profile.role === "technician") {
    return (
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <input
          value={profile.technician_name ?? "Profilo tecnico non associato"}
          readOnly
          className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800"
        />
        <span className="block text-xs text-slate-500">
          Il nominativo è collegato al tuo account e non può essere sostituito.
        </span>
      </label>
    );
  }

  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">Seleziona tecnico</option>
        {value && !knownNames.has(value) && <option value={value}>{value}</option>}
        {technicians.map((technician) => (
          <option key={technician.id} value={technician.full_name}>
            {technician.full_name}
          </option>
        ))}
      </select>
      {loadError && (
        <span className="block text-xs text-red-700">
          Errore caricamento tecnici: {loadError}
        </span>
      )}
    </label>
  );
}
