import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { SalesOrderEditor } from "./sales-order-editor";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export default async function NewSalesOrderPage() {
  const { user, tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const [customers, products, warehouses] = await Promise.all([
    prisma.lightweightCustomer.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.lightweightProduct.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.inventoryWarehouse.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <DashboardShell contentClassName="mx-auto max-w-[1700px]" mainClassName="px-4 py-5">
      <SalesOrderEditor
        currentUserName={user.name}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          identification: c.identification,
          email: c.email,
          phone: c.phone,
          address: c.address,
        }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.primaryCode ?? p.barcode,
          description: p.description,
          price: Number(p.price),
          price2: p.price2 ? Number(p.price2) : null,
          price3: p.price3 ? Number(p.price3) : null,
          stock: p.trackInventory ? p.stock : 999999,
          taxRate: Number(p.taxRate),
          taxCategory: p.taxCategory,
        }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
      />
    </DashboardShell>
  );
}
