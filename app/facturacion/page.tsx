import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CreditCard,
  FileCheck2,
  FileText,
  ReceiptText,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { ReportsEmptyState } from "@/components/appsolux/reports/reports-empty-state";
import { SimpleBarChart } from "@/components/appsolux/reports/simple-bar-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getPrismaClient } from "@/lib/db/prisma";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getSriDocuments, getSriModuleStatus } from "@/lib/core/sri";
import { resolveTenantAppRouting } from "@/lib/core/tenant-app-routing";
import { getTenantModeState } from "@/lib/core/tenant-mode";

function formatMoney(value: { toString(): string }) {
  return `$${Number(value.toString()).toFixed(2)}`;
}

function getOperatingModeLabel(mode: Awaited<ReturnType<typeof getTenantModeState>>["effectiveOperatingMode"]) {
  if (mode === "DEDICATED_ERP") return "Sistema dedicado";
  if (mode === "SHARED_ERP") return "Gestión empresarial";
  return "Plan básico";
}

function getSriReadinessLabel(
  sriStatus: Awaited<ReturnType<typeof getSriModuleStatus>>
) {
  if (sriStatus.readinessLabel === "production_ready") return "SRI activo";
  if (sriStatus.readinessLabel === "ready_for_testing") return "SRI en pruebas";
  if (sriStatus.readinessLabel === "incomplete") return "SRI incompleto";
  return "SRI pendiente";
}

type TrendPoint = {
  label: string;
  value: number;
};

type DistributionPoint = {
  label: string;
  value: number;
  color: string;
};

async function getBillingAnalytics(tenantId: string): Promise<{
  salesTrend: TrendPoint[];
  distribution: DistributionPoint[];
}> {
  const prisma = getPrismaClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const rangeStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 5, 1);

  const [salesRows, sriRows, receiptCount] = await Promise.all([
    prisma.lightweightSale.findMany({
      where: {
        tenantId,
        status: { not: "canceled" },
        createdAt: { gte: rangeStart },
      },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sriDocument.findMany({
      where: { tenantId },
      select: { status: true },
    }),
    prisma.lightweightSale.count({
      where: { tenantId, status: { not: "canceled" } },
    }),
  ]);

  const formatter = new Intl.DateTimeFormat("es-EC", { month: "short" });
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatter
        .format(date)
        .replace(".", "")
        .replace(/^\w/, (char) => char.toUpperCase()),
      value: 0,
    };
  });
  const bucketMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));

  for (const sale of salesRows) {
    const createdAt = new Date(sale.createdAt);
    const bucket = bucketMap.get(`${createdAt.getFullYear()}-${createdAt.getMonth()}`);
    if (!bucket) continue;
    bucket.value += Number(sale.total.toString());
  }

  const statusCounts = sriRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const pendingCount =
    (statusCounts.DRAFT ?? 0) +
    (statusCounts.READY_FOR_TESTING ?? 0) +
    (statusCounts.SIGNED ?? 0) +
    (statusCounts.SENT ?? 0);

  return {
    salesTrend: monthBuckets,
    distribution: [
      { label: "Recibos", value: receiptCount, color: "var(--facturom-primary)" },
      { label: "Facturas SRI", value: sriRows.length, color: "var(--facturom-primary-soft)" },
      { label: "Autorizadas", value: statusCounts.AUTHORIZED ?? 0, color: "#588100" },
      { label: "Pendientes", value: pendingCount, color: "#a3a3a3" },
      { label: "Rechazadas", value: statusCounts.REJECTED ?? 0, color: "#dc2626" },
    ],
  };
}

function SalesLineChart({ items }: { items: TrendPoint[] }) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  if (items.length === 0 || maxValue <= 0) {
    return <ReportsEmptyState message="Todavía no hay suficiente actividad para mostrar el historial de ventas." />;
  }

  const width = 520;
  const height = 160;
  const paddingX = 16;
  const paddingY = 18;
  const stepX = items.length > 1 ? (width - paddingX * 2) / (items.length - 1) : 0;

  const points = items.map((item, index) => {
    const x = paddingX + stepX * index;
    const ratio = item.value / maxValue;
    const y = height - paddingY - ratio * (height - paddingY * 2);
    return { ...item, x, y };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1]?.x ?? width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`;

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
        <defs>
          <linearGradient id="facturomSalesFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--facturom-primary)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--facturom-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={paddingX} x2={width - paddingX} y1={height - paddingY} y2={height - paddingY} stroke="#e2e8f0" strokeWidth="1" />
        <path d={area} fill="url(#facturomSalesFill)" />
        <path d={path} fill="none" stroke="var(--facturom-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#ffffff" stroke="var(--facturom-primary)" strokeWidth="2" />
          </g>
        ))} 
      </svg>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{formatMoney(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutSummaryChart({ items }: { items: DistributionPoint[] }) {
  const visibleItems = items.filter((item) => item.value > 0);
  const total = visibleItems.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return <ReportsEmptyState message="Aún no hay suficientes documentos para resumir la distribución actual." />;
  }

  let accumulated = 0;
  const gradient = visibleItems
    .map((item) => {
      const start = (accumulated / total) * 100;
      accumulated += item.value;
      const end = (accumulated / total) * 100;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
      <div className="flex items-center justify-center">
        <div
          className="relative h-40 w-40 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</span>
            <span className="mt-1 text-2xl font-black text-slate-950">{total}</span>
          </div>
        </div>
      </div>
      <div className="grid flex-1 gap-2">
        {visibleItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
            </div>
            <span className="text-sm font-black text-slate-950">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof ShoppingCart;
  tone: "green" | "dark" | "neutral";
}) {
  const toneClasses = {
    green: {
      shell: "border-facturom-primary/15 bg-white",
      icon: "bg-facturom-primary text-white",
      helper: "text-facturom-primary",
    },
    dark: {
      shell: "border-slate-900/10 bg-[#0d0f12] text-white",
      icon: "bg-white/10 text-white",
      helper: "text-slate-300",
    },
    neutral: {
      shell: "border-slate-200 bg-white",
      icon: "bg-slate-100 text-slate-700",
      helper: "text-slate-500",
    },
  } as const;

  const currentTone = toneClasses[tone];

  return (
    <Card className={`rounded-[24px] border shadow-sm ${currentTone.shell}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${currentTone.icon}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${currentTone.helper}`}>
            KPI
          </span>
        </div>
        <p className={`mt-4 text-sm font-medium ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{title}</p>
        <p className={`mt-1 text-2xl font-black tracking-tight ${tone === "dark" ? "text-white" : "text-slate-950"}`}>{value}</p>
        <p className={`mt-1 text-xs leading-5 ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{helper}</p>
      </CardContent>
    </Card>
  );
}

function QuickAccessCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof ShoppingCart;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full min-h-[148px] flex-col justify-between rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-facturom-primary hover:bg-facturom-primary hover:text-white"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shadow-sm transition-colors group-hover:bg-white/15 group-hover:text-white">
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
      <div className="mt-4 space-y-1.5">
        <h3 className="text-base font-black text-slate-950 group-hover:text-white">{title}</h3>
        <p className="text-sm leading-5 text-slate-600 group-hover:text-white/82">{description}</p>
      </div>
    </Link>
  );
}

export default async function FacturacionPage() {
  const { tenant } = await requireDashboardSession();
  const [tenantMode, reports, sriStatus, sriDocs, analytics] = await Promise.all([
    getTenantModeState(tenant),
    getBasicReports(tenant.id),
    getSriModuleStatus(tenant.id),
    getSriDocuments(tenant.id, { take: 6 }),
    getBillingAnalytics(tenant.id),
  ]);
  const appRouting = resolveTenantAppRouting(tenantMode);
  const operatingModeLabel = getOperatingModeLabel(tenantMode.effectiveOperatingMode);
  const sriReadinessLabel = getSriReadinessLabel(sriStatus);
  const pendingSriCount = sriDocs.filter((doc) =>
    ["DRAFT", "READY_FOR_TESTING", "SIGNED", "SENT", "REJECTED"].includes(doc.status)
  ).length;
  const internalReceiptCount = Math.max(reports.counts.receipts - sriDocs.length, 0);
  const chartItems = [
    { label: "Productos", value: reports.counts.products, description: "Base del catálogo actual" },
    { label: "Clientes", value: reports.counts.customers, description: "Clientes con actividad registrada" },
    { label: "Recibos", value: reports.counts.receipts, description: "Operación registrada en el módulo" },
    { label: "Pendientes SRI", value: pendingSriCount, description: "Documentos que requieren seguimiento" },
  ];

  const quickActions = [
    {
      href: appRouting.sales.href,
      title: "Nueva venta",
      description: "Inicia una venta y cobra rápido.",
      icon: ShoppingCart,
    },
    {
      href: appRouting.invoicing.href,
      title: "Documentos",
      description: "Revisa comprobantes y estados.",
      icon: ReceiptText,
    },
    {
      href: routes.facturacionCustomers,
      title: "Clientes",
      description: "Consulta tu cartera y su historial.",
      icon: Users,
    },
    {
      href: routes.sriDocuments,
      title: "Facturas SRI",
      description: "Supervisa el estado de tus comprobantes.",
      icon: FileCheck2,
    },
    {
      href: routes.facturacionCash,
      title: "Caja y cierre",
      description: "Revisa cobros y movimientos diarios.",
      icon: Wallet,
    },
    {
      href: appRouting.reports.href,
      title: "Reportes",
      description: "Consulta ventas e inventario.",
      icon: BarChart3,
    },
  ];

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-7xl">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-7">
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Centro de facturación
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Ventas, clientes, inventario y comprobantes electrónicos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {operatingModeLabel}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {sriReadinessLabel}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {tenant.name}
              </span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="rounded-full bg-[#588100] px-5 text-white shadow-md shadow-[#588100]/20 hover:bg-[#4b6f00]"
              >
                <Link href={appRouting.sales.href}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Nueva venta
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50"
              >
                <Link href={appRouting.invoicing.href}>
                  <FileText className="mr-2 h-4 w-4" />
                  Ver documentos
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={ShoppingCart}
            title="Ventas de hoy"
            value={formatMoney(reports.salesToday)}
            helper="Monto vendido y registrado hoy en el módulo."
            tone="green"
          />
          <MetricCard
            icon={CreditCard}
            title="Total del mes"
            value={formatMoney(reports.salesMonth)}
            helper="Acumulado del mes actual."
            tone="green"
          />
          <MetricCard
            icon={Boxes}
            title="Productos activos"
            value={String(reports.counts.products)}
            helper="Productos disponibles en la base operativa."
            tone="neutral"
          />
          <MetricCard
            icon={FileCheck2}
            title="Pendientes SRI"
            value={String(pendingSriCount)}
            helper="Comprobantes que requieren seguimiento."
            tone="dark"
          />
          <MetricCard
            icon={ReceiptText}
            title="Recibos internos"
            value={String(internalReceiptCount)}
            helper="Ventas todavía no vinculadas a documento SRI."
            tone="neutral"
          />
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Accesos rápidos</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Atajos para trabajar más rápido</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <QuickAccessCard key={action.title} {...action} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Historial de ventas</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Evolución mensual de ventas registradas</h3>
                </div>
                <div className="rounded-2xl border border-[#588100]/12 bg-[#588100]/6 px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#588100]">Ingresos</p>
                  <p className="text-lg font-black text-slate-950">{formatMoney(reports.salesMonth)}</p>
                </div>
              </div>
              <SalesLineChart items={analytics.salesTrend} />
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Resumen de ingresos</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Distribución actual de documentos</h3>
                <p className="mt-1 text-sm text-slate-500">Recibos, facturas SRI y estados con datos reales del tenant.</p>
              </div>
              <DonutSummaryChart items={analytics.distribution} />
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Visualización</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Actividad operativa actual</h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                  Resumen rápido
                </span>
              </div>
              <SimpleBarChart
                items={chartItems}
                emptyMessage="Todavía no hay suficiente actividad para visualizar este resumen."
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Estado del módulo
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Facturación y SRI</h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Facturación</p>
                      <p className="text-sm text-slate-500">{appRouting.invoicing.description}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {appRouting.invoicing.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Configuración SRI</p>
                      <p className="text-sm text-slate-500">{sriReadinessLabel}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {sriStatus.environment === "PRODUCTION" ? "Producción" : "Pruebas"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="outline" className="flex-1 rounded-full">
                    <Link href={appRouting.sriConfiguration.href}>Configurar SRI</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1 rounded-full">
                    <Link href={routes.billing}>Ver plan</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#588100]">
                  Seguimiento reciente
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Comprobantes recientes</h3>
                <div className="mt-4 space-y-2.5">
                  {sriDocs.length > 0 ? (
                    sriDocs.slice(0, 4).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{doc.accessKey?.slice(-13) ?? doc.id.slice(-8)}</p>
                          <p className="text-xs text-slate-500">{doc.documentType}</p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {doc.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Aún no hay comprobantes recientes para mostrar.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
