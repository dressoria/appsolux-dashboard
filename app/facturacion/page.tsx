import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  BookOpen,
  Building2,
  CircleDollarSign,
  CreditCard,
  FileCheck2,
  Package,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SalesPeriodChart } from "@/components/appsolux/facturacion/sales-period-chart";
import { HomeShortcutsEditor } from "@/components/appsolux/facturacion/home-shortcuts-editor";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getSriDocuments } from "@/lib/core/sri";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  getUserShortcutKeys,
  resolveShortcuts,
  getShortcutCatalog,
} from "@/lib/core/home-preferences";
import {
  getFinancialSummary,
  formatPercentChange,
} from "@/lib/core/home-financial-summary";

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
    timeZone: "UTC",
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
  const [sales, documentRows, recentDocuments] = await Promise.all([
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
      thisMonth: documentRows.filter(
        (document) => document.createdAt >= monthStart,
      ).length,
      authorized: statusCounts.AUTHORIZED ?? 0,
      pending: pendingStatuses.reduce(
        (sum, status) => sum + (statusCounts[status] ?? 0),
        0,
      ),
      rejected: statusCounts.REJECTED ?? 0,
    },
  };
}

const iconMap: Record<string, LucideIcon> = {
  ReceiptText,
  ShoppingCart,
  BookOpen,
  FileCheck2,
  Package,
  Users,
  Wallet,
  Building2,
  ShieldCheck,
  Settings2,
};

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
  icon: LucideIcon;
  tone?: "blue" | "orange";
}) {
  return (
    <Card className="overflow-hidden rounded-xl border border-[#E4E9F0] bg-white shadow-sm ring-0">
      <div
        className={`h-1 ${tone === "orange" ? "bg-gradient-to-r from-amber-400 to-amber-300" : "bg-gradient-to-r from-[#1769E0] to-[#1E52F1]"}`}
      />
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#667085]">{title}</p>
          <span
            className={`flex size-10 items-center justify-center rounded-xl ${tone === "orange" ? "bg-amber-50 text-amber-600" : "bg-[#EEF5FF] text-[#1769E0]"}`}
          >
            <Icon className="size-5" />
          </span>
        </div>
        <p
          className={`mt-3 text-2xl font-bold tracking-tight ${tone === "orange" ? "text-amber-700" : "text-[#1769E0]"}`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-[#667085]">{helper}</p>
      </CardContent>
    </Card>
  );
}

function FinancialCard({
  title,
  amount,
  subtitle,
  change,
  icon: Icon,
  tone,
}: {
  title: string;
  amount: string;
  subtitle: string;
  change?: { text: string; positive: boolean | null };
  icon: LucideIcon;
  tone: "blue" | "orange" | "emerald" | "amber";
}) {
  const toneClasses = {
    blue: { bg: "bg-blue-50/60", icon: "bg-[#EEF5FF] text-[#1769E0]", text: "text-[#1769E0]" },
    orange: { bg: "bg-amber-50/40", icon: "bg-amber-50 text-amber-600", text: "text-amber-700" },
    emerald: { bg: "bg-emerald-50/40", icon: "bg-emerald-50 text-emerald-600", text: "text-emerald-700" },
    amber: { bg: "bg-amber-50/40", icon: "bg-amber-50 text-amber-600", text: "text-amber-700" },
  };
  const t = toneClasses[tone];

  return (
    <Card className={`overflow-hidden rounded-xl border border-[#E4E9F0] shadow-sm ring-0 ${t.bg}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#667085]">{title}</p>
            <p className={`mt-2 text-xl font-bold tracking-tight sm:text-2xl ${t.text}`}>
              {amount}
            </p>
            <p className="mt-1 text-xs text-[#667085]">{subtitle}</p>
          </div>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${t.icon}`}>
            <Icon className="size-5" />
          </span>
        </div>
        {change && (
          <div className="mt-3 flex items-center gap-1">
            {change.positive === true && <ArrowUpRight className="size-3.5 text-emerald-600" />}
            {change.positive === false && <ArrowDownRight className="size-3.5 text-red-500" />}
            <span className={`text-xs font-medium ${change.positive === true ? "text-emerald-600" : change.positive === false ? "text-red-500" : "text-[#667085]"}`}>
              {change.text}
            </span>
            {change.positive !== null && (
              <span className="text-xs text-[#667085]">vs mes anterior</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function FacturacionPage() {
  const { user, tenant } = await requireDashboardSession();
  const [reports, dashboard, tenantMode, shortcutKeys, financial] =
    await Promise.all([
      getBasicReports(tenant.id),
      getDashboardData(tenant.id),
      getTenantModeState(tenant),
      getUserShortcutKeys(user.id, tenant.id),
      getFinancialSummary(tenant.id),
    ]);
  const name = user.name?.trim();
  const shortcuts = resolveShortcuts(shortcutKeys);
  const catalog = getShortcutCatalog();

  const salesChange = formatPercentChange(financial.salesMonth, financial.salesPrevMonth);
  const purchasesChange = formatPercentChange(financial.purchasesMonth, financial.purchasesPrevMonth);

  return (
    <DashboardShell
      mainClassName="px-4 py-5 sm:px-6 sm:py-6"
      contentClassName="mx-auto max-w-[1440px]"
    >
      <div className="min-w-0 space-y-6 pb-24">
        {/* ── Header ── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-[#172033]">
              {name ? `Hola, ${name} 👋` : "Hola 👋"}
            </h1>
            <p className="mt-1 text-sm text-[#667085]">
              Resumen general de tu empresa
            </p>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button asChild variant="outline" size="lg" className="border-[#E4E9F0] font-medium text-[#172033] shadow-sm hover:border-[#1769E0] hover:text-[#1769E0]">
              <Link href={routes.billing}>
                <CreditCard className="size-4" />
                Mi plan
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-[#F59E0B] font-semibold text-[#172033] shadow-sm hover:bg-[#D97706]">
              <Link href={routes.facturacionPos}>
                <ShoppingCart className="size-4" />
                Nueva venta
              </Link>
            </Button>
          </div>
        </header>

        {/* ── KPI cards ── */}
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

        {/* ── Comprobantes chips ── */}
        <section className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.facturacionDocuments}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <span className="size-2 rounded-full bg-emerald-500" />
            Autorizados: {dashboard.documentCounts.authorized}
          </Link>
          <Link
            href={routes.facturacionDocuments}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            <span className="size-2 rounded-full bg-amber-500" />
            Pendientes: {dashboard.documentCounts.pending}
          </Link>
          <Link
            href={routes.facturacionDocuments}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            <span className="size-2 rounded-full bg-red-500" />
            Rechazados: {dashboard.documentCounts.rejected}
          </Link>
          <Link
            href={routes.facturacionDocuments}
            className="ml-auto text-xs font-medium text-[#1769E0] hover:underline"
          >
            Ver documentos →
          </Link>
        </section>

        {/* ── Financial summary ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#172033]">
            Resumen financiero
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FinancialCard
              title="Ventas mensuales"
              amount={formatMoney(financial.salesMonth)}
              subtitle="Mes actual"
              change={salesChange}
              icon={TrendingUp}
              tone="emerald"
            />
            <FinancialCard
              title="Compras mensuales"
              amount={formatMoney(financial.purchasesMonth)}
              subtitle="Mes actual"
              change={purchasesChange}
              icon={ShoppingCart}
              tone="orange"
            />
            <FinancialCard
              title="Cuentas por cobrar"
              amount={formatMoney(financial.receivables)}
              subtitle={
                financial.receivablesCount > 0
                  ? `${financial.receivablesCount} obligación${financial.receivablesCount > 1 ? "es" : ""} pendiente${financial.receivablesCount > 1 ? "s" : ""}`
                  : "Saldo pendiente"
              }
              icon={BadgeDollarSign}
              tone="blue"
            />
            <FinancialCard
              title="Cuentas por pagar"
              amount={formatMoney(financial.payables)}
              subtitle={
                financial.payablesCount > 0
                  ? `${financial.payablesCount} obligación${financial.payablesCount > 1 ? "es" : ""} pendiente${financial.payablesCount > 1 ? "s" : ""}`
                  : "Saldo pendiente"
              }
              icon={Wallet}
              tone="amber"
            />
          </div>
        </section>

        {/* ── Chart + Activity ── */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
          <Card className="overflow-hidden rounded-xl border border-[#E4E9F0] bg-white shadow-sm ring-0">
            <CardContent className="p-4 sm:p-5">
              <SalesPeriodChart items={dashboard.dailySales} />
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-xl border border-[#E4E9F0] bg-white shadow-sm ring-0">
            <div className="border-b border-[#E4E9F0] bg-[#F8FAFD] px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#172033]">
                  Actividad reciente
                </h2>
                <Link
                  href={routes.facturacionDocuments}
                  className="text-xs font-medium text-[#1769E0] hover:underline"
                >
                  Ver todos
                </Link>
              </div>
            </div>
            <div>
              {dashboard.recentDocuments.length ? (
                <div className="divide-y divide-[#E4E9F0]">
                  {dashboard.recentDocuments.slice(0, 6).map((doc) => {
                    const status = documentStatus(doc.status);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-blue-50/30 sm:px-5"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF5FF] text-[#1769E0]">
                          <ReceiptText className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#172033]">
                            {doc.customerName}
                          </p>
                          <p className="text-xs text-[#667085]">
                            {formatDate(doc.issuedAt ?? doc.createdAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-[#172033]">
                            {formatMoney(doc.grandTotal)}
                          </p>
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-[#667085]">
                  Aún no hay comprobantes recientes.
                </p>
              )}
            </div>
          </Card>
        </section>

        {/* ── Quick actions ── */}
        <section aria-labelledby="quick-actions-title">
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="quick-actions-title"
                className="text-lg font-semibold text-[#172033]"
              >
                Acciones rápidas
              </h2>
              <p className="mt-1 text-sm text-[#667085]">
                Lo que necesitas para seguir con tu día.
              </p>
            </div>
            <HomeShortcutsEditor
              initialKeys={shortcutKeys}
              catalog={catalog}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shortcuts.map(({ key, title, description, icon, href, tone }) => {
              const Icon = iconMap[icon] || FileCheck2;
              return (
                <Link
                  key={key}
                  href={href}
                  className={`group flex min-h-[140px] min-w-0 flex-col items-start rounded-2xl border border-[#E4E9F0] p-5 shadow-sm transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1769E0] ${
                    tone === "orange"
                      ? "bg-amber-50/20 hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-md hover:shadow-amber-100/60"
                      : "bg-blue-50/20 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md hover:shadow-blue-100/60"
                  }`}
                >
                  <span
                    className={`mb-4 flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone === "orange" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-[#1769E0]"}`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-[#172033]">
                    {title}
                  </span>
                  <span className="mt-1 text-xs leading-5 text-[#667085]">
                    {description}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── AI invoicing FAB ── */}
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
