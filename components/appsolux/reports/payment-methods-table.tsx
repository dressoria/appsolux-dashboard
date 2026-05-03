import { ReportsEmptyState } from "./reports-empty-state";
import type { PaymentMethodReportItem } from "@/types/reports";

type PaymentMethodsTableProps = {
  methods: PaymentMethodReportItem[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function PaymentMethodsTable({ methods }: PaymentMethodsTableProps) {
  if (methods.length === 0) {
    return (
      <ReportsEmptyState message="Aun no hay cobros confirmados por metodo de pago." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Metodo de pago</th>
            <th className="py-2 pr-4 font-medium">Cobros</th>
            <th className="py-2 font-medium">Total cobrado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {methods.map((method) => (
            <tr key={method.mode_of_payment}>
              <td className="py-2 pr-4 font-medium">
                {method.mode_of_payment}
              </td>
              <td className="py-2 pr-4">{method.count}</td>
              <td className="py-2">{formatMoney(method.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
