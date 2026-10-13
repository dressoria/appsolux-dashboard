import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const batches = await prisma.salesImportBatch.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    batches: batches.map((b) => ({
      id: b.id,
      fileName: b.fileName,
      sourceType: b.sourceType,
      status: b.status,
      totalRows: b.totalRows,
      validRows: b.validRows,
      warningRows: b.warningRows,
      errorRows: b.errorRows,
      importedSales: b.importedSales,
      totalAmount: b.totalAmount.toString(),
      createdAt: b.createdAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
      createdByName: b.createdBy.name,
    })),
  });
}
