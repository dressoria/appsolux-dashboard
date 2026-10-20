import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  BookOpen,
  Building2,
  FileCheck2,
  Package,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { HomeTabs } from "@/components/appsolux/facturacion/home-tabs";
import { SalesPeriodChart } from "@/components/appsolux/facturacion/sales-period-chart";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getSriDocuments } from "@/lib/core/sri";
import { getTenantModeState } from "@/lib/core/tenant-mode";
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
  const [sales, documentRows, recentDocuments] =
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
  };
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof ShoppingCart;
  tone?: "blue" | "orange";
}) {
  return (
    <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none ring-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#667085]">{title}</p>
          <span className={`flex size-9 items-center justify-center rounded-xl ${tone === "orange" ? "bg-amber-50 text-amber-700" : "bg-[#EEF5FF] text-[#1769E0]"}`}>
            <Icon className="size-4" />
          </span>
        </div>
        <p className={`mt-3 text-2xl font-semibold tracking-tight ${tone === "orange" ? "text-amber-700" : "text-[#1769E0]"}`}>
          {value}
        </p>
        <p className="mt-1 text-xs text-[#667085]">{helper}</p>
      </CardContent>
    </Card>
  );
}

const quickActions = [
  { title: "Emitir factura", description: "Una nueva venta, lista en minutos", href: routes.facturacionPos, icon: ReceiptText, tone: "orange" },
  { title: "Crear compra", description: "Registra una compra de tu negocio", href: routes.facturacionPurchasesNew, icon: ShoppingCart, tone: "blue" },
  { title: "Libro diario", description: "Consulta tus asientos contables", href: routes.facturacionAccountingJournal, icon: BookOpen, tone: "blue" },
  { title: "Productos", description: "Tu catálogo, siempre a mano", href: routes.facturacionProducts, icon: Package, tone: "orange" },
  { title: "Clientes", description: "Gestiona tus contactos", href: routes.facturacionCustomers, icon: Users, tone: "blue" },
  { title: "Caja", description: "Consulta los movimientos de caja", href: routes.facturacionCash, icon: Wallet, tone: "orange" },
  { title: "Empresa", description: "La configuración de tu negocio", href: routes.facturacionSettings, icon: Building2, tone: "blue" },
];

function QuickActions() {
  return <section aria-labelledby="quick-actions-title">
    <h2 id="quick-actions-title" className="text-lg font-semibold text-[#172033]">Acciones rápidas</h2>
    <p className="mt-1 text-sm text-[#667085]">Lo que necesitas para seguir con tu día.</p>
    <div className="mt-5 grid grid-cols-1 gap-4 min-[375px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
      {quickActions.map(({ title, description, href, icon: Icon, tone }) => <Link key={title} href={href}
        className={`group flex min-h-44 min-w-0 flex-col items-start rounded-2xl border border-[#E4E9F0] bg-white p-5 shadow-sm transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-facturom-primary sm:p-6 ${tone === "orange" ? "hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-amber-100/60" : "hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-blue-100/60"}`}>
        <span className={`mb-5 flex size-12 shrink-0 items-center justify-center rounded-2xl ${tone === "orange" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-[#1769E0]"}`}><Icon className="size-6" aria-hidden="true" /></span>
        <span className="text-base font-semibold text-[#172033]">{title}</span>
        <span className="mt-1 text-xs leading-5 text-[#667085]">{description}</span>
      </Link>)}
    </div>
  </section>;
}

export default async function FacturacionPage() {
  const { user, tenant } = await requireDashboardSession();
  const [reports, dashboard, tenantMode] = await Promise.all([
    getBasicReports(tenant.id),
    getDashboardData(tenant.id),
    getTenantModeState(tenant),
  ]);
  const name = user.name?.trim();

  return (
    <DashboardShell
      mainClassName="px-4 py-5 sm:px-6 sm:py-6"
      contentClassName="mx-auto max-w-[1440px]"
    >
      <div className="min-w-0 space-y-5 pb-24">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-[#172033]">
              {name ? `Hola, ${name} 👋` : "Hola 👋"}
            </h1>
            <p className="mt-1 text-sm text-[#667085]">
              Resumen general de tu empresa
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="w-full bg-[#F59E0B] font-semibold text-[#172033] hover:bg-[#D97706] sm:w-auto sm:shrink-0"
          >
            <Link href={routes.facturacionPos}>
              <ShoppingCart />
              Nueva venta
            </Link>
          </Button>
        </header>
        <HomeTabs shortcuts={<QuickActions />} summary={<>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Ventas del día"
            value={formatMoney(reports.salesToday)}
            helper="Ventas registradas hoy"
            icon={CircleDollarSign}
          />
          <MetricCard
            tone="orange"
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
            tone="orange"
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
        </section>
        </>} />
      </div>
      {tenantMode.canAccessAiInvoicing && (
        <Link
          href={routes.facturacionAi}
          className="fixed bottom-5 right-4 z-30 flex max-w-[calc(100vw_-_2rem)] items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-800 shadow-lg shadow-amber-950/10 transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600 sm:bottom-6 sm:right-6 sm:px-5"
        >
          <Sparkles className="size-4 shrink-0 text-amber-600" />
          Facturación inteligente
        </Link>
      )}
    </DashboardShell>
  );
}
