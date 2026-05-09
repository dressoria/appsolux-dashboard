import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

const ATS_MODULES = [
  {
    label: "Generacion ATS",
    description:
      "Generacion del archivo XML del Anexo Transaccional Simplificado por periodo mensual.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Validacion de datos",
    description:
      "Verificacion de que todas las facturas, retenciones y datos del periodo esten completos antes de generar.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Periodos mensuales",
    description:
      "Seleccion de mes y ano del periodo a declarar. Vista de periodos anteriores y su estado.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Exportacion del XML",
    description:
      "Descarga del archivo ATS.XML para subir al portal del SRI o DIMM Formularios.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Compras y ventas incluidas",
    description:
      "Inclusion automatica de facturas de compra y venta del periodo seleccionado.",
    status: "En preparacion",
    statusClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Retenciones incluidas",
    description:
      "Inclusion de comprobantes de retencion emitidos y recibidos en el periodo.",
    status: "Proximamente",
    statusClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
];

export default async function ErpFiscalAtsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el ATS.
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
              / ATS
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">ATS</h1>
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
              / ATS
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                ATS — Anexo Transaccional Simplificado
              </h1>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                En preparacion
              </span>
              <span className="inline-flex h-4 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">
                Ecuador
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              Generacion mensual del Anexo Transaccional Simplificado para
              declaracion al Servicio de Rentas Internas.
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
            <span className="font-medium">Modulo en preparacion.</span> El ATS
            se generara mensualmente consolidando facturas de compra, venta y
            retenciones del periodo. No se genera ni envian datos reales al SRI
            en esta fase.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seleccion de periodo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              La seleccion de periodo mensual estara disponible cuando el modulo
              ATS este activo. Se podra generar el XML para cualquier mes
              anterior desde que el modulo fue activado.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {["Enero 2025", "Febrero 2025", "Marzo 2025"].map((period) => (
                <div
                  key={period}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span className="text-sm font-medium">{period}</span>
                  <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs text-slate-500">
                    Pendiente
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ATS_MODULES.map((item) => (
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
            <CardTitle>Fuentes de datos del ATS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              El ATS consolidara datos de multiples modulos del ERP para el
              periodo seleccionado.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="outline" size="sm">
                <Link href={routes.posInvoices}>Facturas de venta</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpPurchasesDocuments}>
                  Facturas de compra
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpFiscalWithholdings}>Retenciones</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.reports}>Reportes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
