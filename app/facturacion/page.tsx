import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Package,
  ReceiptText,
  Settings2,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { SalesPeriodChart } from "@/components/appsolux/facturacion/sales-period-chart";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getSriDocuments, getSriModuleStatus } from "@/lib/core/sri";
import { getPrismaClient } from "@/lib/db/prisma";

const pendingStatuses = ["DRAFT", "READY_FOR_TESTING", "SIGNED", "SENT"];
function formatMoney(value: { toString(): string } | number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value.toString()));
}
function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
function documentStatus(status: string) {
  if (status === "AUTHORIZED")
    return {
      label: "Autorizado",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
  if (status === "REJECTED")
    return {
      label: "Rechazado",
      className: "bg-red-50 text-red-700 ring-red-200",
    };
  return {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  };
}

async function getDashboardData(tenantId: string) {
  const prisma = getPrismaClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const [sales, documentRows, recentDocuments, inventoryRows] =
    await Promise.all([
      prisma.lightweightSale.findMany({
        where: {
          tenantId,
          status: { not: "canceled" },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sriDocument.findMany({
        where: { tenantId },
        select: { status: true, createdAt: true },
      }),
      getSriDocuments(tenantId, { take: 6 }),
      prisma.lightweightProduct.findMany({
        where: { tenantId, isActive: true, trackInventory: true },
        select: { stock: true, minStock: true },
      }),
    ]);
  const dailySales = Array.from({ length: 31 }, (_, index) => {
    const date = new Date(thirtyDaysAgo);
    date.setDate(thirtyDaysAgo.getDate() + index);
    return { date: date.toISOString().slice(0, 10), value: 0 };
  });
  const dayMap = new Map(dailySales.map((item) => [item.date, item]));
  for (const sale of sales) {
    const bucket = dayMap.get(
      new Date(sale.createdAt).toISOString().slice(0, 10),
    );
    if (bucket) bucket.value += Number(sale.total.toString());
  }
  const statusCounts = documentRows.reduce<Record<string, number>>(
    (counts, row) => {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
      return counts;
    },
    {},
  );
  return {
    dailySales,
    recentDocuments,
    documentCounts: {
      thisMonth: documentRows.filter((document) => document.createdAt >= monthStart)
        .length,
      authorized: statusCounts.AUTHORIZED ?? 0,
      pending: pendingStatuses.reduce(
        (sum, status) => sum + (statusCounts[status] ?? 0),
        0,
      ),
      rejected: statusCounts.REJECTED ?? 0,
    },
    lowStockCount: inventoryRows.filter(
      (item) => item.minStock !== null && item.stock <= item.minStock,
    ).length,
  };
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof ShoppingCart;
}) {
  return (
    <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none ring-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#667085]">{title}</p>
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#EEF5FF] text-[#1769E0]">
            <Icon className="size-4" />
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-[#172033]">
          {value}
        </p>
        <p className="mt-1 text-xs text-[#667085]">{helper}</p>
      </CardContent>
    </Card>
  );
}

const quickActions = [
  { title: "Nueva venta", href: routes.facturacionPos, icon: ShoppingCart },
  { title: "Documentos", href: routes.facturacionDocuments, icon: FileText },
  { title: "Nuevo cliente", href: routes.facturacionCustomers, icon: Users },
  { title: "Productos", href: routes.facturacionProducts, icon: Package },
  { title: "SRI", href: routes.facturacionSri, icon: ReceiptText },
  { title: "Caja", href: routes.facturacionCash, icon: Wallet },
];

export default async function FacturacionPage() {
  const { tenant } = await requireDashboardSession();
  const [reports, sriStatus, dashboard] = await Promise.all([
    getBasicReports(tenant.id),
    getSriModuleStatus(tenant.id),
    getDashboardData(tenant.id),
  ]);
  const alerts = [
    ...(dashboard.documentCounts.rejected > 0
      ? [
          {
            label: `${dashboard.documentCounts.rejected} comprobante(s) rechazado(s)`,
            href: routes.facturacionDocuments,
            tone: "red" as const,
          },
        ]
      : []),
    ...(dashboard.documentCounts.pending > 0
      ? [
          {
            label: `${dashboard.documentCounts.pending} comprobante(s) pendiente(s)`,
            href: routes.facturacionDocuments,
            tone: "amber" as const,
          },
        ]
      : []),
    ...(sriStatus.readinessLabel === "incomplete" ||
    sriStatus.readinessLabel === "not_started"
      ? [
          {
            label: "La configuración SRI está incompleta",
            href: routes.facturacionSri,
            tone: "amber" as const,
          },
        ]
      : []),
    ...(dashboard.lowStockCount > 0
      ? [
          {
            label: `${dashboard.lowStockCount} producto(s) con stock bajo`,
            href: routes.facturacionProducts,
            tone: "amber" as const,
          },
        ]
      : []),
  ];
  return (
    <DashboardShell
      mainClassName="px-4 py-5 sm:px-6 sm:py-6"
      contentClassName="mx-auto max-w-[1440px]"
    >
      <div className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#172033]">
              Panel de control
            </h1>
            <p className="mt-1 text-sm text-[#667085]">
              Resumen general de tu empresa
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="w-full bg-[#1769E0] text-white hover:bg-[#155DC4] sm:w-auto"
          >
            <Link href={routes.facturacionPos}>
              <ShoppingCart />
              Nueva venta
            </Link>
          </Button>
        </header>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Ventas del día"
            value={formatMoney(reports.salesToday)}
            helper="Ventas registradas hoy"
            icon={CircleDollarSign}
          />
          <MetricCard
            title="Facturado este mes"
            value={formatMoney(reports.salesMonth)}
            helper="Acumulado del mes actual"
            icon={ShoppingCart}
          />
          <MetricCard
            title="Documentos este mes"
            value={String(dashboard.documentCounts.thisMonth)}
            helper="Comprobantes registrados este mes"
            icon={FileCheck2}
          />
          <MetricCard
            title="Pendientes SRI"
            value={String(dashboard.documentCounts.pending)}
            helper="Comprobantes pendientes de procesamiento"
            icon={AlertTriangle}
          />
        </section>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none ring-0">
            <CardContent className="p-4 sm:p-5">
              <SalesPeriodChart items={dashboard.dailySales} />
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none ring-0">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-[#172033]">Comprobantes</h2>
                  <p className="mt-1 text-xs text-[#667085]">Estado actual</p>
                </div>
                <Link
                  href={routes.facturacionDocuments}
                  className="text-xs font-medium text-[#1769E0] hover:underline"
                >
                  Ver todos
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  {
                    label: "Autorizados",
                    value: dashboard.documentCounts.authorized,
                    dot: "bg-emerald-500",
                  },
                  {
                    label: "Pendientes",
                    value: dashboard.documentCounts.pending,
                    dot: "bg-amber-500",
                  },
                  {
                    label: "Rechazados",
                    value: dashboard.documentCounts.rejected,
                    dot: "bg-red-500",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between border-b border-[#E4E9F0] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="flex items-center gap-2 text-sm text-[#667085]">
                      <span className={`size-2 rounded-full ${item.dot}`} />
                      {item.label}
                    </span>
                    <strong className="text-lg font-semibold text-[#172033]">
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
        <section>
          <h2 className="font-semibold text-[#172033]">Accesos rápidos</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {quickActions.map(({ title, href, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                className="flex min-h-20 items-center gap-3 rounded-xl border border-[#E4E9F0] bg-white p-3 text-sm font-medium text-[#172033] transition-colors hover:border-[#1769E0]/40 hover:bg-[#F7FAFF]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF5FF] text-[#1769E0]">
                  <Icon className="size-4" />
                </span>
                {title}
              </Link>
            ))}
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none ring-0">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-[#E4E9F0] px-4 py-4 sm:px-5">
                <div>
                  <h2 className="font-semibold text-[#172033]">
                    Actividad reciente
                  </h2>
                  <p className="mt-1 text-xs text-[#667085]">
                    Últimos comprobantes registrados
                  </p>
                </div>
                <Link
                  href={routes.facturacionDocuments}
                  className="text-xs font-medium text-[#1769E0] hover:underline"
                >
                  Ver todos
                </Link>
              </div>
              {dashboard.recentDocuments.length ? (
                <div className="divide-y divide-[#E4E9F0]">
                  {dashboard.recentDocuments.map((doc) => {
                    const status = documentStatus(doc.status);
                    return (
                      <div
                        key={doc.id}
                        className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_140px_110px_100px] sm:items-center sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#172033]">
                            {doc.customerName}
                          </p>
                          <p className="truncate text-xs text-[#667085]">
                            {doc.accessKey?.slice(-13) ?? doc.id.slice(-8)}
                          </p>
                        </div>
                        <span className="text-xs text-[#667085]">
                          {formatDate(doc.issuedAt ?? doc.createdAt)}
                        </span>
                        <span className="text-sm font-medium text-[#172033] sm:text-right">
                          {formatMoney(doc.grandTotal)}
                        </span>
                        <span
                          className={`w-fit rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset sm:justify-self-end ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-[#667085]">
                  Aún no hay comprobantes recientes.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none ring-0">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-[#667085]" />
                <h2 className="font-semibold text-[#172033]">
                  Alertas operativas
                </h2>
              </div>
              <div className="mt-4 space-y-2">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <Link
                      key={alert.label}
                      href={alert.href}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${alert.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>{alert.label}</span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    No hay alertas operativas pendientes.
                  </div>
                )}
              </div>
              {sriStatus.readinessLabel === "incomplete" ||
              sriStatus.readinessLabel === "not_started" ? (
                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link href={routes.facturacionSri}>
                    <Settings2 />
                    Revisar configuración
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}
