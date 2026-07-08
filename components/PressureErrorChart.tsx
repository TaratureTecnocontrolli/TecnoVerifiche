"use client";

import type { PressurePointResult } from "@/lib/calculations/pressure";

type PressureErrorChartProps = {
  points: PressurePointResult[];
  title?: string;
};

function formatItalianNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 4,
  }).format(value);
}

export default function PressureErrorChart({
  points,
  title = "Grafico errore accuratezza %",
}: PressureErrorChartProps) {
  const chartPoints = points.filter(
    (point) =>
      Number.isFinite(point.appliedValue) &&
      Number.isFinite(point.accuracyErrorPercent)
  );

  if (chartPoints.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Inserisci i punti di misura per visualizzare il grafico.
      </div>
    );
  }

  const width = 760;
  const height = 260;
  const paddingLeft = 52;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 42;

  const xValues = chartPoints.map((point) => point.appliedValue);
  const yValues = chartPoints.map((point) => point.accuracyErrorPercent);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const maxAbsY = Math.max(1, ...yValues.map((value) => Math.abs(value)));

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  function xScale(value: number) {
    if (maxX === minX) {
      return paddingLeft + plotWidth / 2;
    }

    return paddingLeft + ((value - minX) / (maxX - minX)) * plotWidth;
  }

  function yScale(value: number) {
    return paddingTop + ((maxAbsY - value) / (maxAbsY * 2)) * plotHeight;
  }

  const zeroY = yScale(0);

  const polylinePoints = chartPoints
    .map((point) => {
      const x = xScale(point.appliedValue);
      const y = yScale(point.accuracyErrorPercent);

      return x + "," + y;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {title}
          </h3>
          <p className="text-xs text-slate-500">
            Asse X: carico applicato · Asse Y: errore accuratezza %
          </p>
        </div>

        <div className="text-right text-xs text-slate-500">
          <p>Min: {formatItalianNumber(minX)}</p>
          <p>Max: {formatItalianNumber(maxX)}</p>
        </div>
      </div>

      <svg
        viewBox={"0 0 " + width + " " + height}
        className="h-64 w-full"
        role="img"
        aria-label="Grafico errore accuratezza pressione"
      >
        <line
          x1={paddingLeft}
          y1={zeroY}
          x2={width - paddingRight}
          y2={zeroY}
          stroke="currentColor"
          className="text-slate-300"
          strokeWidth="1"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="currentColor"
          className="text-slate-300"
          strokeWidth="1"
        />

        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="currentColor"
          className="text-slate-300"
          strokeWidth="1"
        />

        <polyline
          points={polylinePoints}
          fill="none"
          stroke="currentColor"
          className="text-slate-900"
          strokeWidth="2"
        />

        {chartPoints.map((point) => {
          const x = xScale(point.appliedValue);
          const y = yScale(point.accuracyErrorPercent);

          return (
            <circle
              key={point.id}
              cx={x}
              cy={y}
              r="4"
              fill="currentColor"
              className="text-slate-900"
            />
          );
        })}

        <text x={paddingLeft} y={height - 12} className="fill-slate-500 text-xs">
          {formatItalianNumber(minX)}
        </text>

        <text
          x={width - paddingRight - 64}
          y={height - 12}
          className="fill-slate-500 text-xs"
        >
          {formatItalianNumber(maxX)}
        </text>

        <text x="8" y={paddingTop + 8} className="fill-slate-500 text-xs">
          +{formatItalianNumber(maxAbsY)}%
        </text>

        <text x="8" y={height - paddingBottom} className="fill-slate-500 text-xs">
          -{formatItalianNumber(maxAbsY)}%
        </text>
      </svg>
    </div>
  );
}