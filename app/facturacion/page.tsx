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
import { SimpleBarChart } from "@/components/appsolux/reports/simple-bar-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
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
      shell: "border-[#588100]/15 bg-white",
      icon: "bg-[#588100] text-white",
      helper: "text-[#588100]",
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
      className="group flex h-full min-h-[148px] flex-col justify-between rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#588100] hover:bg-[#588100] hover:text-white hover:shadow-[0_16px_40px_rgba(88,129,0,0.16)]"
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
  const [tenantMode, reports, sriStatus, sriDocs] = await Promise.all([
    getTenantModeState(tenant),
    getBasicReports(tenant.id),
    getSriModuleStatus(tenant.id),
    getSriDocuments(tenant.id, { take: 6 }),
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

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Resumen de ingresos
                  </p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Tendencia mensual</h3>
                  <p className="mt-1 text-sm text-slate-500">Ventas recientes con base en la actividad actual.</p>
                </div>
                <div className="rounded-2xl border border-[#588100]/12 bg-[#588100]/6 px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#588100]">Ingresos</p>
                  <p className="text-lg font-black text-slate-950">{formatMoney(reports.salesMonth)}</p>
                </div>
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
