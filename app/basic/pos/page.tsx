import Link from "next/link";
import { FileCheck2, ReceiptText, ShoppingCart, Users, Wallet } from "lucide-react";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { BasicPosClient } from "@/components/appsolux/basic/pos-client";
import { SalesQuickAction } from "@/components/appsolux/basic/sales-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getBasicReports, listCustomers, listProducts } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getSriDocuments } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicPosPageProps = {
  searchParams: Promise<{ customerId?: string }>;
};

export default async function BasicPosPage({ searchParams }: BasicPosPageProps) {
  const user = await getCurrentUser();
  const salesNavigation = [
    { title: "Dashboard", href: routes.sales },
    { title: "Nueva venta", href: routes.basicPos },
    { title: "Ventas", href: routes.basicSales },
    { title: "Clientes", href: routes.basicCustomers },
    { title: "Facturas SRI", href: routes.sriDocuments },
  ];

  if (!user) {
    return (
      <BasicModuleShell
        title="POS / Ventas"
        description="Vende, cobra y emite recibos o facturas electronicas desde un solo lugar."
        activeHref={routes.basicPos}
        appName="POS / Ventas"
        appDescription="Vende, cobra y emite recibos o facturas electronicas desde un solo lugar."
        badge="App"
        badgeVariant="emerald"
        navItems={salesNavigation}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedParams = await searchParams;
  const plan = await getTenantPlanState(tenant.id);

  const [products, customers, reports, sriDocs] = await Promise.all([
    listProducts(tenant.id),
    listCustomers(tenant.id),
    getBasicReports(tenant.id),
    getSriDocuments(tenant.id, { take: 20 }),
  ]);

  // Validate customerId belongs to this tenant
  let initialCustomerId = "";
  const rawCustomerId = resolvedParams.customerId ?? "";
  if (rawCustomerId) {
    const prisma = getPrismaClient();
    const found = await prisma.lightweightCustomer.findFirst({
      where: { id: rawCustomerId, tenantId: tenant.id },
      select: { id: true },
    });
    if (found) initialCustomerId = found.id;
  }

  if (!plan.canUseBasicPos) {
    return (
      <BasicModuleShell
        title="POS / Ventas"
        description="Vende, cobra y emite recibos o facturas electronicas desde un solo lugar."
        activeHref={routes.basicPos}
        appName="POS / Ventas"
        appDescription="Vende, cobra y emite recibos o facturas electronicas desde un solo lugar."
        badge="App"
        badgeVariant="emerald"
        navItems={salesNavigation}
      >
        <Card>
          <CardHeader>
            <CardTitle>POS basico no disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Tu plan actual no incluye POS basico.
            </p>
          </CardContent>
        </Card>
      </BasicModuleShell>
    );
  }

  return (
    <BasicModuleShell
      title="POS / Ventas"
      description="Vende, cobra y emite recibos o facturas electronicas desde un solo lugar."
      activeHref={routes.basicPos}
      appName="POS / Ventas"
      appDescription="Vende, cobra y emite recibos o facturas electronicas desde un solo lugar."
      badge="App"
      badgeVariant="emerald"
      navItems={salesNavigation}
    >
      <div className="space-y-6">
        <div className="rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                App de ventas
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Vende, cobra y emite recibos o facturas electronicas.
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                El descuento de inventario depende siempre de la venta. Luego eliges si esa salida
                queda como recibo interno o inicia la factura SRI.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={routes.basicSales}
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
              >
                Ver ventas
              </Link>
              <Link
                href={routes.sriDocuments}
                className="inline-flex items-center rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:bg-sky-100"
              >
                Facturas SRI
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SalesQuickAction
            href={routes.basicSales}
            title="Ventas recientes"
            description={`${reports.counts.receipts} ventas registradas para seguimiento.`}
            icon={ShoppingCart}
          />
          <SalesQuickAction
            href={routes.basicCustomers}
            title="Clientes"
            description={`${reports.counts.customers} clientes disponibles para cobrar o fiar.`}
            icon={Users}
          />
          <SalesQuickAction
            href={routes.sriDocuments}
            title="Facturas SRI"
            description={`${sriDocs.length} comprobantes SRI recientes para revisar.`}
            icon={FileCheck2}
          />
          <SalesQuickAction
            href={routes.basicCash}
            title="Caja / cierre"
            description="Consulta cobros y movimientos diarios de caja."
            icon={Wallet}
          />
        </div>

        <BasicPosClient
          tenantName={tenant.name}
          initialCustomerId={initialCustomerId}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price.toString(),
            stock: product.stock,
            barcode: product.barcode,
          }))}
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
          }))}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Recibo interno</p>
                <p className="mt-1 text-sm text-slate-600">
                  Registra la venta, descuenta stock y deja un comprobante operativo sin enviarlo al SRI.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Factura electronica SRI</p>
                <p className="mt-1 text-sm text-slate-600">
                  Usa la misma venta como origen y arranca la preparacion SRI sin exponer pasos tecnicos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BasicModuleShell>
  );
}
