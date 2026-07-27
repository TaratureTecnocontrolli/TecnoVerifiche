"use client";

type SimpleAccuracyChartPoint = {
  label: string;
  value: number | null | undefined;
};

type SimpleAccuracyChartProps = {
  title: string;
  points: SimpleAccuracyChartPoint[];
  lineColor?: string;
};

type CleanPoint = {
  label: string;
  value: number;
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

function buildCleanPoints(points: SimpleAccuracyChartPoint[]): CleanPoint[] {
  return points
    .map((point, index) => {
      const value = toFiniteNumber(point.value);

      if (value === null) {
        return null;
      }

      return {
        label: point.label || "Punto " + String(index + 1),
        value,
      };
    })
    .filter((point): point is CleanPoint => Boolean(point));
}

export default function SimpleAccuracyChart({
  title,
  points,
  lineColor = "#0284c7",
}: SimpleAccuracyChartProps) {
  const chartPoints = buildCleanPoints(points);

  if (chartPoints.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        Nessun dato disponibile per il grafico.
      </div>
    );
  }

  const width = 760;
  const height = 280;
  const paddingLeft = 58;
  const paddingRight = 22;
  const paddingTop = 24;
  const paddingBottom = 52;

  const values = chartPoints.map((point) => point.value);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const valueSpan = maxValue - minValue || 1;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  function xPosition(index: number) {
    if (chartPoints.length === 1) {
      return paddingLeft + plotWidth / 2;
    }

    return paddingLeft + (plotWidth * index) / (chartPoints.length - 1);
  }

  function yPosition(value: number) {
    return paddingTop + ((maxValue - value) / valueSpan) * plotHeight;
  }

  const polylinePoints = chartPoints
    .map((point, index) => `${xPosition(index)},${yPosition(point.value)}`)
    .join(" ");

  const zeroY = yPosition(0);
  const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={title}
          className="h-72 min-w-[720px] w-full"
        >
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

          {yTicks.map((tick, index) => {
            const y = yPosition(tick);

            return (
              <g key={index}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px]"
                >
                  {formatItalianNumber(tick, 2)}%
                </text>
              </g>
            );
          })}

          <line
            x1={paddingLeft}
            y1={zeroY}
            x2={width - paddingRight}
            y2={zeroY}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="5 5"
          />

          <polyline
            points={polylinePoints}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chartPoints.map((point, index) => {
            const x = xPosition(index);
            const y = yPosition(point.value);

            return (
              <g key={point.label + String(index)}>
                <circle cx={x} cy={y} r="4.5" fill={lineColor} />
                <title>
                  {point.label}: {formatItalianNumber(point.value, 4)}%
                </title>
                <text
                  x={x}
                  y={height - paddingBottom + 22}
                  textAnchor="middle"
                  className="fill-slate-600 text-[11px]"
                >
                  {point.label}
                </text>
              </g>
            );
          })}

          <text
            x={paddingLeft}
            y={height - 10}
            className="fill-slate-500 text-[11px]"
          >
            Punto di applicazione
          </text>

          <text
            x={-height + paddingBottom}
            y={16}
            transform="rotate(-90)"
            className="fill-slate-500 text-[11px]"
          >
            Errore accuratezza %
          </text>
        </svg>
      </div>
    </div>
  );
}
