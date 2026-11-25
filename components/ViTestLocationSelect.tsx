"use client";

import { LAB_SITES } from "@/lib/lab-sites";

const TEST_LOCATIONS = LAB_SITES.map((site) => `Laboratorio ${site}`);

export function isViTestLocation(value: string): boolean {
  return TEST_LOCATIONS.includes(value);
}

export default function ViTestLocationSelect({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">Luogo prove *</span>
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="" disabled>Seleziona il laboratorio</option>
        {TEST_LOCATIONS.map((site) => (
          <option key={site} value={site}>{site}</option>
        ))}
      </select>
    </label>
  );
}
