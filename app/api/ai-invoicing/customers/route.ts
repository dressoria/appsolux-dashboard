import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";

export async function GET(request: Request) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ ok: true, customers: [] });
  }

  const prisma = getPrismaClient();
  const customers = await prisma.lightweightCustomer.findMany({
    where: {
      tenantId: access.tenant.id,
      isActive: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { tradeName: { contains: q, mode: "insensitive" } },
        { identification: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      tradeName: true,
      identification: true,
      identificationType: true,
      email: true,
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json({ ok: true, customers });
}
