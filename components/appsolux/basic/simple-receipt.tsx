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

function paymentLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Fiado/credito",
  };

  return labels[method] ?? method;
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
    <div className="space-y-4 rounded-md border bg-background p-4 text-sm print:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{tenantName}</p>
          <p className="text-xs text-muted-foreground">
            Recibo #{shortId} · {date.toLocaleString("es-EC")}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
          Imprimir
        </Button>
      </div>

      <div className="grid gap-1 text-muted-foreground">
        <p>Cliente: {sale.customer?.name ?? "Consumidor final"}</p>
        <p>Estado: {sale.status} · pago {sale.paymentStatus}</p>
        <p>
          Metodo: {sale.payments.map((payment) => paymentLabel(payment.method)).join(", ")}
        </p>
      </div>

      <div className="space-y-2">
        {sale.items.map((item, index) => (
          <div key={`${item.product.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 border-b pb-2">
            <div>
              <p className="font-medium">{item.product.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} x {formatMoney(item.price)}
              </p>
            </div>
            <p>{formatMoney(item.total)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1 text-right">
        <p>Total: <span className="font-semibold">{formatMoney(sale.total)}</span></p>
        <p className="text-muted-foreground">Pagado: {formatMoney(paid)}</p>
        {pending > 0 ? (
          <p className="text-amber-700">Pendiente: {formatMoney(pending)}</p>
        ) : null}
      </div>

      <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
        Recibo simple / no valido como comprobante tributario.
      </p>
    </div>
  );
}
