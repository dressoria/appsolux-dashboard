import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErpnextCustomer } from "@/types/erpnext";

type CustomersTableProps = {
  customers: ErpnextCustomer[];
};

function formatFlag(value: 0 | 1 | undefined) {
  return value === 1 ? "Si" : "No";
}

export function CustomersTable({ customers }: CustomersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes</CardTitle>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No hay clientes en ERPNext. Crea el primer cliente desde el
            formulario.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Cliente</th>
                  <th className="py-2 pr-4 font-medium">Tipo</th>
                  <th className="py-2 pr-4 font-medium">Territorio</th>
                  <th className="py-2 font-medium">Deshabilitado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((customer) => (
                  <tr key={customer.name}>
                    <td className="py-2 pr-4 font-medium">
                      {customer.customer_name}
                    </td>
                    <td className="py-2 pr-4">
                      {customer.customer_type ?? "-"}
                    </td>
                    <td className="py-2 pr-4">{customer.territory ?? "-"}</td>
                    <td className="py-2">{formatFlag(customer.disabled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
