import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getSaleById } from "@/lib/core/lightweight-pos";
import { getPrismaClient } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ saleId: string }>;
};

const paymentLabels: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  credit: "Crédito / Fiado",
};

const statusLabels: Record<string, string> = {
  open: "Abierta",
  paid: "Pagada",
  canceled: "Anulada",
};

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function ReceiptDetailPage({ params }: Props) {
  const { tenant } = await requireDashboardSession();
  const { saleId } = await params;
  const sale = await getSaleById(tenant.id, saleId);

  if (!sale) {
    notFound();
  }

  const sriDoc = await getPrismaClient().sriDocument.findFirst({
    where: { tenantId: tenant.id, sourceType: "BASIC_SALE", sourceId: sale.id },
    select: { id: true },
  });

  if (sriDoc) {
    notFound();
  }

  const paid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = Math.max(Number(sale.total) - paid, 0);

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-4xl">
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={routes.facturacionReceipts}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                Recibo #{sale.id.slice(-8)}
              </h1>
              <p className="text-sm text-slate-500">
                {sale.createdAt.toLocaleDateString("es-EC", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`/api/basic/sales/${sale.id}/download-receipt`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-1 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {}}
              asChild
            >
              <a
                href={`/api/basic/sales/${sale.id}/download-receipt`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Printer className="mr-1 h-4 w-4" />
                Imprimir
              </a>
            </Button>
          </div>
        </header>

        {/* Company + Customer info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-slate-900">{sale.tenant.name}</p>
              {sale.tenant.taxIdentificationValue && (
                <p className="text-sm text-slate-600">
                  RUC: {sale.tenant.taxIdentificationValue}
                </p>
              )}
              {sale.tenant.address && (
                <p className="text-sm text-slate-500">{sale.tenant.address}</p>
              )}
              {sale.tenant.phone && (
                <p className="text-sm text-slate-500">Tel: {sale.tenant.phone}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-slate-900">
                {sale.customer?.name ?? "Consumidor final"}
              </p>
              {sale.customer?.identification && (
                <p className="text-sm text-slate-600">
                  {sale.customer.identification}
                </p>
              )}
              {sale.customer?.email && (
                <p className="text-sm text-slate-500">{sale.customer.email}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status and payment */}
        <Card>
          <CardContent className="flex flex-wrap gap-6 pt-4 pb-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Estado</p>
              <span
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  sale.status === "paid"
                    ? "bg-emerald-50 text-emerald-700"
                    : sale.status === "canceled"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {statusLabels[sale.status] ?? sale.status}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Forma de pago</p>
              <p className="mt-1 text-sm text-slate-900">
                {sale.payments
                  .map(
                    (p) =>
                      `${paymentLabels[p.method] ?? p.method} ${money(Number(p.amount))}`,
                  )
                  .join(" · ")}
              </p>
            </div>
            {pending > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500">Saldo pendiente</p>
                <p className="mt-1 text-sm font-medium text-amber-700">
                  {money(pending)}
                </p>
              </div>
            )}
            {sale.origin === "IMPORT" && sale.originalIssuedAt && (
              <div>
                <p className="text-xs font-medium text-slate-500">Fecha original</p>
                <p className="mt-1 text-sm text-slate-900">
                  {sale.originalIssuedAt.toLocaleDateString("es-EC", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Cant.</th>
                  <th className="px-4 py-3 text-right">P. Unit.</th>
                  <th className="px-4 py-3 text-right">Desc.</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {item.product?.name ?? "Producto eliminado"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {money(Number(item.price))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {Number(item.discountAmount) > 0
                        ? money(Number(item.discountAmount))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {Number(item.taxRate) > 0 ? `${Number(item.taxRate)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {money(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="tabular-nums">{money(Number(sale.subtotal))}</span>
              </div>
              {Number(sale.discountTotal) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Descuento</span>
                  <span className="tabular-nums">
                    -{money(Number(sale.discountTotal))}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>IVA</span>
                <span className="tabular-nums">{money(Number(sale.taxTotal))}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(Number(sale.total))}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400">
          Documento interno — no constituye comprobante electrónico autorizado por
          el SRI
        </p>
      </div>
    </DashboardShell>
  );
}
