import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPurchaseDocumentById } from "@/lib/core/purchase-documents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador", REGISTERED: "Registrada", AUTHORIZED: "Autorizada",
  CANCELLED: "Anulada", REJECTED: "Rechazada", NEEDS_REVIEW: "Revisar",
};
const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Factura", CREDIT_NOTE: "Nota de crédito", DEBIT_NOTE: "Nota de débito",
  PURCHASE_SETTLEMENT: "Liquidación", OTHER: "Otro",
};
const DEDUCTIBILITY_LABELS: Record<string, string> = {
  UNREVIEWED: "Sin revisar", LIKELY_DEDUCTIBLE: "Posiblemente deducible",
  LIKELY_NON_DEDUCTIBLE: "Posiblemente no deducible", REVIEW_REQUIRED: "Requiere revisión",
  CONFIRMED_DEDUCTIBLE: "Deducible confirmado", CONFIRMED_NON_DEDUCTIBLE: "No deducible confirmado",
};

export default async function PurchaseDocumentDetailPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { tenant } = await requireDashboardSession();
  const { purchaseId } = await params;

  const doc = await getPurchaseDocumentById(tenant.id, purchaseId);
  if (!doc) return notFound();

  const subtotal = Number(doc.subtotal0) + Number(doc.subtotal15);

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-5xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Documento de compra</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {doc.supplierDocumentNumber || "Sin número"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/facturacion/purchases/withholdings/new">
              <Button variant="outline" size="sm">Crear retención</Button>
            </Link>
            <Link href="/facturacion/purchases/documents">
              <Button variant="outline" size="sm">Volver</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-medium">Proveedor</h3>
              <p className="text-sm">{doc.supplier?.name ?? doc.supplierName ?? "—"}</p>
              <p className="text-sm text-muted-foreground font-mono">{doc.supplier?.identification ?? doc.supplierIdentification ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-medium">Documento</h3>
              <p className="text-sm">{TYPE_LABELS[doc.documentType] ?? doc.documentType}</p>
              {doc.accessKey && <p className="text-xs text-muted-foreground font-mono break-all">Clave: {doc.accessKey}</p>}
              {doc.authorizationNumber && <p className="text-xs text-muted-foreground">Autorización: {doc.authorizationNumber}</p>}
              <p className="text-sm">Fecha: {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString("es-EC") : "—"}</p>
              <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs">{STATUS_LABELS[doc.status] ?? doc.status}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium text-right">Cant.</th>
                  <th className="px-4 py-3 font-medium text-right">P.Unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Desc.</th>
                  <th className="px-4 py-3 font-medium text-right">IVA %</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3 text-xs">{item.product?.name ?? "—"}</td>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">{Number(item.quantity)}</td>
                    <td className="px-4 py-3 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${Number(item.discountAmount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{Number(item.taxRate)}%</td>
                    <td className="px-4 py-3 text-right font-medium">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-medium">Totales</h3>
              <div className="flex justify-between text-sm"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Descuento:</span><span>${Number(doc.discountTotal).toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>IVA:</span><span>${Number(doc.ivaTotal).toFixed(2)}</span></div>
              <div className="flex justify-between font-medium"><span>Total:</span><span>${Number(doc.total).toFixed(2)}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-medium">Contable</h3>
              <p className="text-sm">Categoría: {doc.accountingCategory?.name ?? "Sin asignar"}</p>
              <p className="text-sm">Deducibilidad: {DEDUCTIBILITY_LABELS[doc.deductibilityStatus] ?? doc.deductibilityStatus}</p>
              {doc.deductibilityReason && <p className="text-xs text-muted-foreground">{doc.deductibilityReason}</p>}
              <p className="mt-2 text-xs text-amber-600">Clasificación sugerida. Verifica el tratamiento tributario antes de declarar.</p>
            </CardContent>
          </Card>
        </div>

        {doc.payments.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-medium">Pagos</h3>
              {doc.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span>{p.method}</span>
                  <span>${Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
