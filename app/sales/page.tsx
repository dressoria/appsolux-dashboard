import Link from "next/link";
import {
  CreditCard,
  FileCheck2,
  FileText,
  ReceiptText,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

import { SalesMetricCard, SalesQuickAction, SaleStatusBadge } from "@/components/appsolux/basic/sales-ui";
import { AppModuleShell } from "@/components/appsolux/layout/app-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { getSriModuleStatus, getSriDocuments } from "@/lib/core/sri";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function SalesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppModuleShell
        appName="Ventas"
        appDescription="Pedidos, cotizaciones, ventas y cuentas por cobrar."
        badge="Ventas"
        badgeVariant="emerald"
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </AppModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
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
    <AppModuleShell
      appName="POS / Ventas"
      appDescription="Vende, cobra y emite recibos o facturas electronicas desde un solo lugar."
      badge="App"
      badgeVariant="emerald"
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.95fr] lg:px-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  App de ventas
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Vende, cobra y emite recibos o facturas electronicas desde un solo lugar.
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  La venta es la base operativa: registra historial, descuenta inventario y luego
                  define si la salida es recibo interno o factura SRI.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <SalesMetricCard
                  icon={ShoppingCart}
                  label="Ventas de hoy"
                  value={money(reports.salesToday)}
                  helper="Monto vendido hoy en ventas no canceladas."
                  tone="info"
                />
                <SalesMetricCard
                  icon={CreditCard}
                  label="Total vendido"
                  value={money(reports.salesMonth)}
                  helper="Total del mes actual."
                  tone="success"
                />
                <SalesMetricCard
                  icon={FileText}
                  label="Productos vendidos"
                  value={String(soldItems)}
                  helper="Suma de cantidades vendidas este mes."
                />
                <SalesMetricCard
                  icon={FileCheck2}
                  label="Pendientes SRI"
                  value={String(pendingSriCount)}
                  helper="Ventas con documento SRI aun en proceso."
                  tone="warning"
                />
                <SalesMetricCard
                  icon={ReceiptText}
                  label="Recibos internos"
                  value={String(internalReceiptCount)}
                  helper="Ventas registradas sin documento SRI asociado."
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Atajos operativos</p>
                  <p className="text-sm text-slate-600">
                    Navega rapido entre venta, clientes y seguimiento SRI.
                  </p>
                </div>
                <SaleStatusBadge
                  label={sriStatus.hasProfile ? "SRI listo" : "SRI pendiente"}
                  variant={sriStatus.hasProfile ? "success" : "warning"}
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                  description="Seguimiento simple de comprobantes."
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
                  description="Ventas, cobros y stock desde modo basico."
                  icon={CreditCard}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Salida de la venta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cada venta comparte el mismo origen operativo y el mismo descuento de inventario.
              </p>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">Recibo interno</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Registra la venta, muestra recibo y no toca el flujo SRI.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">Factura electronica SRI</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Parte de la misma venta y arranca la preparacion SRI sin mostrar pasos tecnicos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Facturacion SRI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sriStatus.hasProfile ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Empresa configurada con RUC {sriStatus.ruc ?? ""}. Ambiente:{" "}
                    {sriStatus.environment === "TEST" ? "Pruebas" : "Produccion"}.
                  </p>
                  {sriDocs.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {sriDocs.length} comprobante{sriDocs.length !== 1 ? "s" : ""} reciente{sriDocs.length !== 1 ? "s" : ""} para seguimiento.
                    </p>
                  ) : null}
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
                  <p className="text-sm text-muted-foreground">
                    Configura empresa y RUC antes de habilitar factura electronica desde el POS.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={routes.sriCompany}>Configurar empresa</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {plan.canRequestDedicatedErp && (
          <Card>
            <CardHeader>
              <CardTitle>ERP Avanzado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cotizaciones, pedidos de venta, cuentas por cobrar y reportes financieros avanzados.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.erp}>Abrir ERP</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Uso del plan: {plan.planName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Ventas registradas: {reports.counts.receipts} / {plan.limits.receipts}</p>
            <p>Clientes: {reports.counts.customers} / {plan.limits.customers}</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={routes.billing}>Ver plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppModuleShell>
  );
}
