import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getSriModuleStatus } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function StatusBadge({
  variant,
  label,
}: {
  variant: "active" | "pending" | "incomplete" | "locked" | "testing";
  label: string;
}) {
  const classes = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-slate-200 bg-slate-50 text-slate-500",
    incomplete: "border-amber-200 bg-amber-50 text-amber-700",
    locked: "border-slate-100 bg-slate-50 text-slate-400",
    testing: "border-blue-200 bg-blue-50 text-blue-700",
  }[variant];

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

type AppCardProps = {
  title: string;
  description: string;
  features: string[];
  status: React.ReactNode;
  cta: React.ReactNode;
  locked?: boolean;
  meta?: React.ReactNode;
};

function AppCard({ title, description, features, status, cta, locked, meta }: AppCardProps) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md ${
        locked ? "opacity-60" : ""
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {status}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <ul className="mb-4 space-y-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xs text-primary">✓</span>
            {f}
          </li>
        ))}
      </ul>
      {meta && <div className="mb-4">{meta}</div>}
      <div className="mt-auto">{cta}</div>
    </div>
  );
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
      : "Listo para produccion";

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis Aplicaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona un modulo para operar. Cada app es independiente y se activa segun tu plan.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AppCard
            title="Inventario & POS"
            description="Punto de venta diario: vende, cobra, registra clientes y controla tu inventario."
            features={[
              "Punto de venta (POS)",
              "Productos y categorias",
              "Control de stock",
              "Clientes y fiados",
              "Caja y cierre diario",
            ]}
            status={<StatusBadge variant="active" label="Activo" />}
            meta={
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Productos</p>
                  <p className="font-semibold">{basicReports.counts.products}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Clientes</p>
                  <p className="font-semibold">{basicReports.counts.customers}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ventas</p>
                  <p className="font-semibold">{basicReports.counts.receipts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stock critico</p>
                  <p className="font-semibold">
                    {basicReports.outOfStockProducts.length + basicReports.lowStockProducts.length}
                  </p>
                </div>
              </div>
            }
            cta={
              <Button asChild className="w-full">
                <Link href={routes.basic}>Abrir app</Link>
              </Button>
            }
          />

          <AppCard
            title="Ventas"
            description="Vista agrupada de ventas, pedidos, clientes y cuentas por cobrar."
            features={[
              "Resumen de ventas",
              "Pedidos y cotizaciones",
              "Clientes activos",
              "Cuentas por cobrar",
              "Historial de pagos",
            ]}
            status={<StatusBadge variant="active" label="Disponible" />}
            cta={
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.sales}>Abrir app</Link>
              </Button>
            }
          />

          <AppCard
            title="Facturacion Electronica"
            description="Configura empresa, establecimientos, secuenciales y firma electronica para SRI Ecuador."
            features={[
              "Perfil de empresa y RUC",
              "Establecimientos y puntos de emision",
              "Secuenciales por tipo de comprobante",
              "Firma electronica (.p12)",
              "Ambiente pruebas / produccion",
            ]}
            status={<StatusBadge variant={sriStatusVariant} label={sriStatusLabel} />}
            meta={
              sriStatus.hasProfile ? (
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">RUC</p>
                    <p className="font-mono font-semibold">{sriStatus.ruc ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ambiente</p>
                    <p className="font-semibold">
                      {sriStatus.environment === "TEST" ? "Pruebas" : "Produccion"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Establecimientos</p>
                    <p className="font-semibold">{sriStatus.establishmentCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Secuenciales</p>
                    <p className="font-semibold">{sriStatus.sequenceCount}</p>
                  </div>
                </div>
              ) : null
            }
            cta={
              <Button
                asChild
                variant={sriStatus.hasProfile ? "outline" : "default"}
                className="w-full"
              >
                <Link href={routes.sri}>
                  {sriStatus.hasProfile ? "Abrir app" : "Configurar"}
                </Link>
              </Button>
            }
          />

          <AppCard
            title="ERP Avanzado"
            description="Compras, proveedores, contabilidad, inventario avanzado y finanzas empresariales."
            features={[
              "Gestion de compras y proveedores",
              "Contabilidad y libro diario",
              "Inventario avanzado con kardex",
              "Cuentas por pagar y cobrar",
              "Reportes financieros",
            ]}
            status={
              plan.canRequestDedicatedErp ? (
                <StatusBadge variant="pending" label="Disponible" />
              ) : (
                <StatusBadge variant="locked" label="Plan Pro" />
              )
            }
            locked={!plan.canRequestDedicatedErp}
            cta={
              plan.canRequestDedicatedErp ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={routes.erp}>Abrir app</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link href={routes.billing}>Mejorar plan</Link>
                </Button>
              )
            }
          />
        </div>

        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Plan activo: {plan.planName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Productos: {basicReports.counts.products}/{plan.limits.products} ·{" "}
                Clientes: {basicReports.counts.customers}/{plan.limits.customers} ·{" "}
                Ventas: {basicReports.counts.receipts}/{plan.limits.receipts}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.billing}>Ver plan</Link>
            </Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
