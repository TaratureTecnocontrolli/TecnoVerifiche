"use client";

import { type MeasurementLike } from "@/lib/chart-utils";

export type { MeasurementLike };

type MeasurementErrorChartProps = {
  measurements: MeasurementLike[];
  title?: string;
};

function formatNumber(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: digits,
  }).format(value);
}

function getXValue(measurement: MeasurementLike) {
  return measurement.applied_value ?? measurement.nominal_value ?? null;
}

export default function MeasurementErrorChart({
  measurements,
  title = "Grafico errore accuratezza %",
}: MeasurementErrorChartProps) {
  const chartMeasurements = measurements
    .map((measurement) => ({
      ...measurement,
      xValue: getXValue(measurement),
      yValue: measurement.accuracy_error_percent,
    }))
    .filter(
      (
        measurement
      ): measurement is MeasurementLike & {
        xValue: number;
        yValue: number;
      } => measurement.xValue !== null && measurement.yValue !== null
    )
    .sort((a, b) => a.point_order - b.point_order);

  if (chartMeasurements.length === 0) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 text-sm text-slate-500">
        Grafico non disponibile: inserire i punti di misura.
      </div>
    );
  }

  const width = 660;
  const height = 360;
  const paddingLeft = 64;
  const paddingRight = 34;
  const paddingTop = 54;
  const paddingBottom = 60;

  const xValues = chartMeasurements.map((measurement) => measurement.xValue);
  const yValues = chartMeasurements.map((measurement) => measurement.yValue);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const maxAbsY = Math.max(1, ...yValues.map((value) => Math.abs(value)));
  const maxError = Math.max(...yValues.map((value) => Math.abs(value)));
  const maxErrorPoint = chartMeasurements.find(
    (measurement) => Math.abs(measurement.yValue) === maxError
  );

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

  const points = chartMeasurements
    .map((measurement) => `${xScale(measurement.xValue)},${yScale(measurement.yValue)}`)
    .join(" ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-slate-800">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Asse X: valore applicato / nominale - Asse Y: errore accuratezza %
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-800">
          <p className="font-bold">Errore massimo assoluto</p>
          <p>
            {formatNumber(maxError, 4)} %
            {maxErrorPoint ? " al punto " + maxErrorPoint.point_order : ""}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[520px] w-full overflow-visible"
        role="img"
        aria-label={title}
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
          points={points}
          fill="none"
          stroke="currentColor"
          className="text-slate-950"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chartMeasurements.map((measurement) => {
          const x = xScale(measurement.xValue);
          const y = yScale(measurement.yValue);

          return (
            <g key={measurement.id}>
              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill="currentColor"
                className="text-slate-950"
              />
              <text
                x={x}
                y={y - 11}
                textAnchor="middle"
                className="fill-slate-700 text-[10px] font-semibold"
              >
                {formatNumber(measurement.yValue, 3)}%
              </text>
            </g>
          );
        })}

        <text x={paddingLeft} y={height - 22} textAnchor="middle" className="fill-slate-500 text-[10px]">
          {formatNumber(minX)}
        </text>

        <text x={width - paddingRight} y={height - 22} textAnchor="middle" className="fill-slate-500 text-[10px]">
          {formatNumber(maxX)}
        </text>

        <text x="6" y={paddingTop + 4} className="fill-slate-500 text-[10px]">
          +{formatNumber(maxAbsY)}%
        </text>

        <text x="6" y={height - paddingBottom} className="fill-slate-500 text-[10px]">
          -{formatNumber(maxAbsY)}%
        </text>
      </svg>
    </div>
  );
}
