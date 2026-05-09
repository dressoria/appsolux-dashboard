import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCustomerDetail } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type Props = {
  params: Promise<{ customerId: string }>;
};

function money(value: { toString(): string } | number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function paymentStatusLabel(status: string) {
  if (status === "paid") return "Pagado";
  if (status === "partial") return "Parcial";
  return "Pendiente";
}

function paymentStatusColor(status: string) {
  if (status === "paid") return "text-green-600";
  if (status === "partial") return "text-yellow-600";
  return "text-red-600";
}

export default async function BasicCustomerDetailPage({ params }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Detalle del cliente"
        description="Informacion comercial del cliente."
        activeHref={routes.basicCustomers}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { customerId } = await params;
  const detail = await getCustomerDetail(tenant.id, customerId);

  if (!detail) {
    return (
      <BasicModuleShell
        title="Detalle del cliente"
        description="Informacion comercial del cliente."
        activeHref={routes.basicCustomers}
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Cliente no encontrado.
          </CardContent>
        </Card>
      </BasicModuleShell>
    );
  }

  const { customer, summary, recentSales } = detail;
  const balance = Number(customer.balance);

  return (
    <BasicModuleShell
      title="Detalle del cliente"
      description="Historial comercial, ventas recientes y acciones."
      activeHref={routes.basicCustomers}
    >
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={routes.basicCustomers}>← Volver a clientes</Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Informacion del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-lg font-semibold">{customer.name}</p>
                {customer.phone && (
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                )}
                {customer.email && (
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                )}
                {customer.address && (
                  <p className="text-sm text-muted-foreground">{customer.address}</p>
                )}
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  balance > 0
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-emerald-300 bg-emerald-50 text-emerald-700"
                }`}
              >
                Saldo {money(balance)}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Ventas realizadas</p>
              <p className="mt-1 text-2xl font-bold">{summary.totalSales}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total comprado</p>
              <p className="mt-1 text-2xl font-bold">{money(summary.totalPurchased)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Saldo pendiente</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  balance > 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {money(balance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Ultima compra</p>
              <p className="mt-1 text-lg font-semibold">{formatDate(summary.lastSaleAt)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/basic/pos?customerId=${customer.id}`}>Crear venta</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/basic/sales?customerId=${customer.id}`}>Ver ventas</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ventas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este cliente aun no tiene ventas registradas.
              </p>
            ) : (
              <div className="space-y-3">
                {recentSales.map((sale) => {
                  const paid = sale.payments.reduce(
                    (sum, p) => sum + Number(p.amount),
                    0
                  );
                  const pending = Math.max(Number(sale.total) - paid, 0);

                  return (
                    <div
                      key={sale.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{money(sale.total)}</span>
                          <span
                            className={`text-xs font-medium ${paymentStatusColor(sale.paymentStatus)}`}
                          >
                            {paymentStatusLabel(sale.paymentStatus)}
                          </span>
                          {sale.status === "canceled" && (
                            <span className="text-xs text-muted-foreground">
                              (Cancelada)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(sale.createdAt)} · Pagado {money(paid)}
                          {pending > 0 ? ` · Pendiente ${money(pending)}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sale.items
                            .map((i) => `${i.product.name} x${i.quantity}`)
                            .join(", ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {pending > 0 && sale.status !== "canceled" && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/basic/sales/${sale.id}`}>
                              Registrar abono
                            </Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/basic/sales/${sale.id}`}>Ver</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BasicModuleShell>
  );
}
