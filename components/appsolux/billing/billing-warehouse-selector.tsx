import { Building2, Lock } from "lucide-react";

export function BillingWarehouseSelector() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-600">Bodega</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
        Bodega principal
      </div>
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Lock className="h-3 w-3 shrink-0" />
        Múltiples bodegas disponibles con ERP
      </span>
    </div>
  );
}
