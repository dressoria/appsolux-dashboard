import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
import { PaymentEntryActions } from "@/components/appsolux/pos/payment-entry-actions";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextPaymentEntryDetail } from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getStatusLabel(docstatus?: 0 | 1 | 2) {
  if (docstatus === 2) return "Anulado";
  if (docstatus === 1) return "Confirmado";
  return "Borrador";
}

function getStatusClassName(docstatus?: 0 | 1 | 2) {
  if (docstatus === 2) return "border-red-200 bg-red-50 text-red-700";
  if (docstatus === 1) return "border-green-200 bg-green-50 text-green-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default async function PosPaymentDetailPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
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

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            El ERP dedicado real debe estar activo para usar el POS avanzado.
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  let paymentEntry;
  try {
    paymentEntry = await getErpnextPaymentEntryDetail(paymentId);
  } catch {
    notFound();
  }

  const references = paymentEntry.references ?? [];
  const statusLabel = getStatusLabel(paymentEntry.docstatus);
  const statusClassName = getStatusClassName(paymentEntry.docstatus);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Ventas / Pagos</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {paymentEntry.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {paymentEntry.party_name ?? paymentEntry.party ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.posPayments}>Ver pagos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.pos}>Ir al POS</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle>Detalles del pago</CardTitle>
              <span
                className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${statusClassName}`}
              >
                {statusLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium">
                  {paymentEntry.party_name ?? paymentEntry.party ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd>{paymentEntry.posting_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Metodo de pago</dt>
                <dd>{paymentEntry.mode_of_payment ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Monto cobrado</dt>
                <dd className="font-semibold">
                  {formatMoney(paymentEntry.paid_amount)}
                </dd>
              </div>
              {paymentEntry.reference_no ? (
                <div>
                  <dt className="text-muted-foreground">Referencia</dt>
                  <dd>{paymentEntry.reference_no}</dd>
                </div>
              ) : null}
              {paymentEntry.remarks ? (
                <div>
                  <dt className="text-muted-foreground">Nota</dt>
                  <dd>{paymentEntry.remarks}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <DocumentActions doctype="Payment Entry" name={paymentEntry.name} />
            <p>Este comprobante corresponde al registro de pago.</p>
          </CardContent>
        </Card>

        {references.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Facturas asociadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Factura</th>
                      <th className="py-2 font-medium">Monto asignado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {references.map((ref, index) => (
                      <tr key={index}>
                        <td className="py-2 pr-4">
                          {ref.reference_doctype === "Sales Invoice" ? (
                            <Link
                              href={`${routes.posInvoices}/${encodeURIComponent(ref.reference_name)}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {ref.reference_name}
                            </Link>
                          ) : (
                            ref.reference_name
                          )}
                        </td>
                        <td className="py-2">
                          {formatMoney(ref.allocated_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <PaymentEntryActions
          paymentEntryName={paymentEntry.name}
          docstatus={paymentEntry.docstatus}
        />
      </div>
    </DashboardShell>
  );
}
