import { ReportsEmptyState } from "./reports-empty-state";

type SimpleBarChartItem = {
  label: string;
  value: number;
  description?: string;
};

type SimpleBarChartProps = {
  items: SimpleBarChartItem[];
  valueFormatter?: (value: number) => string;
  emptyMessage: string;
};

export function SimpleBarChart({
  items,
  valueFormatter = (value) => String(value),
  emptyMessage,
}: SimpleBarChartProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  if (items.length === 0 || maxValue <= 0) {
    return <ReportsEmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = Math.max((item.value / maxValue) * 100, 4);

        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 font-semibold">
                {valueFormatter(item.value)}
              </span>
            </div>
            {item.description ? (
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
