import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getMovements } from "@/lib/core/inventory-movements";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { sanitizePage, sanitizePerPage } from "@/lib/pagination";
import { MovementsClient } from "./movements-client";

export default async function FacturacionInventoryMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await requireDashboardSession();
  const params = await searchParams;
  const page = sanitizePage(params.page);
  const perPage = sanitizePerPage(params.perPage);
  const warehouseId = params.warehouseId ?? "";
  const movementType = params.movementType ?? "";
  const dateFrom = params.dateFrom ?? "";
  const dateTo = params.dateTo ?? "";

  const [result, warehouses] = await Promise.all([
    getMovements(tenant.id, {
      warehouseId: warehouseId || undefined,
      movementType: movementType ? (movementType as never) : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    getWarehouses(tenant.id),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-[#667085]">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#172033]">Movimientos</h1>
        </div>
        <MovementsClient
          initialMovements={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
          page={page}
          perPage={perPage}
          filters={{ warehouseId, movementType, dateFrom, dateTo }}
        />
      </div>
    </DashboardShell>
  );
}
