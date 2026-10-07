import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { ProformaEditor } from "@/components/appsolux/sales/proforma-editor";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export default async function NewProformaPage() {
  const { user, tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const [customers, products, establishments] = await Promise.all([
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
    prisma.sriEstablishment.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return (
    <DashboardShell
      contentClassName="mx-auto max-w-[1700px]"
      mainClassName="px-4 py-5"
    >
      <ProformaEditor
        currentUserName={user.name}
        customers={customers.map((item) => ({
          id: item.id,
          name: item.name,
          tradeName: item.tradeName,
          identification: item.identification,
          phone: item.phone,
          email: item.email,
          address: item.address,
        }))}
        products={products.map((item) => ({
          id: item.id,
          name: item.name,
          code: item.primaryCode ?? item.barcode,
          description: item.description,
          price: Number(item.price),
          price2: item.price2 ? Number(item.price2) : null,
          price3: item.price3 ? Number(item.price3) : null,
          stock: item.trackInventory ? item.stock : 999999,
          taxRate: Number(item.taxRate),
        }))}
        establishments={establishments.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
        }))}
      />
    </DashboardShell>
  );
}
