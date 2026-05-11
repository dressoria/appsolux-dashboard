import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashAndBankAccounts } from "@/lib/api/erpnext/accounts";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpFinanceBanksPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver bancos.
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
              <Link href={routes.erpFinance} className="hover:underline">
                Caja y bancos
              </Link>{" "}
              / Bancos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Bancos</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver cuentas bancarias.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const accounts = await getCashAndBankAccounts().catch(() => []);
  const bankAccounts = accounts.filter((a) => a.account_type === "Bank");
  const cashAccounts = accounts.filter((a) => a.account_type === "Cash");

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
              <Link href={routes.erpFinance} className="hover:underline">
                Caja y bancos
              </Link>{" "}
              / Bancos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Bancos</h1>
            <p className="mt-2 text-muted-foreground">
              Cuentas bancarias y de caja configuradas en el ERP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={routes.erpFinanceBankReconciliation}>
                Conciliar movimientos
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.settings}>Configurar cuentas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cuentas bancarias</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {bankAccounts.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cuentas de caja</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {cashAccounts.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cuentas bancarias (Bank)</CardTitle>
          </CardHeader>
          <CardContent>
            {bankAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay cuentas bancarias configuradas. Crea una desde{" "}
                <Link
                  href={routes.settings}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Configuracion &rarr; Pagos
                </Link>
                .
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Cuenta</th>
                      <th className="py-2 pr-4 font-medium">Empresa</th>
                      <th className="py-2 font-medium">Moneda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bankAccounts.map((a) => (
                      <tr key={a.name}>
                        <td className="py-2 pr-4 font-medium">
                          {a.account_name ?? a.name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {a.company ?? "-"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {a.account_currency ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cuentas de caja (Cash)</CardTitle>
          </CardHeader>
          <CardContent>
            {cashAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay cuentas de caja configuradas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Cuenta</th>
                      <th className="py-2 pr-4 font-medium">Empresa</th>
                      <th className="py-2 font-medium">Moneda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cashAccounts.map((a) => (
                      <tr key={a.name}>
                        <td className="py-2 pr-4 font-medium">
                          {a.account_name ?? a.name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {a.company ?? "-"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {a.account_currency ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Conciliacion bancaria</CardTitle>
              <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                Conciliacion asistida
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Contrasta movimientos ERPNext de caja/banco con tu estado
              bancario. La revision es operativa inicial y no conecta bancos
              automaticamente.
            </p>
            <Button asChild size="sm">
              <Link href={routes.erpFinanceBankReconciliation}>
                Abrir conciliacion
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
