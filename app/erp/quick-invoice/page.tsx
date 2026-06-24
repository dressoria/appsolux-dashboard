import Link from "next/link";

import { QuickInvoiceClient } from "@/components/appsolux/erp/quick-invoice-client";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getErpProductPricingMap } from "@/lib/core/erp-pricing";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

async function loadResource<T>(loader: () => Promise<T>, fallback: T) {
  try {
    return {
      data: await loader(),
      error: null as string | null,
    };
  } catch (error) {
    return {
      data: fallback,
      error:
        error instanceof Error ? error.message : "No se pudo cargar la informacion ERP.",
    };
  }
}

export default async function QuickInvoicePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para usar el facturador rapido.</p>
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
                Facturacion
              </Link>{" "}
              / Facturador rapido
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Facturador rapido bloqueado</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Esta herramienta necesita Facturacion con motor empresarial activo para este tenant.
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [itemsResult, customersResult, mastersResult, warehousesResult, modesOfPaymentResult] =
    await Promise.all([
      loadResource(getErpnextItems, []),
      loadResource(getErpnextCustomers, []),
      loadResource(getErpnextMasters, {
        itemGroups: [],
        uoms: [],
        territories: [],
        companies: [],
      }),
      loadResource(getErpnextWarehouses, []),
      loadResource(getErpnextModesOfPayment, []),
    ]);
  const pricingMap = await getErpProductPricingMap(
    tenant.id,
    itemsResult.data.map((item) => item.item_code)
  );
  const activeItems = itemsResult.data
    .filter((item) => item.disabled !== 1)
    .map((item) => ({
      itemCode: item.item_code,
      itemName: item.item_name,
      pricing: pricingMap[item.item_code] ?? null,
    }));
  const activeCustomers = customersResult.data
    .filter((customer) => customer.disabled !== 1)
    .map((customer) => ({
      name: customer.name,
      customerName: customer.customer_name,
      taxId: customer.tax_id ?? null,
      mobileNo: customer.mobile_no ?? null,
    }));
  const usableWarehouses = warehousesResult.data
    .filter((warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1)
    .map((warehouse) => warehouse.name);
  const enabledModesOfPayment = modesOfPaymentResult.data
    .filter((mode) => mode.enabled !== false && mode.enabled !== 0)
    .map((mode) => mode.name);
  const errors = [
    itemsResult.error,
    customersResult.error,
    mastersResult.error,
    warehousesResult.error,
    modesOfPaymentResult.error,
  ].filter(Boolean);

  return (
    <DashboardShell contentClassName="mx-auto max-w-7xl">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50 shadow-sm shadow-sky-100/60">
          <div className="space-y-3 px-6 py-8 lg:px-8">
            <p className="text-sm text-slate-500">
              <Link href={routes.erp} className="hover:text-slate-900">
                Facturacion
              </Link>{" "}
              / Facturador rapido
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Facturador rapido
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Convierte mensajes libres en borradores revisables usando el mismo motor de
              ventas y facturacion del POS.
            </p>
          </div>
        </section>

        {errors.length > 0 ? (
          <Card className="rounded-[28px] border-amber-200 bg-amber-50 py-0">
            <CardContent className="space-y-1 p-4 text-sm text-amber-800">
              {errors.map((error, index) => (
                <p key={`${error}-${index}`}>{error}</p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <QuickInvoiceClient
          items={activeItems}
          customers={activeCustomers}
          companies={mastersResult.data.companies.map((company) => ({
            name: company.name,
            companyName: company.company_name ?? null,
          }))}
          territories={mastersResult.data.territories.map((territory) => territory.name)}
          warehouses={usableWarehouses}
          modesOfPayment={enabledModesOfPayment}
          defaultCompanyName={mastersResult.data.companies[0]?.name}
        />
      </div>
    </DashboardShell>
  );
}
