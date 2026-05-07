import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDailyCashSummary } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function money(value: { toString(): string } | undefined) {
  return `$${Number(value?.toString() ?? 0).toFixed(2)}`;
}

export default async function BasicCashPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Caja diaria"
        description="Inicia sesion para revisar cobros y fiados del dia."
        activeHref={routes.basicCash}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const cash = await getDailyCashSummary(tenant.id);

  return (
    <BasicModuleShell
      title="Caja diaria"
      description="Resumen simple de cobros, ventas y fiados generados hoy."
      activeHref={routes.basicCash}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Ventas hoy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(cash.totalSales)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cobrado</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(cash.totalCollected)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fiado generado</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(cash.creditGenerated)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Neto estimado</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(cash.estimatedNet)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cobros por metodo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Efectivo: {money(cash.byMethod.cash)}</p>
            <p>Transferencia: {money(cash.byMethod.transfer)}</p>
            <p>Tarjeta: {money(cash.byMethod.card)}</p>
            <p>Credito/fiado cobrado: {money(cash.byMethod.credit)}</p>
            <p>Ventas canceladas hoy: {cash.canceledSales}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movimientos de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cash.paymentsToday.map((payment) => (
              <div key={payment.id} className="flex justify-between rounded-md border p-2 text-sm">
                <span>{payment.method}</span>
                <span className="text-muted-foreground">
                  {money(payment.amount)} · {payment.createdAt.toLocaleTimeString("es-EC")}
                </span>
              </div>
            ))}
            {cash.paymentsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aun no tienes cobros hoy. Crea tu primera venta desde el POS.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </BasicModuleShell>
  );
}
