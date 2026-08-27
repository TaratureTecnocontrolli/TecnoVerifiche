"use client";

export type TemperatureErrorMeasurement = {
  id: string;
  point_order: number | null;
  applied_value: number | null;
  mean_error: number | null;
};

type TemperatureErrorChartProps = {
  measurements: TemperatureErrorMeasurement[];
  title?: string;
  compact?: boolean;
};

type ChartPoint = {
  id: string;
  pointOrder: number;
  appliedTemperature: number;
  error: number;
};

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function buildChartPoints(
  measurements: TemperatureErrorMeasurement[]
): ChartPoint[] {
  return measurements
    .map((measurement) => {
      if (
        measurement.applied_value === null ||
        measurement.mean_error === null ||
        !Number.isFinite(measurement.applied_value) ||
        !Number.isFinite(measurement.mean_error)
      ) {
        return null;
      }

      return {
        id: measurement.id,
        pointOrder: Number(measurement.point_order ?? 0),
        appliedTemperature: measurement.applied_value,
        error: measurement.mean_error,
      };
    })
    .filter((point): point is ChartPoint => Boolean(point))
    .sort((a, b) => {
      if (a.appliedTemperature !== b.appliedTemperature) {
        return a.appliedTemperature - b.appliedTemperature;
      }

      return a.pointOrder - b.pointOrder;
    });
}

export default function TemperatureErrorChart({
  measurements,
  title = "Grafico errore di temperatura",
  compact = false,
}: TemperatureErrorChartProps) {
  const points = buildChartPoints(measurements);

  if (points.length === 0) {
    return null;
  }

  const width = 760;
  const height = compact ? 210 : 300;
  const paddingLeft = 60;
  const paddingRight = 26;
  const paddingTop = compact ? 22 : 30;
  const paddingBottom = compact ? 45 : 58;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const xValues = points.map((point) => point.appliedTemperature);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const xSpan = Math.max(maxX - minX, 1);

  const maxAbsError = Math.max(
    0.01,
    ...points.map((point) => Math.abs(point.error))
  );
  const yLimit = maxAbsError * 1.15;

  function xScale(value: number) {
    if (points.length === 1 || minX === maxX) {
      return paddingLeft + plotWidth / 2;
    }

    return paddingLeft + ((value - minX) / xSpan) * plotWidth;
  }

  function yScale(value: number) {
    return paddingTop + ((yLimit - value) / (yLimit * 2)) * plotHeight;
  }

  const zeroY = yScale(0);
  const polylinePoints = points
    .map((point) => `${xScale(point.appliedTemperature)},${yScale(point.error)}`)
    .join(" ");

  const maxErrorPoint = points.reduce((current, point) =>
    Math.abs(point.error) > Math.abs(current.error) ? point : current
  );

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-slate-200 bg-white/45 p-2"
          : "rounded-xl border border-slate-200 bg-white/45 p-4"
      }
    >
      <div
        className={
          compact
            ? "mb-1 flex items-start justify-between gap-2"
            : "mb-3 flex items-start justify-between gap-4"
        }
      >
        <div>
          <p
            className={
              compact
                ? "text-[8px] font-black uppercase tracking-wide text-slate-800"
                : "text-sm font-black uppercase tracking-wide text-slate-800"
            }
          >
            {title}
          </p>
          <p className={compact ? "text-[7px] text-slate-500" : "mt-1 text-xs text-slate-500"}>
            Asse X: temperatura applicata (°C) - Asse Y: errore (°C)
          </p>
        </div>

        <div
          className={
            compact
              ? "rounded border border-slate-200 bg-white/45 px-2 py-1 text-right text-[7px] text-slate-800"
              : "rounded-lg border border-slate-200 bg-white/45 px-4 py-2 text-right text-xs text-slate-800"
          }
        >
          <p className="font-bold">Errore massimo assoluto</p>
          <p>
            {formatNumber(Math.abs(maxErrorPoint.error), 3)} °C a {formatNumber(maxErrorPoint.appliedTemperature, 2)} °C
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={compact ? "h-[145px] w-full overflow-visible" : "h-[360px] w-full overflow-visible"}
        role="img"
        aria-label={title}
      >
        <line
          x1={paddingLeft}
          y1={zeroY}
          x2={width - paddingRight}
          y2={zeroY}
          stroke="#64748b"
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
          +{formatNumber(yLimit, 3)}
        </text>
        <text
          x={paddingLeft - 8}
          y={zeroY + 4}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          0
        </text>
        <text
          x={paddingLeft - 8}
          y={height - paddingBottom + 4}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          -{formatNumber(yLimit, 3)}
        </text>

        {points.length > 1 && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#0f172a"
            strokeWidth={compact ? "2" : "2.5"}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((point) => {
          const x = xScale(point.appliedTemperature);
          const y = yScale(point.error);

          return (
            <g key={point.id}>
              <circle cx={x} cy={y} r={compact ? 3.5 : 4.5} fill="#0f172a" />
              {!compact && (
                <text
                  x={x}
                  y={y - 9}
                  textAnchor="middle"
                  className="fill-slate-700 text-[9px] font-semibold"
                >
                  {formatNumber(point.error, 3)}
                </text>
              )}
              <text
                x={x}
                y={height - paddingBottom + 18}
                textAnchor="middle"
                className="fill-slate-600 text-[9px]"
              >
                {formatNumber(point.appliedTemperature, 2)}
              </text>
            </g>
          );
        })}

        <text
          x={paddingLeft + plotWidth / 2}
          y={height - 8}
          textAnchor="middle"
          className="fill-slate-600 text-[10px] font-semibold"
        >
          Temperatura applicata (°C)
        </text>

        <text
          x={14}
          y={paddingTop + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${paddingTop + plotHeight / 2})`}
          className="fill-slate-600 text-[10px] font-semibold"
        >
          Errore (°C)
        </text>
      </svg>
    </div>
  );
}
