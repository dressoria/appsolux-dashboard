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
    },
    {
      title: "Facturas",
      value: String(reports.sales.total_invoices),
      description: `${reports.sales.paid_invoices} pagadas, ${reports.sales.unpaid_invoices} pendientes`,
    },
    {
      title: "Cobrado",
      value: formatMoney(reports.payments.total_paid_amount),
      description: `${reports.payments.total_payments} cobros registrados`,
    },
    {
      title: "Pendiente",
      value: formatMoney(reports.sales.outstanding_amount),
      description: "Saldo pendiente de facturas confirmadas",
    },
    {
      title: "Bajo stock",
      value: String(reports.inventory.low_stock_items),
      description: "Productos con 5 unidades o menos",
    },
    {
      title: "Sin stock",
      value: String(reports.inventory.out_of_stock_items),
      description: "Registros sin unidades disponibles",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {summaryCards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={valueClassName}>{card.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
