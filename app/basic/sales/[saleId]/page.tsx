import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileCheck2, FileText } from "lucide-react";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { SaleDetailActions } from "@/components/appsolux/basic/sale-detail-actions";
import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import { CreateSriDraftFromSaleButton } from "@/components/appsolux/sri/create-sri-draft-from-sale-button";
import { SriDownloadButton } from "@/components/appsolux/sri/sri-download-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSaleById } from "@/lib/core/lightweight-pos";
import { getSriDraftForSale, getSriModuleStatus } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export const dynamic = "force-dynamic";

type BasicSaleDetailPageProps = {
  params: Promise<{
    saleId: string;
  }>;
};

export default async function BasicSaleDetailPage({
  params,
}: BasicSaleDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Recibo simple"
        description="Inicia sesion para consultar la venta."
        activeHref={routes.basicSales}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { saleId } = await params;

  const [sale, sriStatus] = await Promise.all([
    getSaleById(tenant.id, saleId).catch(() => null),
    getSriModuleStatus(tenant.id).catch(() => null),
  ]);

  if (!sale) {
    notFound();
  }

  const existingDraft = sale.status !== "canceled"
    ? await getSriDraftForSale(tenant.id, sale.id).catch(() => null)
    : null;

  const paid = sale.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );
  const pending = Math.max(Number(sale.total) - paid, 0);

  const sriReady =
    (sriStatus?.hasProfile ?? false) &&
    (sriStatus?.establishmentCount ?? 0) > 0 &&
    (sriStatus?.issuePointCount ?? 0) > 0 &&
    (sriStatus?.sequenceCount ?? 0) > 0;

  const sriConfigLink =
    (sriStatus?.establishmentCount ?? 0) === 0
      ? routes.sriEstablishments
      : (sriStatus?.issuePointCount ?? 0) === 0
        ? routes.sriIssuePoints
        : routes.sriSequences;

  return (
    <BasicModuleShell
      title="Venta"
      description="Recibo, pagos, saldo y comprobante electrónico asociado."
      activeHref={routes.basicSales}
    >
      <SaleDetailActions
        saleId={sale.id}
        canCancel={sale.status !== "canceled"}
        canPay={sale.status !== "canceled" && pending > 0}
        pendingAmount={pending}
        sriDocumentStatus={existingDraft?.status ?? null}
        hasSriDocument={Boolean(existingDraft)}
      />

      <SimpleReceipt
        tenantName={tenant.name}
        sale={{
          id: sale.id,
          createdAt: sale.createdAt,
          total: sale.total.toString(),
          subtotal: sale.subtotal.toString(),
          taxTotal: sale.taxTotal.toString(),
          discountTotal: sale.discountTotal.toString(),
          status: sale.status,
          paymentStatus: sale.paymentStatus,
          customer: sale.customer ? { name: sale.customer.name } : null,
          items: sale.items.map((item) => ({
            quantity: item.quantity,
            price: item.price.toString(),
            total: item.total.toString(),
            product: { name: item.product?.name ?? "Producto eliminado" },
          })),
          payments: sale.payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount.toString(),
          })),
        }}
      />

      {/* SRI draft section */}
      {sale.status !== "canceled" && (
        <Card>
          <CardHeader>
            <CardTitle>Facturacion Electronica SRI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!(sriStatus?.hasProfile) ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Configura Facturacion SRI antes de preparar comprobantes.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.sri}>Configurar SRI</Link>
                </Button>
              </div>
            ) : !sriReady ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Completa la configuracion SRI: necesitas al menos un establecimiento,
                  un punto de emision y una secuencia de factura.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={sriConfigLink}>Completar configuracion</Link>
                </Button>
              </div>
            ) : existingDraft ? (
              <div className="space-y-3">
                {existingDraft.status === "AUTHORIZED" ? (
                  <>
                    <p className="font-medium text-emerald-700">Factura autorizada por el SRI</p>
                    {existingDraft.submissionJobs[0]?.sriAuthorizationNumber && (
                      <p className="font-mono text-xs text-slate-600 break-all">
                        N° {existingDraft.submissionJobs[0].sriAuthorizationNumber}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/sri/documents/${existingDraft.id}`}>Ver factura</Link>
                      </Button>
                      <SriDownloadButton
                        href={`/api/sri/documents/${existingDraft.id}/download-signed-xml`}
                        label="XML firmado"
                        icon={Download}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <SriDownloadButton
                        href={`/api/sri/documents/${existingDraft.id}/download-authorized-xml`}
                        label="XML autorizado"
                        icon={FileCheck2}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <SriDownloadButton
                        href={`/api/sri/documents/${existingDraft.id}/download-ride`}
                        label="RIDE / PDF"
                        icon={FileText}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-slate-700">
                      {existingDraft.status === "SIGNED" || existingDraft.status === "SENT"
                        ? "Factura SRI en proceso"
                        : existingDraft.status === "REJECTED"
                          ? "Factura SRI rechazada"
                          : "Factura SRI en preparación"}
                    </p>
                    <p className="text-muted-foreground">
                      El sistema procesara este comprobante automaticamente.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/sri/documents/${existingDraft.id}`}>Ver factura SRI</Link>
                      </Button>
                      {(existingDraft.status === "SIGNED" || existingDraft.status === "SENT") && (
                        <SriDownloadButton
                          href={`/api/sri/documents/${existingDraft.id}/download-signed-xml`}
                          label="XML firmado"
                          icon={Download}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Genera una factura electronica SRI desde esta venta.
                </p>
                <CreateSriDraftFromSaleButton saleId={sale.id} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </BasicModuleShell>
  );
}
