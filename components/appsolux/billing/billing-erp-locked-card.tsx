import { Lock } from "lucide-react";

const LOCKED_FEATURES = [
  "Variantes de producto",
  "Múltiples bodegas",
  "Lotes y series",
  "Costeo avanzado (PEPS / Promedio)",
  "Kardex completo",
  "Reglas de precio por cliente",
  "Compras y proveedores",
  "Cuentas por cobrar / pagar",
  "Contabilidad automática",
];

export function BillingErpLockedCard() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-slate-200/80 p-2 text-slate-500">
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Funciones avanzadas con ERP
          </p>
          <p className="text-xs text-slate-500">
            Disponibles con plan ERP de Appsolux
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {LOCKED_FEATURES.map((feature) => (
          <div
            key={feature}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-500"
          >
            <Lock className="h-3 w-3 shrink-0 text-slate-300" />
            {feature}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">
        Múltiples bodegas, kardex, lotes, series y costeo avanzado requieren ERP.{" "}
        <a
          href="/erp"
          className="font-medium text-[#004080]/70 hover:text-[#004080] hover:underline"
        >
          Conocer ERP avanzado →
        </a>
      </p>
    </div>
  );
}
