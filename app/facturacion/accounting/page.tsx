import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getActivePlan } from "@/lib/core/accounting-plan";
import { getAccountingSettings } from "@/lib/core/accounting-settings";
import Link from "next/link";
import { routes } from "@/config/routes";

export default async function AccountingDashboardPage() {
  const { tenant } = await requireDashboardSession();
  const plan = await getActivePlan(tenant.id);
  const settings = await getAccountingSettings(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Resumen contable</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Plan de cuentas</h3>
              <p className="mt-1 text-lg font-semibold">
                {plan ? plan.name : "Sin configurar"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {plan ? `Estado: ${plan.status}` : "Crea o importa un plan de cuentas para comenzar"}
              </p>
              <Link
                href={routes.facturacionAccountingChartOfAccounts}
                className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                {plan ? "Ver plan" : "Configurar"}
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Parámetros contables</h3>
              <p className="mt-1 text-lg font-semibold">
                {settings?.configuredAt ? "Configurados" : "Pendiente"}
              </p>
              <Link
                href={routes.facturacionAccountingParameters}
                className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Configurar parámetros
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Asiento automático</h3>
              <p className="mt-1 text-lg font-semibold">
                {settings?.autoPostingEnabled ? "Activo" : "Inactivo"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {settings?.autoPostingEnabled
                  ? "Las operaciones generan asientos automáticamente"
                  : "Los asientos se crean manualmente"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Acciones rápidas</h3>
              <div className="space-y-2">
                <Link href={routes.facturacionAccountingJournal} className="block text-sm text-blue-600 hover:underline">
                  Crear asiento manual
                </Link>
                <Link href={routes.facturacionAccountingLedger} className="block text-sm text-blue-600 hover:underline">
                  Consultar libro mayor
                </Link>
                <Link href={routes.facturacionAccountingTrialBalance} className="block text-sm text-blue-600 hover:underline">
                  Balance de comprobación
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Reportes financieros</h3>
              <div className="space-y-2">
                <Link href={routes.facturacionAccountingIncomeStatement} className="block text-sm text-blue-600 hover:underline">
                  Estado de resultados
                </Link>
                <Link href={routes.facturacionAccountingBalanceSheet} className="block text-sm text-blue-600 hover:underline">
                  Balance general
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
