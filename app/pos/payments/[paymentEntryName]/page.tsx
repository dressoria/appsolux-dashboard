import Link from "next/link";
import { PaymentEntryActions } from "@/components/appsolux/pos/payment-entry-actions";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextPaymentEntryDetail } from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type PaymentEntryPageProps = {
  params: Promise<{
    paymentEntryName: string;
  }>;
};

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getPaymentStatus(docstatus?: 0 | 1 | 2) {
  if (docstatus === 2) {
    return "Anulado";
  }

  if (docstatus === 1) {
    return "Confirmado";
  }

  return "Borrador";
}

export default async function PosPaymentDetailPage({
  params,
}: PaymentEntryPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el pago.
          </p>
        </div>
      </DashboardShell>
    );
  }

  await getCurrentTenant(user);

  const { paymentEntryName } = await params;
  const decodedName = decodeURIComponent(paymentEntryName);
  const paymentEntry = await getErpnextPaymentEntryDetail(decodedName);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Pago / cobro</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {paymentEntry.name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Detalle del pago registrado y facturas asociadas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/pos/payments">Caja y cobros</Link>
            </Button>
            <Button asChild>
              <Link href="/pos">Ir al POS</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {paymentEntry.party_name ?? paymentEntry.party ?? "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fecha</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {paymentEntry.posting_date ?? "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Metodo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {paymentEntry.mode_of_payment ?? "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Monto</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-semibold">
              {formatMoney(paymentEntry.paid_amount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {getPaymentStatus(paymentEntry.docstatus)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Referencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Numero: {paymentEntry.reference_no ?? "-"}</p>
            <p>Fecha: {paymentEntry.reference_date ?? "-"}</p>
            <p>Nota: {paymentEntry.remarks ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturas asociadas</CardTitle>
          </CardHeader>
          <CardContent>
            {(paymentEntry.references ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Este pago no tiene facturas asociadas.
              </div>
            ) : (
              <div className="space-y-2">
                {(paymentEntry.references ?? []).map((reference) => (
                  <div
                    key={`${reference.reference_doctype}-${reference.reference_name}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{reference.reference_name}</p>
                      <p className="text-muted-foreground">
                        Monto aplicado: {formatMoney(reference.allocated_amount)}
                      </p>
                    </div>
                    {reference.reference_doctype === "Sales Invoice" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/pos/invoices/${encodeURIComponent(
                            reference.reference_name
                          )}`}
                        >
                          Ver factura
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <PaymentEntryActions
          paymentEntryName={paymentEntry.name}
          docstatus={paymentEntry.docstatus}
        />
      </div>
    </DashboardShell>
  );
}
