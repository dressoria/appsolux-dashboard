import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportsDashboardData } from "@/types/reports";

type ReportsSummaryProps = {
  reports: ReportsDashboardData;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

const valueClassName = "text-2xl font-semibold tracking-tight";

export function ReportsSummary({ reports }: ReportsSummaryProps) {
  const summaryCards = [
    {
      title: "Total vendido",
      value: formatMoney(reports.sales.total_sales_amount),
      description: "Facturas no anuladas",
      valueClass: "text-green-700",
    },
    {
      title: "Cobrado",
      value: formatMoney(reports.payments.total_paid_amount),
      description: `${reports.payments.total_payments} cobros registrados`,
      valueClass: "text-green-700",
    },
    {
      title: "Por cobrar",
      value: formatMoney(reports.sales.outstanding_amount),
      description: `${reports.sales.unpaid_invoices} facturas pendientes`,
      valueClass:
        reports.sales.outstanding_amount > 0 ? "text-amber-600" : "",
    },
    {
      title: "Total comprado",
      value: formatMoney(reports.purchases.total_purchases_amount),
      description: `${reports.purchases.total_purchase_invoices} facturas de compra`,
      valueClass: "",
    },
    {
      title: "Por pagar",
      value: formatMoney(reports.purchases.outstanding_payable),
      description: `${reports.purchases.pending_payables} facturas pendientes`,
      valueClass:
        reports.purchases.outstanding_payable > 0 ? "text-rose-600" : "",
    },
    {
      title: "Stock bajo",
      value: String(reports.inventory.low_stock_items),
      description: "Productos con 5 unidades o menos",
      valueClass:
        reports.inventory.low_stock_items > 0 ? "text-amber-600" : "",
    },
    {
      title: "Sin stock",
      value: String(reports.inventory.out_of_stock_items),
      description: "Registros sin unidades disponibles",
      valueClass:
        reports.inventory.out_of_stock_items > 0 ? "text-rose-600" : "",
    },
    {
      title: "Facturas emitidas",
      value: String(reports.sales.total_invoices),
      description: `${reports.sales.paid_invoices} pagadas, ${reports.sales.draft_invoices} borradores`,
      valueClass: "",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`${valueClassName} ${card.valueClass}`}>
              {card.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
