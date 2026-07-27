"use client";

import { useMemo } from "react";
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

type ForceChartPoint = {
  id?: string;
  point_order?: number | null;
  nominalValue?: number | null;
  nominal_value?: number | null;
  appliedValue?: number | null;
  applied_value?: number | null;
  accuracyErrorPercent?: number | null;
  accuracy_error_percent?: number | null;
};

type ForceErrorChartProps = {
  points: ForceChartPoint[];
  title?: string;
  lineColor?: string;
};

type ChartPoint = {
  label: string;
  value: number;
  nominalValue: number;
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

function normalizeLineColor(lineColor: string | undefined) {
  if (!lineColor) {
    return "#d97706";
  }

  const colors: Record<string, string> = {
    amber: "#d97706",
    orange: "#ea580c",
    sky: "#0284c7",
    blue: "#2563eb",
    emerald: "#059669",
    green: "#16a34a",
    red: "#dc2626",
    slate: "#0f172a",
    violet: "#7c3aed",
    purple: "#9333ea",
  };

  return colors[lineColor] ?? lineColor;
}

function buildChartPoints(points: ForceChartPoint[]): ChartPoint[] {
  const safePoints = Array.isArray(points) ? points : [];

  return safePoints
    .map((point, index) => {
      const nominalValue = toFiniteNumber(
        point.nominalValue ?? point.nominal_value
      );
      const appliedValue = toFiniteNumber(
        point.appliedValue ?? point.applied_value
      );
      const accuracyErrorPercent = toFiniteNumber(
        point.accuracyErrorPercent ?? point.accuracy_error_percent
      );

      if (accuracyErrorPercent === null) {
        return null;
      }

      const xValue = appliedValue ?? nominalValue;

      return {
        label:
          xValue !== null
            ? formatItalianNumber(xValue, 2)
            : "Punto " + String(point.point_order ?? index + 1),
        value: accuracyErrorPercent,
        nominalValue: nominalValue ?? 0,
        appliedValue: appliedValue ?? nominalValue ?? 0,
      };
    })
    .filter((point): point is ChartPoint => Boolean(point));
}

function buildChartVersion(points: ChartPoint[]) {
  return points
    .map((point) => {
      return [
        point.label,
        point.value,
        point.nominalValue,
        point.appliedValue,
      ].join(":");
    })
    .join("|");
}

export default function ForceErrorChart({
  points,
  title = "Grafico errore accuratezza",
  lineColor = "#d97706",
}: ForceErrorChartProps) {
  const chartPoints = useMemo(() => buildChartPoints(points), [points]);
  const chartVersion = useMemo(() => buildChartVersion(chartPoints), [chartPoints]);
  const effectiveLineColor = normalizeLineColor(lineColor);

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
          <LineChart
            key={chartVersion}
            data={chartPoints}
            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          >
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
              stroke={effectiveLineColor}
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
