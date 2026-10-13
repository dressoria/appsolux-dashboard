import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const receipts = await prisma.purchaseReceipt.findMany({
    where: { tenantId: tenant.id },
    include: {
      supplier: { select: { name: true, identification: true } },
      purchaseDocument: { select: { supplierDocumentNumber: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(receipts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const body = await req.json();

  const receipt = await prisma.purchaseReceipt.create({
    data: {
      tenantId: tenant.id,
      createdByUserId: user.id,
      purchaseDocumentId: body.purchaseDocumentId ?? undefined,
      supplierId: body.supplierId ?? undefined,
      warehouseId: body.warehouseId ?? undefined,
      notes: body.notes,
      items: body.items?.length
        ? {
            create: body.items.map((item: { productId: string; quantityExpected: number; quantityReceived: number }) => ({
              productId: item.productId,
              quantityExpected: item.quantityExpected ?? 0,
              quantityReceived: item.quantityReceived,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json({ ok: true, receipt });
}
