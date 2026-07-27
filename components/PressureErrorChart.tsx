"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type PressurePointInput } from "@/lib/calculations/pressure";

type PressurePointResult = PressurePointInput & {
  maxReading: number | null;
  minReading: number | null;
  averageReading: number | null;
  meanError: number | null;
  accuracyErrorPercent: number | null;
  repeatabilityErrorPercent: number | null;
};

type PressureErrorChartProps = {
  points: PressurePointResult[];
  title?: string;
  lineColor?: string;
};

type ChartPoint = {
  label: string;
  value: number;
  appliedValue: number;
};

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

function formatItalianNumber(value: number | null | undefined, digits = 4) {
  const numericValue = toFiniteNumber(value);

  if (numericValue === null) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: digits,
  }).format(numericValue);
}

function buildChartPoints(points: PressurePointResult[]): ChartPoint[] {
  return points
    .map((point, index) => {
      const appliedValue = toFiniteNumber(point.appliedValue);
      const accuracyErrorPercent = toFiniteNumber(point.accuracyErrorPercent);

      if (accuracyErrorPercent === null) {
        return null;
      }

      return {
        label:
          appliedValue !== null
            ? formatItalianNumber(appliedValue, 2)
            : "Punto " + String(index + 1),
        value: accuracyErrorPercent,
        appliedValue: appliedValue ?? 0,
      };
    })
    .filter((point): point is ChartPoint => Boolean(point));
}

export default function PressureErrorChart({
  points,
  title = "Grafico errore accuratezza %",
  lineColor = "#0284c7",
}: PressureErrorChartProps) {
  const chartPoints = buildChartPoints(points);

  if (chartPoints.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        Nessun dato disponibile per il grafico.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartPoints} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              label={{
                value: "Punto di applicazione",
                position: "insideBottom",
                offset: -5,
                fontSize: 12,
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatItalianNumber(Number(value), 2)}
              label={{
                value: "Errore accuratezza %",
                angle: -90,
                position: "insideLeft",
                fontSize: 12,
              }}
            />
            <Tooltip
              formatter={(value) => [
                formatItalianNumber(Number(value), 4) + " %",
                "Errore accuratezza",
              ]}
              labelFormatter={(label) => "Punto: " + String(label)}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
