"use client";

import { useMemo, useState } from "react";

type SalesPoint = { date: string; value: number };
type Period = "7" | "30" | "month";
const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const day = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function SalesPeriodChart({ items }: { items: SalesPoint[] }) {
  const [period, setPeriod] = useState<Period>("30");
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
    height = 220,
    left = 12,
    top = 16,
    bottom = 28,
    plotHeight = height - top - bottom;
  const points = visible.map((item, index) => ({
    ...item,
    x: left + (index * (width - left * 2)) / Math.max(visible.length - 1, 1),
    y: top + plotHeight - (max > 0 ? (item.value / max) * plotHeight : 0),
  }));
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#172033]">Ventas</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[#172033]">
            {money.format(total)}
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
              onClick={() => setPeriod(option.key)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${period === option.key ? "bg-white text-[#1769E0] shadow-sm" : "text-[#667085] hover:text-[#172033]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[220px] w-full"
          role="img"
          aria-label="Ventas registradas en el período seleccionado"
        >
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
          {max > 0 ? (
            <path
              d={path}
              fill="none"
              stroke="#1769E0"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {points.map((point, index) => (
            <g key={point.date}>
              {point.value > 0 ? (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  fill="#fff"
                  stroke="#1769E0"
                  strokeWidth="2"
                >
                  <title>{`${day.format(new Date(`${point.date}T00:00:00Z`))}: ${money.format(point.value)}`}</title>
                </circle>
              ) : null}
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
                  {day.format(new Date(`${point.date}T00:00:00Z`))}
                </text>
              ) : null}
            </g>
          ))}
          {max <= 0 ? (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fontSize="13"
              fill="#667085"
            >
              Aún no hay ventas en este período
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
