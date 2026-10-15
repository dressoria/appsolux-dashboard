import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getProductById } from "@/lib/core/inventory-products";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { getBrands } from "@/lib/core/inventory-brands";
import { getUnits } from "@/lib/core/inventory-units";
import { getPrismaClient } from "@/lib/db/prisma";
import { ProductFormClient } from "../product-form-client";
import { notFound } from "next/navigation";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { tenant } = await requireDashboardSession();
  const { productId } = await params;
  const prisma = getPrismaClient();

  const [product, warehouses, brands, units, categories] = await Promise.all([
    getProductById(tenant.id, productId),
    getWarehouses(tenant.id),
    getBrands(tenant.id),
    getUnits(tenant.id),
    prisma.lightweightProductCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <DashboardShell>
      <ProductFormClient
        mode="edit"
        product={JSON.parse(JSON.stringify(product))}
        warehouses={JSON.parse(JSON.stringify(warehouses))}
        brands={JSON.parse(JSON.stringify(brands))}
        units={JSON.parse(JSON.stringify(units))}
        categories={JSON.parse(JSON.stringify(categories))}
      />
    </DashboardShell>
  );
}
