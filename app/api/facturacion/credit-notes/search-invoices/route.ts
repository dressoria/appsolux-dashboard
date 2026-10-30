import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export async function GET(request: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const search = (request.nextUrl.searchParams.get("q") ?? "").trim();

  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    documentType: "INVOICE",
    status: "AUTHORIZED",
  };

  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: "insensitive" } },
      { customerIdentification: { contains: search, mode: "insensitive" } },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices = await prisma.sriDocument.findMany({
    where: where as any,
    select: {
      id: true,
      sequentialNumber: true,
      issuedAt: true,
      customerName: true,
      customerIdentification: true,
      grandTotal: true,
      establishment: { select: { code: true } },
      issuePoint: { select: { code: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    ok: true,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      displayNumber: inv.sequentialNumber
        ? `${inv.establishment?.code ?? "???"}-${inv.issuePoint?.code ?? "???"}-${String(inv.sequentialNumber).padStart(9, "0")}`
        : inv.id.slice(-8),
      issuedAt: inv.issuedAt?.toISOString() ?? null,
      customerName: inv.customerName,
      customerIdentification: inv.customerIdentification,
      grandTotal: inv.grandTotal?.toString() ?? "0",
    })),
  });
}
