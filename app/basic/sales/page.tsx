import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { SalesList } from "@/components/appsolux/basic/sales-list";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { listSales, countSales, countActiveSales } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getSriDocumentsForSales } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const PAGE_SIZE = 20;

type BasicSalesPageProps = {
  searchParams: Promise<{
    status?: string;
    customerId?: string;
    page?: string;
  }>;
};

type SalesStatus = "all" | "paid" | "pending" | "canceled";

function normalizeStatus(raw: string | undefined): SalesStatus {
  if (raw === "paid" || raw === "pending" || raw === "canceled") return raw;
  return "all";
}

function normalizePage(page: string | undefined): number {
  const n = parseInt(page ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function BasicSalesPage({ searchParams }: BasicSalesPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Documentos de venta"
        description="Recibos internos y facturas SRI · busca, filtra y descarga directamente."
        activeHref={routes.facturacionDocuments}
      >
        <p className="text-muted-foreground">Sesión requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedParams = await searchParams;
  const status = normalizeStatus(resolvedParams.status);
  const page = normalizePage(resolvedParams.page);
  const plan = await getTenantPlanState(tenant.id);

  // Validate customerId belongs to this tenant
  let filteredCustomerId: string | undefined;
  let filteredCustomerName: string | undefined;
  const rawCustomerId = resolvedParams.customerId ?? "";
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

  const filterInput = { status, customerId: filteredCustomerId };

  const [sales, total, activeSalesCount] = await Promise.all([
    listSales(tenant.id, { ...filterInput, page, perPage: PAGE_SIZE }),
    countSales(tenant.id, filterInput),
    countActiveSales(tenant.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const sriDocuments = await getSriDocumentsForSales(
    tenant.id,
    sales.map((s) => s.id)
  );

  function statusHref(key: string) {
    const params = new URLSearchParams();
    if (key !== "all") params.set("status", key);
    if (filteredCustomerId) params.set("customerId", filteredCustomerId);
    const qs = params.toString();
    return qs ? `${routes.facturacionDocuments}?${qs}` : routes.facturacionDocuments;
  }

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (filteredCustomerId) params.set("customerId", filteredCustomerId);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${routes.facturacionDocuments}?${qs}` : routes.facturacionDocuments;
  }

  return (
    <BasicModuleShell
      title="Documentos de venta"
      description="Recibos internos y facturas SRI · busca, filtra y descarga directamente."
      activeHref={routes.facturacionDocuments}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {activeSalesCount} / {plan.limits.receipts} ventas activas del plan.
          </p>
          {filteredCustomerName && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm">
              <span>
                Cliente: <span className="font-semibold">{filteredCustomerName}</span>
              </span>
              <Button asChild variant="ghost" size="sm" className="h-auto py-0">
                <Link href={routes.facturacionDocuments}>×</Link>
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
          page={safePage}
          totalPages={totalPages}
          totalItems={total}
          prevHref={safePage > 1 ? pageHref(safePage - 1) : undefined}
          nextHref={safePage < totalPages ? pageHref(safePage + 1) : undefined}
        />
      </div>
    </BasicModuleShell>
  );
}
