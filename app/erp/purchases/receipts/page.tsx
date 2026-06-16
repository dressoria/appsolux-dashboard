import Link from "next/link";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
import { CreatePurchaseReceiptDialog } from "@/components/appsolux/erp/create-purchase-receipt-dialog";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextPurchaseReceipts } from "@/lib/api/erpnext/purchase-receipts";
import { getErpnextSuppliers } from "@/lib/api/erpnext/suppliers";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
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

  if (!tenantMode.canUseAdvancedErp) {
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

  const [receipts, suppliers, items, companies, warehouses] = await Promise.all(
    [
      getErpnextPurchaseReceipts().catch(() => []),
      getErpnextSuppliers().catch(() => []),
      getErpnextItems().catch(() => []),
      getErpnextCompanies().catch(() => []),
      getErpnextWarehouses().catch(() => []),
    ]
  );

  const operativeWarehouses = warehouses.filter((w) => w.is_group !== 1);

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
              <Link href={routes.erpInventoryStock}>Ver stock</Link>
            </Button>
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

        {suppliers.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No hay proveedores registrados.{" "}
            <Link
              href={routes.erpPurchasesSuppliers}
              className="underline underline-offset-2"
            >
              Crea un proveedor
            </Link>{" "}
            antes de registrar ingresos.
          </div>
        ) : null}

        {operativeWarehouses.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No hay bodegas operativas.{" "}
            <Link
              href={routes.erpInventoryWarehouses}
              className="underline underline-offset-2"
            >
              Crea una bodega
            </Link>{" "}
            antes de registrar ingresos.
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No hay productos registrados.{" "}
            <Link
              href={routes.erpInventoryProducts}
              className="underline underline-offset-2"
            >
              Crea productos
            </Link>{" "}
            antes de registrar ingresos.
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <CreatePurchaseReceiptDialog
            suppliers={suppliers}
            items={items}
            companies={companies}
            warehouses={warehouses}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          Los ingresos se crean en borrador. El stock se actualiza cuando el
          documento sea confirmado en el ERP. Despues de confirmar, el movimiento
          aparece en{" "}
          <Link
            href={routes.erpInventoryStock}
            className="underline underline-offset-2"
          >
            Ver stock
          </Link>{" "}
          y en{" "}
          <Link
            href={routes.erpInventoryMovements}
            className="underline underline-offset-2"
          >
            Movimientos
          </Link>
          .
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay ingresos de mercaderia registrados. Usa el boton{" "}
                <span className="font-medium">
                  Registrar ingreso de mercaderia
                </span>{" "}
                para crear el primero.
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
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {receipts.map((receipt) => (
                      <tr key={receipt.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {receipt.name}
                        </td>
                        <td className="py-2 pr-4">
                          {receipt.supplier_name ?? receipt.supplier}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {receipt.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {getReceiptStatus(receipt.status, receipt.docstatus)}
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          {formatMoney(receipt.grand_total)}
                        </td>
                        <td className="py-2">
                          <DocumentActions
                            doctype="Purchase Receipt"
                            name={receipt.name}
                            size="xs"
                          />
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
