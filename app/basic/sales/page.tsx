import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { SalesList } from "@/components/appsolux/basic/sales-list";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { listSales } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getSriDocumentsForSales } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicSalesPageProps = {
  searchParams: Promise<{
    status?: string;
    customerId?: string;
  }>;
};

function normalizeStatus(status: string | undefined) {
  if (status === "paid" || status === "pending" || status === "canceled") {
    return status;
  }

  return "all";
}

export default async function BasicSalesPage({
  searchParams,
}: BasicSalesPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Ventas"
        description="Consulta recibos, cancela ventas y cobra abonos."
        activeHref={routes.basicSales}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const status = normalizeStatus(resolvedSearchParams.status);
  const plan = await getTenantPlanState(tenant.id);

  // Validate customerId belongs to this tenant
  let filteredCustomerId: string | undefined;
  let filteredCustomerName: string | undefined;
  const rawCustomerId = resolvedSearchParams.customerId ?? "";
  if (rawCustomerId) {
    const prisma = getPrismaClient();
    const found = await prisma.lightweightCustomer.findFirst({
      where: { id: rawCustomerId, tenantId: tenant.id },
      select: { id: true, name: true },
    });
    if (found) {
      filteredCustomerId = found.id;
      filteredCustomerName = found.name;
    }
  }

  const [sales, allSales] = await Promise.all([
    listSales(tenant.id, { status, customerId: filteredCustomerId }),
    listSales(tenant.id),
  ]);
  const activeSales = allSales.filter((sale) => sale.status !== "canceled");

  const sriDocuments = await getSriDocumentsForSales(
    tenant.id,
    sales.map((s) => s.id)
  );

  const statusHref = (key: string) => {
    const params = new URLSearchParams();
    if (key !== "all") params.set("status", key);
    if (filteredCustomerId) params.set("customerId", filteredCustomerId);
    const qs = params.toString();
    return qs ? `/basic/sales?${qs}` : "/basic/sales";
  };

  return (
    <BasicModuleShell
      title="Documentos de venta"
      description="Recibos internos y facturas SRI · busca, filtra y descarga directamente."
      activeHref={routes.basicSales}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {activeSales.length} / {plan.limits.receipts} ventas activas del plan.
          </p>
          {filteredCustomerName && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm">
              <span>
                Cliente: <span className="font-semibold">{filteredCustomerName}</span>
              </span>
              <Button asChild variant="ghost" size="sm" className="h-auto py-0">
                <Link href="/basic/sales">×</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Estado filter — server-side */}
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "Todas"],
            ["paid", "Pagadas"],
            ["pending", "Pendientes / Fiadas"],
            ["canceled", "Canceladas"],
          ].map(([key, label]) => (
            <Button
              key={key}
              asChild
              size="sm"
              variant={status === key ? "default" : "outline"}
            >
              <Link href={statusHref(key ?? "")}>{label}</Link>
            </Button>
          ))}
        </div>

        <SalesList
          sales={sales.map((sale) => ({
            id: sale.id,
            createdAt: sale.createdAt,
            total: sale.total.toString(),
            status: sale.status,
            paymentStatus: sale.paymentStatus,
            customer: sale.customer ? { name: sale.customer.name } : null,
            items: sale.items.map((item) => ({
              quantity: item.quantity,
              product: { name: item.product.name },
            })),
            payments: sale.payments.map((payment) => ({
              method: payment.method,
              amount: payment.amount.toString(),
            })),
          }))}
          sriDocuments={sriDocuments}
        />
      </div>
    </BasicModuleShell>
  );
}
