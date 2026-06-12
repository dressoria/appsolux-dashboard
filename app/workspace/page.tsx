import Link from "next/link";
import {
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
import { getTenantPlanState } from "@/lib/core/plans";
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

export default async function WorkspacePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [plan, sriStatus, basicReports] = await Promise.all([
    getTenantPlanState(tenant.id),
    getSriModuleStatus(tenant.id),
    getBasicReports(tenant.id),
  ]);

  const sriStatusVariant =
    sriStatus.readinessLabel === "not_started"
      ? ("pending" as const)
      : sriStatus.readinessLabel === "incomplete"
      ? ("incomplete" as const)
      : sriStatus.readinessLabel === "ready_for_testing"
      ? ("testing" as const)
      : ("active" as const);

  const sriStatusLabel =
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

  return (
    <DashboardShell contentClassName="mx-auto max-w-7xl">
      <div className="space-y-10">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.45fr_0.95fr] lg:px-8">
            <div className="space-y-6">
              <SectionHeader
                eyebrow="Fase 1"
                title="Mis Aplicaciones"
                description="Una vista mas clara para operar tu negocio: inventario, ventas, facturacion y configuracion SRI ahora se entienden como apps separadas."
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Productos"
                  value={String(basicReports.counts.products)}
                  helper="Catalogo disponible para venta y control de stock"
                />
                <MetricCard
                  label="Clientes"
                  value={String(basicReports.counts.customers)}
                  helper="Base activa para ventas, cobranza y fidelizacion"
                />
                <MetricCard
                  label="Ventas"
                  value={String(basicReports.counts.receipts)}
                  helper="Comprobantes internos registrados en la operacion diaria"
                />
                <MetricCard
                  label="Estado SRI"
                  value={sriStatusLabel}
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
                    Facturar deja de sentirse tecnico: vende desde POS o revisa comprobantes desde Facturacion.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <QuickActionCard
                  href={routes.basicStock}
                  title="Revisar inventario"
                  description="Consulta stock, productos criticos y movimientos."
                  icon={Boxes}
                />
                <QuickActionCard
                  href={routes.basicPos}
                  title="Abrir POS"
                  description="Registrar ventas y cobrar sin navegar por modulos tecnicos."
                  icon={ShoppingCart}
                />
                <QuickActionCard
                  href={routes.sriDocuments}
                  title="Ver facturacion"
                  description="Seguimiento de comprobantes, estados y revision operativa."
                  icon={ReceiptText}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">Plan activo: {plan.planName}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Productos: {basicReports.counts.products}/{plan.limits.products} · Clientes:{" "}
                  {basicReports.counts.customers}/{plan.limits.customers} · Ventas:{" "}
                  {basicReports.counts.receipts}/{plan.limits.receipts}
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
            description="Priorizamos las apps que el equipo usa todos los dias para vender, controlar stock y dar seguimiento a comprobantes."
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <AppCard
              icon={Boxes}
              title="Inventario"
              description="Productos, stock, entradas, salidas y alertas criticas para que la operacion no se detenga."
              features={[
                "Catalogo de productos",
                "Control de stock",
                "Entradas y salidas",
                "Alertas por stock critico",
                "Base para kardex y movimientos",
              ]}
              status={<StatusBadge variant="active" label="Activo" />}
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Productos</p>
                    <p className="font-semibold text-slate-900">{basicReports.counts.products}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Stock critico</p>
                    <p className="font-semibold text-slate-900">
                      {basicReports.outOfStockProducts.length + basicReports.lowStockProducts.length}
                    </p>
                  </div>
                </div>
              }
              href={routes.basicStock}
              priority
            />

            <AppCard
              icon={ShoppingCart}
              title="POS / Ventas"
              description="Vende, cobra y registra pedidos desde una experiencia mas operativa, con acceso a caja, clientes y recibos."
              features={[
                "Punto de venta",
                "Cobros y caja",
                "Clientes y fiados",
                "Pedidos y seguimiento",
                "Puente a factura electronica",
              ]}
              status={<StatusBadge variant="active" label="Activo" />}
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Ventas</p>
                    <p className="font-semibold text-slate-900">{basicReports.counts.receipts}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Clientes</p>
                    <p className="font-semibold text-slate-900">{basicReports.counts.customers}</p>
                  </div>
                </div>
              }
              href={routes.sales}
              priority
            />

            <AppCard
              icon={FileCheck}
              title="Facturacion"
              description="Seguimiento de comprobantes y estados operativos, con enfoque en emision electronica Ecuador / SRI sin exponer pasos tecnicos."
              features={[
                "Comprobantes y estados",
                "Autorizadas, pendientes y rechazadas",
                "Clientes y documentos",
                "Revision de borradores y firmados",
                "Atajo a configuracion SRI",
              ]}
              status={<StatusBadge variant={sriStatusVariant} label={sriStatusLabel} />}
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Configuracion</p>
                    <p className="font-semibold text-slate-900">
                      {sriConfigurationComplete ? "Completa" : "Pendiente"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Documentos</p>
                    <p className="font-semibold text-slate-900">
                      {sriStatus.documentStatusCounts.signed > 0
                        ? `${sriStatus.documentStatusCounts.signed} firmados`
                        : sriStatus.documentStatusCounts.readyForTesting > 0
                          ? `${sriStatus.documentStatusCounts.readyForTesting} listos`
                          : `${sriStatus.documentStatusCounts.draft} borradores`}
                    </p>
                  </div>
                </div>
              }
              href={routes.sriDocuments}
              priority
              buttonVariant={sriStatus.hasProfile ? "outline" : "default"}
              actionLabel={sriStatus.hasProfile ? "Abrir app" : "Completar configuracion"}
            />
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="Apps extendidas"
            title="Configuracion y crecimiento"
            description="Las apps tecnicas siguen disponibles, pero ahora quedan mejor separadas de la operacion diaria."
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <AppCard
              icon={Settings2}
              title="Configuracion SRI"
              description="Empresa, RUC, firma electronica, establecimientos, secuenciales y monitoreo tecnico para Ecuador."
              features={[
                "Empresa y perfil tributario",
                "Establecimientos y puntos de emision",
                "Firma electronica (.p12)",
                "Ambientes de pruebas y produccion",
                "Checklist y monitoreo tecnico",
              ]}
              status={<StatusBadge variant={sriStatusVariant} label={sriStatusLabel} />}
              meta={
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Firma</p>
                    <p className="font-semibold text-slate-900">{sriSignatureLabel}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Ambiente</p>
                    <p className="font-semibold text-slate-900">
                      {sriStatus.environment === "TEST"
                        ? "Pruebas"
                        : sriStatus.environment === "PRODUCTION"
                          ? "Produccion"
                          : "Sin definir"}
                    </p>
                  </div>
                </div>
              }
              href={routes.sri}
              actionLabel={sriStatus.hasProfile ? "Abrir app" : "Configurar"}
              buttonVariant={sriStatus.hasProfile ? "outline" : "default"}
            />

            <AppCard
              icon={CreditCard}
              title="ERP Avanzado"
              description="Compras, proveedores, contabilidad, finanzas e inventario empresarial para operaciones de mayor complejidad."
              features={[
                "Compras y proveedores",
                "Contabilidad y bancos",
                "Kardex y valorizacion",
                "Cuentas por pagar y cobrar",
                "Reportes financieros",
              ]}
              status={
                plan.canRequestDedicatedErp ? (
                  <StatusBadge variant="pending" label="Activo" />
                ) : (
                  <StatusBadge variant="locked" label="Plan Pro" />
                )
              }
              href={plan.canRequestDedicatedErp ? routes.erp : routes.billing}
              actionLabel={plan.canRequestDedicatedErp ? "Abrir app" : "Mejorar plan"}
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
