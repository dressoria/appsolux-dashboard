import { Building2, Lock } from "lucide-react";

type WarehouseOption = {
  name: string;
  label?: string | null;
};

type Props = {
  warehouses?: WarehouseOption[];
  selectedWarehouse?: string;
  preferredWarehouse?: string | null;
  onChange?: (warehouseName: string) => void;
  disabled?: boolean;
};

export function BillingWarehouseSelector({
  warehouses = [],
  selectedWarehouse = "",
  preferredWarehouse,
  onChange,
  disabled = false,
}: Props) {
  const currentWarehouse = warehouses.find((warehouse) => warehouse.name === selectedWarehouse);
  const hasMultiple = warehouses.length > 1;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-600">Bodega</span>
      </div>
      {warehouses.length > 0 && onChange ? (
        <select
          value={selectedWarehouse}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.name} value={warehouse.name}>
              {warehouse.label ?? warehouse.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
          {currentWarehouse?.label ?? currentWarehouse?.name ?? preferredWarehouse ?? "Bodega principal"}
        </div>
      )}
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Lock className="h-3 w-3 shrink-0" />
        {hasMultiple
          ? preferredWarehouse && preferredWarehouse === selectedWarehouse
            ? "Bodega principal activa en POS"
            : "Selecciona la bodega operativa del POS"
          : "La bodega principal se define desde Gestión Empresarial"}
      </span>
    </div>
  );
}
