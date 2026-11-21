import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  CircleDollarSign,
  FileCheck2,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SalesPeriodChart } from "@/components/appsolux/facturacion/sales-period-chart";
import { HomeQuickActions } from "@/components/appsolux/facturacion/home-quick-actions";
import { HomeShortcutsEditor } from "@/components/appsolux/facturacion/home-shortcuts-editor";
import styles from "@/components/appsolux/facturacion/home.module.css";
import { HomeTabs } from "@/components/appsolux/facturacion/home-tabs";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
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
  const toneClass = tone === "blue" || tone === "emerald" ? styles.metricNavy : styles.metricPink;

  return (
    <Card className={`overflow-hidden rounded-xl border border-[#E4E9F0] shadow-sm ring-0 ${toneClass}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#667085]">{title}</p>
            <p className={`mt-2 text-xl font-bold tracking-tight sm:text-2xl ${styles.metricAmount}`}>
              {amount}
            </p>
            <p className="mt-1 text-xs text-[#667085]">{subtitle}</p>
          </div>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${styles.metricIcon}`}>
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
  const shortcuts = resolveShortcuts(shortcutKeys);
  const catalog = getShortcutCatalog();

  const salesChange = formatPercentChange(financial.salesMonth, financial.salesPrevMonth);
  const purchasesChange = formatPercentChange(financial.purchasesMonth, financial.purchasesPrevMonth);

  /* ── Shortcuts tab ────────────────────────────────────────────────── */
  const shortcutsContent = (
    <HomeQuickActions shortcuts={shortcuts} />
  );

  /* ── Summary tab ──────────────────────────────────────────────────── */
  const summaryContent = (
    <>
      <div className={styles.summaryIntro}>
        <Star className="size-5" aria-hidden="true" />
        <div>
          <h2>Tu negocio, de un vistazo</h2>
          <p>Tu aliado para facturar, controlar y hacer crecer tu negocio.</p>
        </div>
      </div>

      {/* KPIs — compact single card */}
      <Card className="overflow-hidden rounded-xl border border-[#E4E9F0] shadow-sm ring-0">
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-[#000345]">Resumen rápido</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiMetric
              label="Ventas del día"
              value={formatMoney(reports.salesToday)}
              icon={CircleDollarSign}
              tone="blue"
            />
            <KpiMetric
              label="Facturado este mes"
              value={formatMoney(reports.salesMonth)}
              icon={ShoppingCart}
              tone="amber"
            />
            <KpiMetric
              label="Documentos este mes"
              value={String(dashboard.documentCounts.thisMonth)}
              icon={FileCheck2}
              tone="blue"
            />
            <KpiMetric
              label="Pendientes SRI"
              value={String(dashboard.documentCounts.pending)}
              icon={AlertTriangle}
              tone="amber"
              semanticPending
            />
          </div>
        </CardContent>
      </Card>

      {/* Comprobantes chips */}
      <section className="flex flex-wrap items-center gap-2">
        <Link
          href={routes.facturacionDocuments}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E7E7EF] bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <span className="size-2 rounded-full bg-emerald-500" />
          Autorizados: {dashboard.documentCounts.authorized}
        </Link>
        <Link
          href={routes.facturacionDocuments}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E7E7EF] bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
        >
          <span className="size-2 rounded-full bg-amber-500" />
          Pendientes: {dashboard.documentCounts.pending}
        </Link>
        <Link
          href={routes.facturacionDocuments}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E7E7EF] bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          <span className="size-2 rounded-full bg-red-500" />
          Rechazados: {dashboard.documentCounts.rejected}
        </Link>
        <Link
          href={routes.facturacionDocuments}
          className="ml-auto text-xs font-medium text-[#000345] hover:underline"
        >
          Ver documentos →
        </Link>
      </section>

      {/* Financial summary */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#000345]">
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

      {/* Chart + Activity — 50/50 */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-xl border border-[#E4E9F0] bg-white shadow-sm ring-0">
          <CardContent className="p-4 sm:p-5">
            <SalesPeriodChart items={dashboard.dailySales} />
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-xl border border-[#E4E9F0] bg-white shadow-sm ring-0">
          <div className="border-b border-[#E4E9F0] bg-[#F8FAFD] px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#000345]">
                Actividad reciente
              </h2>
              <Link
                href={routes.facturacionDocuments}
                className="text-xs font-medium text-[#000345] hover:underline"
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
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F2F2F8] text-[#000345]">
                        <ReceiptText className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#000345]">
                          {doc.customerName}
                        </p>
                        <p className="text-xs text-[#667085]">
                          {formatDate(doc.issuedAt ?? doc.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-[#000345]">
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
    </>
  );

  return (
    <DashboardShell
      mainClassName="px-4 py-6 sm:px-7 sm:py-8 xl:px-10"
      contentClassName="mx-auto max-w-[1440px]"
    >
      <div className={styles.page}>
        {/* ── Header ── */}
        <header className={styles.hero}>
          <div className="min-w-0">
            <span className={styles.eyebrow}>Inicio</span>
            <h1>
              Resumen general
            </h1>
            <p>
              Todo lo que necesitas para gestionar tu negocio, en un solo lugar.
            </p>
          </div>
        </header>

        <HomeTabs
          shortcuts={shortcutsContent}
          summary={summaryContent}
          actions={
            <>
              <Link href={routes.facturacionPos} className={`${styles.actionLink} ${styles.primaryLink}`}>
                <ShoppingCart className="size-4" aria-hidden="true" />
                Nueva venta
              </Link>
              <HomeShortcutsEditor initialKeys={shortcutKeys} catalog={catalog} />
            </>
          }
        />
      </div>

      {/* ── AI invoicing FAB ── */}
      {tenantMode.canAccessAiInvoicing && (
        <Link
          href={routes.facturacionAi}
          className={`${styles.actionLink} ${styles.fab}`}
        >
          <Sparkles className="size-4 shrink-0" />
          Facturación inteligente
        </Link>
      )}
    </DashboardShell>
  );
}

function KpiMetric({
  label,
  value,
  icon: Icon,
  tone,
  semanticPending = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "blue" | "amber";
  semanticPending?: boolean;
}) {
  const toneClass = semanticPending ? styles.metricPending : tone === "amber" ? styles.metricPink : styles.metricNavy;

  return (
    <div className={`flex items-center gap-3 ${toneClass}`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${styles.metricIcon}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[#667085]">{label}</p>
        <p className={`text-lg font-bold tracking-tight ${styles.metricAmount}`}>{value}</p>
      </div>
    </div>
  );
}
