import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

const BALANCE_SECTIONS = [
  {
    title: "Activos",
    items: [
      "Activos corrientes (caja, bancos, CxC, inventario)",
      "Activos no corrientes (equipos, maquinaria, activos fijos)",
      "Depreciacion acumulada",
    ],
  },
  {
    title: "Pasivos",
    items: [
      "Pasivos corrientes (CxP, impuestos por pagar)",
      "Pasivos no corrientes (deudas a largo plazo)",
    ],
  },
  {
    title: "Patrimonio",
    items: [
      "Capital social",
      "Utilidades retenidas",
      "Resultado del ejercicio",
    ],
  },
];

export default async function ErpAccountingBalanceSheetPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver el balance general.</p>
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
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Balance general
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Balance general</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el balance general.</p>
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
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Balance general
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">Balance general</h1>
              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                En preparacion
              </span>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={routes.erpAccounting}>Volver a contabilidad</Link>
          </Button>
        </div>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 text-sm text-amber-800">
            <span className="font-medium">Balance contable oficial en preparacion.</span>{" "}
            El balance general consolida activos, pasivos y patrimonio por cuenta contable.
            Esta vista requiere que el plan de cuentas este configurado y los asientos contables
            esten completos en el ERP.
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {BALANCE_SECTIONS.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">{item}</span>
                    <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                      En preparacion
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuentes del balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              El balance general oficial se construira desde el libro mayor, consolidando
              saldos por tipo de cuenta (Activo, Pasivo, Patrimonio) al cierre de cada periodo.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpAccountingAccounts}>Plan de cuentas</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpAccountingGeneralLedger}>Libro mayor</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpAccountingTrialBalance}>Balance de comprobacion</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
