"use client";

import { type MeasurementLike } from "@/lib/chart-utils";

export type { MeasurementLike };

type MeasurementErrorChartProps = {
  measurements: MeasurementLike[];
  title?: string;
  lineColor?: string;
};

type ChartPoint = MeasurementLike & {
  xLabel: string;
  yValue: number;
};

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function formatNumber(value: number | null | undefined, digits = 3) {
  const numericValue = toFiniteNumber(value);

  if (numericValue === null) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: digits,
  }).format(numericValue);
}

function getPointLabel(measurement: MeasurementLike) {
  const xValue = measurement.applied_value ?? measurement.nominal_value ?? null;

  if (xValue !== null && xValue !== undefined && Number.isFinite(xValue)) {
    return formatNumber(xValue, 3);
  }

  return String(measurement.point_order || "-");
}

function inferLineColor(title: string, fallback: string) {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes("scarico")) {
    return "#0284c7";
  }

  if (normalizedTitle.includes("pressione") || normalizedTitle.includes("carico")) {
    return "#ea580c";
  }

  if (
    normalizedTitle.includes("dinamometr") ||
    normalizedTitle.includes("coppia") ||
    normalizedTitle.includes("massa") ||
    normalizedTitle.includes("bilance") ||
    normalizedTitle.includes("ct") ||
    normalizedTitle.includes("compressione") ||
    normalizedTitle.includes("trazione")
  ) {
    return "#d97706";
  }

  if (normalizedTitle.includes("portata") || normalizedTitle.includes("contalitri")) {
    return "#0284c7";
  }

  if (normalizedTitle.includes("dimension")) {
    return "#7c3aed";
  }

  if (normalizedTitle.includes("pull")) {
    return "#dc2626";
  }

  return fallback;
}

function buildChartPoints(measurements: MeasurementLike[]): ChartPoint[] {
  return measurements
    .map((measurement) => {
      const yValue = toFiniteNumber(measurement.accuracy_error_percent);

      if (yValue === null) {
        return null;
      }

      return {
        ...measurement,
        xLabel: getPointLabel(measurement),
        yValue,
      };
    })
    .filter((measurement): measurement is ChartPoint => Boolean(measurement))
    .sort((a, b) => a.point_order - b.point_order);
}

export default function MeasurementErrorChart({
  measurements,
  title = "Grafico errore accuratezza %",
  lineColor,
}: MeasurementErrorChartProps) {
  const chartMeasurements = buildChartPoints(measurements);

  if (chartMeasurements.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/45 text-sm text-slate-500">
        Grafico non disponibile: inserire i punti di misura.
      </div>
    );
  }

  const effectiveLineColor = lineColor ?? inferLineColor(title, "#0f172a");

  const width = 760;
  const height = 300;
  const paddingLeft = 58;
  const paddingRight = 26;
  const paddingTop = 28;
  const paddingBottom = 58;

  const yValues = chartMeasurements.map((measurement) => measurement.yValue);
  const maxAbsY = Math.max(1, ...yValues.map((value) => Math.abs(value)));
  const maxError = Math.max(...yValues.map((value) => Math.abs(value)));
  const maxErrorPoint = chartMeasurements.find(
    (measurement) => Math.abs(measurement.yValue) === maxError
  );

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  function xScale(index: number) {
    if (chartMeasurements.length === 1) {
      return paddingLeft + plotWidth / 2;
    }

    return paddingLeft + (plotWidth * index) / (chartMeasurements.length - 1);
  }

  function yScale(value: number) {
    return paddingTop + ((maxAbsY - value) / (maxAbsY * 2)) * plotHeight;
  }

  const zeroY = yScale(0);

  const polylinePoints = chartMeasurements
    .map((measurement, index) => `${xScale(index)},${yScale(measurement.yValue)}`)
    .join(" ");

  const showEveryLabel =
    chartMeasurements.length <= 12
      ? 1
      : chartMeasurements.length <= 24
        ? 2
        : Math.ceil(chartMeasurements.length / 12);

  return (
    <div className="rounded-xl border border-slate-200 bg-white/45 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-slate-800">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Asse X: punti di verifica - Asse Y: errore accuratezza %
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white/45 px-4 py-2 text-right text-xs text-slate-800">
          <p className="font-bold">Errore massimo assoluto</p>
          <p>
            {formatNumber(maxError, 3)} %
            {maxErrorPoint ? " al punto " + maxErrorPoint.point_order : ""}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[360px] w-full overflow-visible"
        role="img"
        aria-label={title}
      >
        <line
          x1={paddingLeft}
          y1={zeroY}
          x2={width - paddingRight}
          y2={zeroY}
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="5 5"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        <text
          x={paddingLeft - 8}
          y={paddingTop + 4}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          +{formatNumber(maxAbsY, 3)}%
        </text>

        <text
          x={paddingLeft - 8}
          y={zeroY + 4}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          0%
        </text>

        <text
          x={paddingLeft - 8}
          y={height - paddingBottom + 4}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          -{formatNumber(maxAbsY, 3)}%
        </text>

        <polyline
          points={polylinePoints}
          fill="none"
          stroke={effectiveLineColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chartMeasurements.map((measurement, index) => {
          const x = xScale(index);
          const y = yScale(measurement.yValue);
          const labelOffset = measurement.yValue >= 0 ? -10 : 18;

          return (
            <g key={measurement.id}>
              <circle cx={x} cy={y} r="4.5" fill={effectiveLineColor} />
              {chartMeasurements.length <= 14 && (
                <text
                  x={x}
                  y={y + labelOffset}
                  textAnchor="middle"
                  className="fill-slate-700 text-[10px] font-semibold"
                >
                  {formatNumber(measurement.yValue, 3)}%
                </text>
              )}
            </g>
          );
        })}

        {chartMeasurements.map((measurement, index) => {
          if (index % showEveryLabel !== 0) {
            return null;
          }

          return (
            <text
              key={"x-label-" + measurement.id}
              x={xScale(index)}
              y={height - 28}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {measurement.xLabel}
            </text>
          );
        })}

        <text
          x={paddingLeft}
          y={height - 8}
          className="fill-slate-500 text-[10px]"
        >
          Punto di verifica / valore applicato
        </text>
      </svg>
    </div>
  );
}
