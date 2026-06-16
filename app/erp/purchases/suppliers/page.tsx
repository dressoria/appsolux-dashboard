import Link from "next/link";
import { CreateSupplierForm } from "@/components/appsolux/erp/create-supplier-form";
import { SupplierActions } from "@/components/appsolux/erp/supplier-actions";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextSuppliers } from "@/lib/api/erpnext/suppliers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpPurchasesSuppliersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver proveedores.
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
              / Proveedores
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Proveedores
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver proveedores.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const suppliers = await getErpnextSuppliers();

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
              / Proveedores
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Proveedores
            </h1>
            <p className="mt-2 text-muted-foreground">
              Directorio de proveedores registrados en el ERP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesSupplierBalances}>
                Proveedores con saldo
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpPurchases}>Volver a compras</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <CreateSupplierForm />

        <Card>
          <CardHeader>
            <CardTitle>Proveedores registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {suppliers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay proveedores registrados en el ERP. Usa el formulario
                de arriba para crear el primero.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      <th className="py-2 pr-4 font-medium">RUC / ID fiscal</th>
                      <th className="py-2 pr-4 font-medium">Email</th>
                      <th className="py-2 pr-4 font-medium">Telefono</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {suppliers.map((supplier) => (
                      <tr key={supplier.name}>
                        <td className="py-2 pr-4 font-medium">
                          {supplier.supplier_name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {supplier.supplier_type === "Company"
                            ? "Empresa"
                            : supplier.supplier_type === "Individual"
                              ? "Persona"
                              : supplier.supplier_type ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {supplier.tax_id ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {supplier.email_id ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {supplier.mobile_no ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {supplier.disabled === 1 ? (
                            <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
                              Inactivo
                            </span>
                          ) : (
                            <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                              Activo
                            </span>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Button asChild size="xs" variant="outline">
                              <Link
                                href={`${routes.erpPurchasesSuppliers}/${encodeURIComponent(supplier.name)}`}
                              >
                                Historial
                              </Link>
                            </Button>
                            <SupplierActions supplier={supplier} />
                          </div>
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
