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
  Sparkles,
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
  tone: "green" | "purple" | "dark" | "neutral";
}) {
  const toneClasses = {
    green: {
      shell: "border-[#588100]/15 bg-gradient-to-br from-[#588100]/12 via-white to-[#8db600]/12",
      icon: "bg-gradient-to-br from-[#588100] to-[#8db600] text-white",
      helper: "text-[#588100]",
    },
    purple: {
      shell: "border-[#7f00b2]/15 bg-gradient-to-br from-[#7f00b2]/12 via-white to-[#bc4ed8]/12",
      icon: "bg-gradient-to-br from-[#7f00b2] to-[#bc4ed8] text-white",
      helper: "text-[#7f00b2]",
    },
    dark: {
      shell: "border-slate-900/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white",
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
    <Card className={`rounded-[28px] border shadow-sm ${currentTone.shell}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${currentTone.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${currentTone.helper}`}>
            KPI
          </span>
        </div>
        <p className={`mt-5 text-sm font-medium ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{title}</p>
        <p className={`mt-1 text-3xl font-black tracking-tight ${tone === "dark" ? "text-white" : "text-slate-950"}`}>{value}</p>
        <p className={`mt-2 text-xs leading-5 ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{helper}</p>
      </CardContent>
    </Card>
  );
}

function QuickAccessCard({
  href,
  title,
  description,
  icon: Icon,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof ShoppingCart;
  accent: "green" | "purple" | "mixed" | "dark";
}) {
  const accentClasses = {
    green: "from-[#588100]/12 via-white to-[#8db600]/12 border-[#588100]/15 text-[#588100]",
    purple: "from-[#7f00b2]/12 via-white to-[#bc4ed8]/12 border-[#7f00b2]/15 text-[#7f00b2]",
    mixed: "from-[#588100]/10 via-white to-[#bc4ed8]/12 border-slate-200 text-[#7f00b2]",
    dark: "from-slate-950 via-slate-900 to-slate-800 border-slate-900/10 text-white",
  } as const;

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col justify-between rounded-[28px] border bg-gradient-to-br p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${accentClasses[accent]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent === "dark" ? "bg-white/10" : "bg-white"} shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className={`h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 ${accent === "dark" ? "text-white" : "text-slate-400 group-hover:text-current"}`} />
      </div>
      <div className="mt-8 space-y-2">
        <h3 className={`text-base font-black ${accent === "dark" ? "text-white" : "text-slate-950"}`}>{title}</h3>
        <p className={`text-sm leading-6 ${accent === "dark" ? "text-slate-300" : "text-slate-600"}`}>{description}</p>
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
      description: "Abre el flujo principal para vender y cobrar con menos pasos.",
      icon: ShoppingCart,
      accent: "green" as const,
    },
    {
      href: appRouting.invoicing.href,
      title: "Documentos",
      description: "Consulta comprobantes, estados y seguimiento de facturación.",
      icon: ReceiptText,
      accent: "purple" as const,
    },
    {
      href: routes.facturacionCustomers,
      title: "Clientes",
      description: "Revisa tu base comercial y entra rápido al historial del cliente.",
      icon: Users,
      accent: "mixed" as const,
    },
    {
      href: routes.sriDocuments,
      title: "Facturas SRI",
      description: "Supervisa documentos electrónicos y su estado operativo.",
      icon: FileCheck2,
      accent: "dark" as const,
    },
    {
      href: routes.facturacionCash,
      title: "Caja y cierre",
      description: "Controla cobros, movimientos y el pulso diario de caja.",
      icon: Wallet,
      accent: "green" as const,
    },
    {
      href: appRouting.reports.href,
      title: "Reportes",
      description: "Consulta ventas, inventario y resultados de tu operación.",
      icon: BarChart3,
      accent: "purple" as const,
    },
  ];

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-7xl">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[36px] border border-white/80 bg-gradient-to-br from-[#588100]/12 via-white to-[#bc4ed8]/12 px-6 py-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:px-8 sm:py-10">
          <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#588100]/15 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#588100] shadow-sm">
                Módulo de facturación
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  Centro de facturación
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                  Controla ventas, clientes, inventario y comprobantes electrónicos desde un solo lugar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                  {operatingModeLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                  {sriReadinessLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                  Empresa: {tenant.name}
                </span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="rounded-full bg-gradient-to-r from-[#588100] to-[#8db600] px-6 text-white shadow-md shadow-[#588100]/20 hover:opacity-95"
                >
                  <Link href={appRouting.sales.href}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Nueva venta
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-slate-200 bg-white px-6 text-slate-700 hover:border-[#7f00b2]/20 hover:text-[#7f00b2]"
                >
                  <Link href={appRouting.invoicing.href}>
                    <FileText className="mr-2 h-4 w-4" />
                    Ver documentos
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="rounded-[32px] border-slate-200/70 bg-slate-950 text-white shadow-xl shadow-slate-900/15">
              <CardContent className="p-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-[#8db600]" />
                  Acceso principal
                </div>
                <h2 className="mt-4 text-2xl font-black">Una sola estructura para todos los planes</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  El módulo conserva la misma base visual y cambia solo lo que el tenant tiene habilitado:
                  acciones, submenús y fuentes de datos.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-slate-400">Ventas del mes</p>
                    <p className="mt-2 text-xl font-black">{formatMoney(reports.salesMonth)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-slate-400">Pendientes SRI</p>
                    <p className="mt-2 text-xl font-black">{pendingSriCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            tone="purple"
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

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Accesos rápidos</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Atajos para trabajar más rápido</h2>
            <p className="mt-1 text-sm text-slate-600">
              Entra directo a ventas, documentos, clientes, caja, reportes y seguimiento SRI.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <QuickAccessCard key={action.title} {...action} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Visualización
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">Actividad operativa del módulo</h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                  Resumen actual
                </span>
              </div>
              <SimpleBarChart
                items={chartItems}
                emptyMessage="Todavía no hay suficiente actividad para visualizar este resumen."
              />
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Estado del módulo
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">Facturación y SRI</h3>
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Facturación</p>
                      <p className="text-sm text-slate-500">{appRouting.invoicing.description}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {appRouting.invoicing.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Configuración SRI</p>
                      <p className="text-sm text-slate-500">{sriReadinessLabel}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {sriStatus.environment === "PRODUCTION" ? "Producción" : "Pruebas"}
                    </span>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="outline" className="flex-1 rounded-full">
                    <Link href={appRouting.sriConfiguration.href}>Configurar SRI</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1 rounded-full">
                    <Link href={routes.billing}>Ver plan</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-slate-200 bg-gradient-to-br from-[#7f00b2]/10 via-white to-[#588100]/10 shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7f00b2]">
                  Seguimiento reciente
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">Comprobantes recientes</h3>
                <div className="mt-5 space-y-3">
                  {sriDocs.length > 0 ? (
                    sriDocs.slice(0, 4).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
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
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-5 text-sm text-slate-500">
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
