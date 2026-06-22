"use client";

import { Button } from "@/components/ui/button";

type ReceiptItem = {
  quantity: number;
  price: string;
  discountAmount?: string;
  taxRate?: string;
  taxAmount?: string;
  total: string;
  product: { name: string };
};

type ReceiptSale = {
  id: string;
  createdAt: string | Date;
  total: string;
  subtotal?: string;
  taxTotal?: string;
  discountTotal?: string;
  status: string;
  paymentStatus: string;
  customer?: { name: string } | null;
  items: ReceiptItem[];
  payments: Array<{
    method: string;
    amount: string;
  }>;
};

function formatMoney(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Crédito / Fiado",
  };
  return labels[method] ?? method;
}

function saleStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: "Completada",
    pending: "Pendiente",
    canceled: "Cancelada",
    draft: "Borrador",
  };
  return labels[status] ?? status;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: "Pagado",
    partial: "Pago parcial",
    pending: "Pendiente",
    unpaid: "Sin pagar",
  };
  return labels[status] ?? status;
}

export function SimpleReceipt({
  tenantName,
  sale,
}: {
  tenantName: string;
  sale: ReceiptSale;
}) {
  const date = new Date(sale.createdAt);
  const shortId = sale.id.slice(-8);
  const paid = sale.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );
  const pending = Math.max(Number(sale.total) - paid, 0);

  const subtotal = Number(sale.subtotal ?? sale.total);
  const taxTotal = Number(sale.taxTotal ?? 0);
  const discountTotal = Number(sale.discountTotal ?? 0);
  const hasIva = taxTotal > 0;
  const hasDiscount = discountTotal > 0;
  const showBreakdown = hasIva || hasDiscount;

  return (
    <>
      {/* Oculta todo excepto el recibo al imprimir */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #appsolux-receipt, #appsolux-receipt * { visibility: visible; }
          #appsolux-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 2rem; background: white; }
        }
      `}</style>

      <div
        id="appsolux-receipt"
        className="mx-auto max-w-2xl space-y-4 rounded-md border bg-background p-5 text-sm print:max-w-none print:border-0 print:p-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xl font-semibold">{tenantName}</p>
            <p className="text-sm font-medium">Recibo simple</p>
            <p className="text-xs text-muted-foreground">
              Recibo #{shortId} · {date.toLocaleString("es-EC")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="print:hidden"
          >
            Imprimir recibo
          </Button>
        </div>

        <div className="grid gap-1 text-muted-foreground">
          <p>Cliente: {sale.customer?.name ?? "Consumidor final"}</p>
          <p>
            Estado:{" "}
            <span className="font-medium text-foreground">
              {saleStatusLabel(sale.status)}
            </span>
            {" · "}
            {paymentStatusLabel(sale.paymentStatus)}
          </p>
          {sale.payments.length > 0 && (
            <p>
              Método:{" "}
              {sale.payments.map((p) => paymentMethodLabel(p.method)).join(", ")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_50px_80px_70px_90px] border-b pb-2 text-xs font-medium text-muted-foreground">
            <span>Producto</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">P. unit.</span>
            <span className="text-right">IVA</span>
            <span className="text-right">Total</span>
          </div>
          {sale.items.map((item, index) => {
            const taxRate = Number(item.taxRate ?? 0);
            const discountAmt = Number(item.discountAmount ?? 0);
            return (
              <div
                key={`${item.product.name}-${index}`}
                className="border-b pb-2"
              >
                <div className="grid grid-cols-[1fr_50px_80px_70px_90px] gap-1">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    {discountAmt > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Desc. -{formatMoney(discountAmt)}
                      </p>
                    )}
                  </div>
                  <p className="text-right">{item.quantity}</p>
                  <p className="text-right text-muted-foreground">
                    {formatMoney(item.price)}
                  </p>
                  <p className="text-right text-muted-foreground">
                    {taxRate > 0 ? `${taxRate}%` : "—"}
                  </p>
                  <p className="text-right">{formatMoney(item.total)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1 text-right">
          {showBreakdown ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              {hasDiscount && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento</span>
                  <span>-{formatMoney(discountTotal)}</span>
                </div>
              )}
              {hasIva && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA</span>
                  <span>{formatMoney(taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Total</span>
                <span>{formatMoney(sale.total)}</span>
              </div>
            </>
          ) : (
            <p>
              Total:{" "}
              <span className="font-semibold">{formatMoney(sale.total)}</span>
            </p>
          )}
          <p className="text-muted-foreground">Pagado: {formatMoney(paid)}</p>
          {pending > 0 ? (
            <p className="text-amber-700">
              Saldo pendiente: {formatMoney(pending)}
            </p>
          ) : null}
        </div>

        <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
          Recibo simple / no válido como comprobante tributario.
        </p>
      </div>
    </>
  );
}
