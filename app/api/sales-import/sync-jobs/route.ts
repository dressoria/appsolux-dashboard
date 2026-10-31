import { NextRequest, NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 20));

  const [jobs, total] = await Promise.all([
    prisma.salesSriSyncJob.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        status: true,
        dateFrom: true,
        dateTo: true,
        attemptCount: true,
        maxAttempts: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        documentsFound: true,
        documentsImported: true,
        documentsSkipped: true,
        documentsFailed: true,
        errorCode: true,
        checkpointDate: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.salesSriSyncJob.count({ where: { tenantId: tenant.id } }),
  ]);

  return NextResponse.json({
    ok: true,
    jobs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
