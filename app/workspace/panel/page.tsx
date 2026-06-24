import Link from "next/link";
import {
  BarChart3,
  Boxes,
  CreditCard,
  FileCheck,
  MessageSquareText,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import {
  AppCard,
  MetricCard,
  QuickActionCard,
  SectionHeader,
  StatusBadge,
} from "@/components/appsolux/workspace/workspace-ui";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { resolveTenantAppRouting } from "@/lib/core/tenant-app-routing";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getSriModuleStatus } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getSriSignatureLabel(
  sriStatus: Awaited<ReturnType<typeof getSriModuleStatus>>
) {
  if (sriStatus.signatureStatus === "EXPIRED") return "Expirada";
  if (sriStatus.signatureStatus === "READY_FOR_TESTING") return "Lista";
  if (sriStatus.signatureHasEncryptedCertificate && sriStatus.signatureHasEncryptedPassword) {
    return "Certificado cargado";
  }
  if (sriStatus.signatureStatus === "UPLOADED_METADATA_ONLY") return "Metadata";
  return "No configurada";
}

function getOperatingModeLabel(mode: Awaited<ReturnType<typeof getTenantModeState>>["effectiveOperatingMode"]) {
  if (mode === "DEDICATED_ERP") return "Motor dedicado";
  if (mode === "SHARED_ERP") return "Motor empresarial";
  return "Motor basico";
}

export default async function WorkspacePanelPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [tenantMode, sriStatus, basicReports] = await Promise.all([
    getTenantModeState(tenant),
    getSriModuleStatus(tenant.id),
    getBasicReports(tenant.id),
  ]);
  const appRouting = resolveTenantAppRouting(tenantMode);

  const sriReadinessVariant =
    sriStatus.readinessLabel === "not_started"
      ? ("pending" as const)
      : sriStatus.readinessLabel === "incomplete"
        ? ("incomplete" as const)
        : sriStatus.readinessLabel === "ready_for_testing"
          ? ("testing" as const)
          : ("active" as const);
  const sriReadinessLabel =
    sriStatus.readinessLabel === "not_started"
      ? "Pendiente"
      : sriStatus.readinessLabel === "incomplete"
        ? "Incompleto"
        : sriStatus.readinessLabel === "ready_for_testing"
          ? "Listo para pruebas"
          : "Configurado para produccion";
  const sriConfigurationComplete =
    sriStatus.profileStatus === "CONFIGURED" &&
    sriStatus.establishmentCount > 0 &&
    sriStatus.issuePointCount > 0 &&
    sriStatus.sequenceCount > 0;
  const sriSignatureLabel = getSriSignatureLabel(sriStatus);
  const operatingModeLabel = getOperatingModeLabel(tenantMode.effectiveOperatingMode);
  const invoicingStatusVariant = appRouting.invoicing.isEnabled
    ? sriReadinessVariant
    : appRouting.invoicing.statusVariant;
  const invoicingStatusLabel = appRouting.invoicing.isEnabled
    ? sriReadinessLabel
    : appRouting.invoicing.statusLabel;
  const sriConfigStatusVariant = appRouting.sriConfiguration.isEnabled
    ? sriReadinessVariant
    : appRouting.sriConfiguration.statusVariant;
  const sriConfigStatusLabel = appRouting.sriConfiguration.isEnabled
    ? sriReadinessLabel
    : appRouting.sriConfiguration.statusLabel;
  const quickSriCard = appRouting.invoicing.isEnabled
    ? {
        href: appRouting.invoicing.href,
        title: "Ver facturacion",
        description: "Seguimiento de comprobantes, estados y revision operativa.",
        icon: ReceiptText,
      }
    : {
        href: appRouting.sriConfiguration.href,
        title: "Preparar SRI",
        description: appRouting.invoicing.helperText,
        icon: Settings2,
      };

  return (
    <DashboardShell contentClassName="mx-auto max-w-7xl">
      <div className="space-y-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Panel Completo</h2>
          <Button asChild variant="outline" size="sm" className="rounded-full text-sm">
            <Link href={routes.workspace}>← Volver al inicio</Link>
          </Button>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.45fr_0.95fr] lg:px-8">
            <div className="space-y-6">
              <SectionHeader
                eyebrow="Fase 3"
                title="Mis Aplicaciones"
                description="El launcher ahora respeta el motor operativo efectivo del tenant para mostrar Facturacion como experiencia principal sin rutas rotas."
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Productos"
                  value={tenantMode.shouldUseAdvancedMode ? "Suite" : String(basicReports.counts.products)}
                  helper={
                    tenantMode.shouldUseAdvancedMode
                      ? "Catalogo principal administrado desde Facturacion con motor empresarial"
                      : "Catalogo disponible para venta y control de stock"
                  }
                />
                <MetricCard
                  label="Clientes"
                  value={tenantMode.shouldUseAdvancedMode ? "Suite" : String(basicReports.counts.customers)}
                  helper={
                    tenantMode.shouldUseAdvancedMode
                      ? "Base comercial centralizada en Facturacion con motor empresarial"
                      : "Base activa para ventas, cobranza y fidelizacion"
                  }
                />
                <MetricCard
                  label="Motor"
                  value={operatingModeLabel}
                  helper={`Plan ${tenantMode.publicPlan} · Estado ${tenantMode.businessSuiteStatus}`}
                />
                <MetricCard
                  label="Estado SRI"
                  value={appRouting.sriConfiguration.isEnabled ? sriReadinessLabel : appRouting.sriConfiguration.statusLabel}
                  helper={`Firma: ${sriSignatureLabel} · Ambiente ${
                    sriStatus.environment === "TEST"
                      ? "Pruebas"
                      : sriStatus.environment === "PRODUCTION"
                        ? "Produccion"
                        : "Sin definir"
                  }`}
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-sky-100 bg-white/90 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Operacion recomendada</p>
                  <p className="text-sm text-slate-600">
                    Inventario y ventas se abren desde Facturacion usando el motor activo del tenant, mientras SRI queda separado para configuracion y facturacion.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <QuickActionCard
                  href={appRouting.inventory.href}
                  title={tenantMode.shouldUseAdvancedMode ? "Revisar inventario empresarial" : "Revisar inventario"}
                  description={
                    tenantMode.shouldUseAdvancedMode
                      ? "Consulta stock, bodegas, kardex y productos criticos."
                      : "Consulta stock, productos criticos y movimientos del Core."
                  }
                  icon={Boxes}
                />
                <QuickActionCard
                  href={appRouting.sales.href}
                  title="Abrir POS / Ventas"
                  description={
                    tenantMode.shouldUseAdvancedMode
                      ? "Registrar ventas y cobrar desde el flujo avanzado de Facturacion."
                      : "Registrar ventas y cobrar sin navegar por modulos tecnicos."
                  }
                  icon={ShoppingCart}
                />
                <QuickActionCard
                  href={quickSriCard.href}
                  title={quickSriCard.title}
                  description={quickSriCard.description}
                  icon={quickSriCard.icon}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">
                  Plan activo: {tenantMode.planName}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Modo efectivo: {operatingModeLabel} · Productos: {basicReports.counts.products}/{tenantMode.limits.products} ·
                  Clientes: {basicReports.counts.customers}/{tenantMode.limits.customers}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={routes.billing}>Ver plan</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="Apps principales"
            title="Operacion del dia"
            description="Las apps principales ahora se resuelven por acceso efectivo para evitar enviar al usuario a modulos que no tiene activos."
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <AppCard
              icon={Boxes}
              title="Inventario"
              description={appRouting.inventory.description}
              features={appRouting.inventory.features}
              status={
                <StatusBadge
                  variant={appRouting.inventory.statusVariant}
                  label={appRouting.inventory.statusLabel}
                />
              }
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Motor</p>
                    <p className="font-semibold text-slate-900">{operatingModeLabel}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">
                      {tenantMode.shouldUseAdvancedMode ? "Operacion" : "Stock critico"}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {tenantMode.shouldUseAdvancedMode
                        ? "Suite"
                        : basicReports.outOfStockProducts.length + basicReports.lowStockProducts.length}
                    </p>
                  </div>
                </div>
              }
              href={appRouting.inventory.href}
              priority
              actionLabel={appRouting.inventory.actionLabel}
              buttonVariant={appRouting.inventory.buttonVariant}
            />

            <AppCard
              icon={ShoppingCart}
              title="POS / Ventas"
              description={appRouting.sales.description}
              features={appRouting.sales.features}
              status={
                <StatusBadge
                  variant={appRouting.sales.statusVariant}
                  label={appRouting.sales.statusLabel}
                />
              }
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">
                      {tenantMode.shouldUseAdvancedMode ? "Flujo" : "Ventas"}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {tenantMode.shouldUseAdvancedMode ? "Suite" : basicReports.counts.receipts}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">
                      {tenantMode.shouldUseAdvancedMode ? "Clientes" : "Base"}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {tenantMode.shouldUseAdvancedMode ? "Suite" : basicReports.counts.customers}
                    </p>
                  </div>
                </div>
              }
              href={appRouting.sales.href}
              priority
              actionLabel={appRouting.sales.actionLabel}
              buttonVariant={appRouting.sales.buttonVariant}
            />

            <AppCard
              icon={FileCheck}
              title="Facturacion"
              description={appRouting.invoicing.description}
              features={appRouting.invoicing.features}
              status={<StatusBadge variant={invoicingStatusVariant} label={invoicingStatusLabel} />}
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Configuracion</p>
                    <p className="font-semibold text-slate-900">
                      {sriConfigurationComplete ? "Completa" : appRouting.invoicing.isEnabled ? "Pendiente" : "No habilitada"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Documentos</p>
                    <p className="font-semibold text-slate-900">
                      {appRouting.invoicing.isEnabled
                        ? sriStatus.documentStatusCounts.signed > 0
                          ? `${sriStatus.documentStatusCounts.signed} firmados`
                          : sriStatus.documentStatusCounts.readyForTesting > 0
                            ? `${sriStatus.documentStatusCounts.readyForTesting} listos`
                            : `${sriStatus.documentStatusCounts.draft} borradores`
                        : "Bloqueada"}
                    </p>
                  </div>
                </div>
              }
              href={appRouting.invoicing.href}
              priority
              buttonVariant={appRouting.invoicing.buttonVariant}
              actionLabel={appRouting.invoicing.actionLabel}
            />
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="Apps extendidas"
            title="Configuracion y crecimiento"
            description="Configuracion SRI, Gestion Empresarial, reportes y comunicacion quedan separados de la operacion diaria, pero siguen visibles cuando aplican."
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <AppCard
              icon={Settings2}
              title="Configuracion SRI"
              description={appRouting.sriConfiguration.description}
              features={appRouting.sriConfiguration.features}
              status={
                <StatusBadge
                  variant={sriConfigStatusVariant}
                  label={sriConfigStatusLabel}
                />
              }
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Firma</p>
                    <p className="font-semibold text-slate-900">
                      {appRouting.sriConfiguration.isEnabled ? sriSignatureLabel : "No habilitada"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Ambiente</p>
                    <p className="font-semibold text-slate-900">
                      {appRouting.sriConfiguration.isEnabled
                        ? sriStatus.environment === "TEST"
                          ? "Pruebas"
                          : sriStatus.environment === "PRODUCTION"
                            ? "Produccion"
                            : "Sin definir"
                        : "Bloqueado"}
                    </p>
                  </div>
                </div>
              }
              href={appRouting.sriConfiguration.href}
              actionLabel={appRouting.sriConfiguration.actionLabel}
              buttonVariant={appRouting.sriConfiguration.buttonVariant}
            />

            <AppCard
              icon={CreditCard}
              title="Gestion Empresarial"
              description={appRouting.advancedErp.description}
              features={appRouting.advancedErp.features}
              status={
                <StatusBadge
                  variant={appRouting.advancedErp.statusVariant}
                  label={appRouting.advancedErp.statusLabel}
                />
              }
              meta={
                <div className="text-xs text-slate-600">
                  <p className="font-medium text-slate-900">{appRouting.advancedErp.statusLabel}</p>
                  <p className="mt-1 leading-5">{appRouting.advancedErp.helperText}</p>
                </div>
              }
              href={appRouting.advancedErp.href}
              actionLabel={appRouting.advancedErp.actionLabel}
              buttonVariant={appRouting.advancedErp.buttonVariant}
            />

            <AppCard
              icon={BarChart3}
              title="Reportes"
              description={appRouting.reports.description}
              features={appRouting.reports.features}
              status={
                <StatusBadge
                  variant={appRouting.reports.statusVariant}
                  label={appRouting.reports.statusLabel}
                />
              }
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Ruta</p>
                    <p className="font-semibold text-slate-900">
                      {tenantMode.canAccessAdvancedReports ? "Avanzada" : "Core"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Estado</p>
                    <p className="font-semibold text-slate-900">{appRouting.reports.statusLabel}</p>
                  </div>
                </div>
              }
              href={appRouting.reports.href}
              actionLabel={appRouting.reports.actionLabel}
              buttonVariant={appRouting.reports.buttonVariant}
            />

            <AppCard
              icon={MessageSquareText}
              title="Comunicacion"
              description="Conversaciones, canales y automatizaciones para centralizar atencion al cliente y mensajeria."
              features={[
                "Conversaciones unificadas",
                "Canales conectados",
                "Automatizaciones",
                "Etiquetas y seguimiento",
                "Base para atencion omnicanal",
              ]}
              status={<StatusBadge variant="active" label="Activo" />}
              href={routes.conversations}
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
