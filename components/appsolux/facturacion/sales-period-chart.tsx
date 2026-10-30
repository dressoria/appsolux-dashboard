"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type SalesPoint = { date: string; value: number };
type Period = "7" | "30" | "month";
const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const moneyShort = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const dayFmt = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const fullDateFmt = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function SalesPeriodChart({ items }: { items: SalesPoint[] }) {
  const [period, setPeriod] = useState<Period>("30");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const visible = useMemo(() => {
    if (period === "7") return items.slice(-7);
    if (period === "month") {
      const month = new Date().toISOString().slice(0, 7);
      return items.filter((item) => item.date.startsWith(month));
    }
    return items.slice(-30);
  }, [items, period]);

  const total = visible.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(...visible.map((item) => item.value), 0);
  const width = 720,
    height = 240,
    left = 12,
    top = 20,
    bottom = 32,
    plotHeight = height - top - bottom;

  const points = useMemo(
    () =>
      visible.map((item, index) => ({
        ...item,
        x:
          left +
          (index * (width - left * 2)) / Math.max(visible.length - 1, 1),
        y:
          top + plotHeight - (max > 0 ? (item.value / max) * plotHeight : 0),
      })),
    [visible, max, plotHeight],
  );

  const linePath = points
    .map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z`
    : "";

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || points.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const svgX = (clientX / rect.width) * width;
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - svgX);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      setHoverIndex(closest);
    },
    [points],
  );

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#172033]">Ventas</h2>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#172033]">
            {moneyShort.format(total)}
          </p>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-[#E4E9F0] bg-[#F6F8FB] p-1">
          {(
            [
              { key: "7", label: "7 días" },
              { key: "30", label: "30 días" },
              { key: "month", label: "Este mes" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setPeriod(option.key);
                setHoverIndex(null);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${period === option.key ? "bg-white text-[#1769E0] shadow-sm" : "text-[#667085] hover:text-[#172033]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-4 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-[240px] w-full"
          role="img"
          aria-label="Ventas registradas en el período seleccionado"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="salesAreaFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line
              key={line}
              x1={left}
              x2={width - left}
              y1={top + (plotHeight * line) / 3}
              y2={top + (plotHeight * line) / 3}
              stroke="#E4E9F0"
              strokeWidth="1"
            />
          ))}
          {max > 0 && (
            <>
              <path d={areaPath} fill="url(#salesAreaFill)" />
              <path
                d={linePath}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          {hoverPoint && (
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={top}
              y2={top + plotHeight}
              stroke="#F59E0B"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.5"
            />
          )}
          {points.map((point, index) => (
            <g key={point.date}>
              {point.value > 0 && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hoverIndex === index ? 5.5 : 3.5}
                  fill={hoverIndex === index ? "#F59E0B" : "#fff"}
                  stroke="#F59E0B"
                  strokeWidth="2"
                  className="transition-[r] duration-150"
                />
              )}
              {index === 0 ||
              index === points.length - 1 ||
              (visible.length <= 7 && index % 2 === 0) ? (
                <text
                  x={point.x}
                  y={height - 7}
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === points.length - 1
                        ? "end"
                        : "middle"
                  }
                  fontSize="11"
                  fill="#667085"
                >
                  {dayFmt.format(new Date(`${point.date}T00:00:00Z`))}
                </text>
              ) : null}
            </g>
          ))}
          {max <= 0 && (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fontSize="13"
              fill="#667085"
            >
              Aún no hay ventas en este período
            </text>
          )}
        </svg>
        {hoverPoint && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(hoverPoint.x / width) * 100}%`,
              top: `${(hoverPoint.y / height) * 100 - 18}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-medium text-[#172033]">
              {fullDateFmt.format(new Date(`${hoverPoint.date}T00:00:00Z`))}
            </p>
            <p className="mt-0.5 font-semibold text-[#F59E0B]">
              Ventas: {money.format(hoverPoint.value)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
