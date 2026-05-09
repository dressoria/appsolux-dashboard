import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

const WITHHIOLDING_TYPES = [
  {
    label: "Retencion en la fuente (Renta)",
    description:
      "Porcentajes aplicados a pagos a proveedores segun el tipo de bien o servicio.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Retencion IVA",
    description:
      "Retencion del 30%, 70% o 100% del IVA segun el tipo de contribuyente.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Retenciones emitidas",
    description:
      "Comprobantes de retencion emitidos a proveedores. Vinculados con facturas de compra.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Retenciones recibidas",
    description:
      "Comprobantes de retencion recibidos de clientes. Vinculados con facturas de venta.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Configuracion de porcentajes",
    description:
      "Tabla de porcentajes de retencion por tipo de actividad economica y bien/servicio.",
    status: "Proximamente",
    statusClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    label: "Envio masivo de retenciones",
    description:
      "Autorizacion y envio masivo de comprobantes de retencion al SRI.",
    status: "Proximamente",
    statusClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
];

export default async function ErpFiscalWithholdingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver retenciones.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpFiscal} className="hover:underline">
                Fiscalidad
              </Link>{" "}
              / Retenciones
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Retenciones
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para este modulo.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpFiscal} className="hover:underline">
                Fiscalidad
              </Link>{" "}
              / Retenciones
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Retenciones
              </h1>
              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                En preparacion
              </span>
              <span className="inline-flex h-4 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">
                Ecuador
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              Comprobantes de retencion en la fuente e IVA emitidos y recibidos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFiscalEcuador}>Ecuador / SRI</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFiscal}>Volver a fiscalidad</Link>
            </Button>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 text-sm text-amber-800">
            <span className="font-medium">Modulo en preparacion.</span> Las
            retenciones se calcularan automaticamente al registrar facturas de
            compra. No se generan ni envian comprobantes electronicos al SRI en
            esta fase.
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WITHHIOLDING_TYPES.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border bg-card p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">{item.label}</p>
                <span
                  className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${item.statusClass}`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Relacion con compras y ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Las retenciones emitidas se vincularán con facturas de compra de
              proveedores registradas en el modulo de compras.
            </p>
            <p>
              Las retenciones recibidas se vincularán con facturas de venta
              emitidas a clientes obligados a retener.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpPurchasesDocuments}>
                  Ver compras
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.posInvoices}>Ver facturas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
