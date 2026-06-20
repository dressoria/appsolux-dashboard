import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  FileCheck2,
  FileText,
  ReceiptText,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

import { SalesMetricCard, SalesQuickAction, SaleStatusBadge } from "@/components/appsolux/basic/sales-ui";
import { BillingModuleShell } from "@/components/appsolux/billing/billing-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getPrismaClient } from "@/lib/db/prisma";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { getSriModuleStatus, getSriDocuments } from "@/lib/core/sri";
import { getTenantPlanState } from "@/lib/core/plans";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export default async function SalesPage() {
  const { user, tenant } = await requireDashboardSession();

  const prisma = getPrismaClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [reports, sriStatus, plan, sriDocs] = await Promise.all([
    getBasicReports(tenant.id),
    getSriModuleStatus(tenant.id),
    getTenantPlanState(tenant.id),
    getSriDocuments(tenant.id, { take: 5 }),
  ]);

  const [soldItemsAggregate, sriSaleLinks] = await Promise.all([
    prisma.lightweightSaleItem.aggregate({
      where: {
        sale: {
          tenantId: tenant.id,
          status: { not: "canceled" },
          createdAt: { gte: startOfMonth },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.sriDocument.findMany({
      where: { tenantId: tenant.id, sourceType: "BASIC_SALE" },
      select: { sourceId: true, status: true },
    }),
  ]);

  function money(value: { toString(): string }) {
    return `$${Number(value.toString()).toFixed(2)}`;
  }

  const pendingSriCount = sriSaleLinks.filter((doc) =>
    ["DRAFT", "READY_FOR_TESTING", "SIGNED", "SENT"].includes(doc.status)
  ).length;
  const linkedSalesCount = new Set(sriSaleLinks.map((doc) => doc.sourceId)).size;
  const internalReceiptCount = Math.max(reports.counts.receipts - linkedSalesCount, 0);
  const soldItems = soldItemsAggregate._sum.quantity ?? 0;

  return (
    <BillingModuleShell>
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#007BFF]">
              Módulo de Facturación
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#004080]">
              Centro de Facturación
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ventas, inventario, comprobantes y reportes en un solo lugar.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <SaleStatusBadge
              label={sriStatus.hasProfile ? "SRI listo" : "SRI pendiente"}
              variant={sriStatus.hasProfile ? "success" : "warning"}
            />
            <Button asChild size="sm" className="bg-[#004080] hover:bg-[#003060]">
              <Link href={routes.basicPos}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Nueva venta
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-6xl space-y-8">

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <SalesMetricCard
              icon={ShoppingCart}
              label="Ventas de hoy"
              value={money(reports.salesToday)}
              helper="Monto vendido hoy."
              tone="info"
            />
            <SalesMetricCard
              icon={CreditCard}
              label="Total del mes"
              value={money(reports.salesMonth)}
              helper="Ventas del mes actual."
              tone="success"
            />
            <SalesMetricCard
              icon={FileText}
              label="Ítems vendidos"
              value={String(soldItems)}
              helper="Cantidades vendidas este mes."
            />
            <SalesMetricCard
              icon={FileCheck2}
              label="Pendientes SRI"
              value={String(pendingSriCount)}
              helper="Documentos SRI en proceso."
              tone="warning"
            />
            <SalesMetricCard
              icon={ReceiptText}
              label="Recibos internos"
              value={String(internalReceiptCount)}
              helper="Ventas sin documento SRI."
            />
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Accesos rápidos
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <SalesQuickAction
                href={routes.basicPos}
                title="Nueva venta"
                description="Ir directo al checkout operativo."
                icon={ShoppingCart}
              />
              <SalesQuickAction
                href={routes.basicSales}
                title="Ventas recientes"
                description="Recibos, pagos parciales y cancelaciones."
                icon={ReceiptText}
              />
              <SalesQuickAction
                href={routes.basicCustomers}
                title="Clientes"
                description="Consulta clientes y ventas relacionadas."
                icon={Users}
              />
              <SalesQuickAction
                href={routes.sriDocuments}
                title="Facturas SRI"
                description="Seguimiento de comprobantes electrónicos."
                icon={FileCheck2}
              />
              <SalesQuickAction
                href={routes.basicCash}
                title="Caja / cierre"
                description="Revisar cobros y estado diario."
                icon={Wallet}
              />
              <SalesQuickAction
                href={routes.basicReports}
                title="Reportes"
                description="Ventas, cobros y stock del período."
                icon={BarChart3}
              />
            </div>
          </div>

          {/* SRI + plan */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-slate-900">Facturación SRI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sriStatus.hasProfile ? (
                  <>
                    <p className="text-sm text-slate-500">
                      RUC {sriStatus.ruc ?? ""}. Ambiente:{" "}
                      {sriStatus.environment === "TEST" ? "Pruebas" : "Producción"}.
                    </p>
                    {sriDocs.length > 0 && (
                      <p className="text-sm text-slate-500">
                        {sriDocs.length} comprobante{sriDocs.length !== 1 ? "s" : ""} reciente{sriDocs.length !== 1 ? "s" : ""}.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button asChild variant="outline" className="flex-1">
                        <Link href={routes.sriDocuments}>Ver comprobantes</Link>
                      </Button>
                      <Button asChild variant="outline" className="flex-1">
                        <Link href={routes.basicPos}>Nueva venta</Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">
                      Configura empresa y RUC para habilitar factura electrónica.
                    </p>
                    <Button asChild className="w-full bg-[#004080] hover:bg-[#003060]">
                      <Link href={routes.sriCompany}>Configurar empresa</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  Plan: {plan.planName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-500">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Ventas registradas</span>
                    <span className="font-medium text-slate-900">
                      {reports.counts.receipts} / {plan.limits.receipts}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#004080]"
                      style={{
                        width: `${Math.min(100, (reports.counts.receipts / plan.limits.receipts) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Clientes</span>
                    <span className="font-medium text-slate-900">
                      {reports.counts.customers} / {plan.limits.customers}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#007BFF]"
                      style={{
                        width: `${Math.min(100, (reports.counts.customers / plan.limits.customers) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={routes.billing}>Ver plan y límites</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ERP upsell */}
          {plan.canRequestDedicatedErp && (
            <Card className="rounded-[24px] border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-[#004080]">ERP Avanzado disponible</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-500">
                  Cotizaciones, cuentas por cobrar, contabilidad y reportes financieros avanzados.
                </p>
                <Button asChild variant="outline" className="border-[#004080]/30 text-[#004080] hover:bg-[#004080]/5">
                  <Link href={routes.erp}>Abrir ERP</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tenant info footer */}
          <p className="text-center text-xs text-slate-400">
            {user.name} · {tenant.name}
          </p>
        </div>
      </main>
    </BillingModuleShell>
  );
}
