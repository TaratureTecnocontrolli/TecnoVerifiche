"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForcePointResult } from "@/lib/calculations/force";

type ForceErrorChartProps = {
  points: ForcePointResult[];
};

export default function ForceErrorChart({ points }: ForceErrorChartProps) {
  const data = points.map((point) => ({
    name: point.nominalValue,
    erroreAccuratezza: point.accuracyErrorPercent,
    ripetibilita: point.repeatabilityErrorPercent,
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Grafico errori</h2>
        <p className="text-sm text-slate-500">
          Andamento errore accuratezza e ripetibilità sui punti verificati.
        </p>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              label={{
                value: "Punto nominale",
                position: "insideBottom",
                offset: -5,
              }}
            />
            <YAxis
              label={{
                value: "%",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="erroreAccuratezza"
              name="Errore accuratezza %"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="ripetibilita"
              name="Ripetibilità %"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}