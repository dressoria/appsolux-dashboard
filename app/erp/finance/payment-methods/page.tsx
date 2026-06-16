import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function getTypeLabel(type?: string) {
  if (!type) return "-";
  const t = type.toLowerCase();
  if (t === "cash") return "Efectivo";
  if (t === "bank") return "Banco / transferencia";
  if (t === "general") return "General";
  return type;
}

export default async function ErpFinancePaymentMethodsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver metodos de pago.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
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
              / Metodos de pago
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Metodos de pago
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver metodos de pago.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const modesOfPayment = await getErpnextModesOfPayment();
  const active = modesOfPayment.filter(
    (m) => m.enabled === 1 || m.enabled === true
  );
  const inactive = modesOfPayment.filter(
    (m) => m.enabled !== 1 && m.enabled !== true
  );

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
              / Metodos de pago
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Metodos de pago
            </h1>
            <p className="mt-2 text-muted-foreground">
              Efectivo, transferencia, tarjeta y cuentas caja/banco
              asociadas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.settings}>
                Configurar en ajustes de empresa
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Metodos activos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {active.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Metodos inactivos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-muted-foreground">
              {inactive.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Metodos configurados</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={routes.settings}>
                  Agregar o editar en ajustes
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {modesOfPayment.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <p>No hay metodos de pago configurados en el ERP.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={routes.settings}>
                    Ir a configuracion de empresa
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Metodo</th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {modesOfPayment.map((m) => {
                      const isActive = m.enabled === 1 || m.enabled === true;
                      return (
                        <tr key={m.name}>
                          <td className="py-2 pr-4 font-medium">{m.name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {getTypeLabel(m.type)}
                          </td>
                          <td className="py-2">
                            {isActive ? (
                              <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
                                Inactivo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          Para asociar una cuenta caja o banco a un metodo de pago, ve a{" "}
          <Link
            href={routes.settings}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Configuracion de empresa &rarr; Pagos
          </Link>
          .
        </div>
      </div>
    </DashboardShell>
  );
}
