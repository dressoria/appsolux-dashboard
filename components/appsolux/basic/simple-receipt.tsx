"use client";

import { Button } from "@/components/ui/button";

type ReceiptSale = {
  id: string;
  createdAt: string | Date;
  total: string;
  status: string;
  paymentStatus: string;
  customer?: { name: string } | null;
  items: Array<{
    quantity: number;
    price: string;
    total: string;
    product: { name: string };
  }>;
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
          <div className="grid grid-cols-[1fr_70px_90px] border-b pb-2 text-xs font-medium text-muted-foreground">
            <span>Producto</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Total</span>
          </div>
          {sale.items.map((item, index) => (
            <div
              key={`${item.product.name}-${index}`}
              className="grid grid-cols-[1fr_70px_90px] gap-3 border-b pb-2"
            >
              <div>
                <p className="font-medium">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(item.price)} c/u
                </p>
              </div>
              <p className="text-right">{item.quantity}</p>
              <p className="text-right">{formatMoney(item.total)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-right">
          <p>
            Total:{" "}
            <span className="font-semibold">{formatMoney(sale.total)}</span>
          </p>
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
