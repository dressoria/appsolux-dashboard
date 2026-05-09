import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextPurchaseReceipts } from "@/lib/api/erpnext/purchase-receipts";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getReceiptStatus(status?: string, docstatus?: 0 | 1 | 2) {
  if (docstatus === 2) return "Anulado";
  if (docstatus === 0) return "Borrador";
  if (!status) return "Borrador";

  const s = status.toLowerCase();
  if (s === "draft") return "Borrador";
  if (s === "completed") return "Completado";
  if (s === "cancelled") return "Anulado";
  if (s === "return issued") return "Devolucion emitida";
  if (s === "closed") return "Cerrado";

  return status;
}

export default async function ErpPurchasesReceiptsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver ingresos de mercaderia.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpPurchases} className="hover:underline">
                Compras
              </Link>{" "}
              / Ingresos de mercaderia
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Ingresos de mercaderia
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>
                El ERP dedicado es necesario para ver ingresos de mercaderia.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const receipts = await getErpnextPurchaseReceipts();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpPurchases} className="hover:underline">
                Compras
              </Link>{" "}
              / Ingresos de mercaderia
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Ingresos de mercaderia
            </h1>
            <p className="mt-2 text-muted-foreground">
              Recepciones de productos comprados registradas en bodega.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesDocuments}>Ver compras</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpPurchases}>Volver a compras</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay ingresos de mercaderia registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Ingreso</th>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {receipts.map((receipt) => (
                      <tr key={receipt.name}>
                        <td className="py-2 pr-4 font-medium">{receipt.name}</td>
                        <td className="py-2 pr-4">
                          {receipt.supplier_name ?? receipt.supplier}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {receipt.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {getReceiptStatus(receipt.status, receipt.docstatus)}
                        </td>
                        <td className="py-2 font-medium">
                          {formatMoney(receipt.grand_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
