"use client";

type JackConversionChartPoint = {
  pressureBar: number;
  conversionCoefficient: number | null;
};

type JackConversionChartProps = {
  points: JackConversionChartPoint[];
  averageCoefficient: number | null;
};

function formatNumber(value: number, digits = 3) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export default function JackConversionChart({
  points,
  averageCoefficient,
}: JackConversionChartProps) {
  const validPoints = points.filter(
    (point) =>
      Number.isFinite(point.pressureBar) &&
      point.conversionCoefficient !== null &&
      Number.isFinite(point.conversionCoefficient)
  ) as Array<{ pressureBar: number; conversionCoefficient: number }>;

  if (validPoints.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Inserisci punti completi per visualizzare il grafico del coefficiente di conversione.
      </div>
    );
  }

  const width = 760;
  const height = 300;
  const left = 70;
  const right = 22;
  const top = 24;
  const bottom = 55;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const xValues = validPoints.map((point) => point.pressureBar);
  const yValues = validPoints.map((point) => point.conversionCoefficient);
  if (averageCoefficient !== null && Number.isFinite(averageCoefficient)) {
    yValues.push(averageCoefficient);
  }

  const xMaxRaw = Math.max(...xValues);
  const xMax = xMaxRaw > 0 ? xMaxRaw * 1.05 : 1;
  const yMinRaw = Math.min(...yValues);
  const yMaxRaw = Math.max(...yValues);
  const ySpan = Math.max(yMaxRaw - yMinRaw, Math.abs(yMaxRaw) * 0.01, 0.001);
  const yMin = yMinRaw - ySpan * 0.2;
  const yMax = yMaxRaw + ySpan * 0.2;

  const x = (value: number) => left + (value / xMax) * plotWidth;
  const y = (value: number) =>
    top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const sortedPoints = [...validPoints].sort(
    (a, b) => a.pressureBar - b.pressureBar
  );
  const polylinePoints = sortedPoints
    .map((point) => `${x(point.pressureBar)},${y(point.conversionCoefficient)}`)
    .join(" ");

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return yMax - ratio * (yMax - yMin);
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto min-w-[680px] w-full"
        role="img"
        aria-label="Grafico coefficiente di conversione in funzione della pressione"
      >
        <rect x="0" y="0" width={width} height={height} fill="white" />

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#475569"
            >
              {formatNumber(tick, 4)}
            </text>
          </g>
        ))}

        <line
          x1={left}
          x2={left}
          y1={top}
          y2={height - bottom}
          stroke="#334155"
          strokeWidth="1.2"
        />
        <line
          x1={left}
          x2={width - right}
          y1={height - bottom}
          y2={height - bottom}
          stroke="#334155"
          strokeWidth="1.2"
        />

        {sortedPoints.map((point) => (
          <g key={`${point.pressureBar}-${point.conversionCoefficient}`}>
            <line
              x1={x(point.pressureBar)}
              x2={x(point.pressureBar)}
              y1={height - bottom}
              y2={height - bottom + 5}
              stroke="#64748b"
            />
            <text
              x={x(point.pressureBar)}
              y={height - bottom + 20}
              textAnchor="middle"
              fontSize="11"
              fill="#475569"
            >
              {formatNumber(point.pressureBar, 0)}
            </text>
          </g>
        ))}

        {averageCoefficient !== null && Number.isFinite(averageCoefficient) && (
          <>
            <line
              x1={left}
              x2={width - right}
              y1={y(averageCoefficient)}
              y2={y(averageCoefficient)}
              stroke="#64748b"
              strokeDasharray="7 5"
              strokeWidth="1.5"
            />
            <text
              x={width - right - 4}
              y={y(averageCoefficient) - 6}
              textAnchor="end"
              fontSize="11"
              fontWeight="600"
              fill="#475569"
            >
              Media {formatNumber(averageCoefficient, 6)} kN/bar
            </text>
          </>
        )}

        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
        />

        {sortedPoints.map((point) => (
          <g key={`dot-${point.pressureBar}-${point.conversionCoefficient}`}>
            <circle
              cx={x(point.pressureBar)}
              cy={y(point.conversionCoefficient)}
              r="4"
              fill="#0f172a"
            />
            <title>
              {`${formatNumber(point.pressureBar, 0)} bar — ${formatNumber(
                point.conversionCoefficient,
                6
              )} kN/bar`}
            </title>
          </g>
        ))}

        <text
          x={left + plotWidth / 2}
          y={height - 8}
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill="#334155"
        >
          Pressione (bar)
        </text>
        <text
          x="16"
          y={top + plotHeight / 2}
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill="#334155"
          transform={`rotate(-90 16 ${top + plotHeight / 2})`}
        >
          Coefficiente (kN/bar)
        </text>
      </svg>
    </div>
  );
}
