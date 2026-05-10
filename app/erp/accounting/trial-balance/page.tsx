import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

const TRIAL_BALANCE_COLUMNS = [
  "Cuenta",
  "Debito acumulado",
  "Credito acumulado",
  "Saldo deudor",
  "Saldo acreedor",
];

export default async function ErpAccountingTrialBalancePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver el balance de comprobacion.</p>
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
              / Balance de comprobacion
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Balance de comprobacion</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el balance de comprobacion.</p>
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
              / Balance de comprobacion
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">Balance de comprobacion</h1>
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
            <span className="font-medium">Balance de comprobacion en preparacion.</span>{" "}
            Consolidara debitos acumulados, creditos acumulados y saldos por cada cuenta
            del plan de cuentas para un periodo seleccionado.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estructura del balance de comprobacion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El balance de comprobacion verifica que los debitos y creditos
              registrados en el libro mayor esten en equilibrio. Muestra una fila
              por cuenta con los totales acumulados del periodo.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    {TRIAL_BALANCE_COLUMNS.map((col) => (
                      <th key={col} className="px-4 py-2 text-left">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Disponible cuando el modulo este activo.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingGeneralLedger}>Libro mayor</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingAccounts}>Plan de cuentas</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingBalanceSheet}>Balance general</Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
