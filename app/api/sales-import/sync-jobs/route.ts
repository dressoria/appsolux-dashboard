import { canResumeSalesJob } from "@/lib/core/sales-sync-adapter";
import { NextRequest, NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 20));

  const select = {
        id: true,
        type: true,
        status: true,
        dateFrom: true,
        dateTo: true,
        checkpointDate: true,
        totalDays: true,
        completedDays: true,
        currentDateLabel: true,
        attemptCount: true,
        maxAttempts: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        documentsFound: true,
        documentsImported: true,
        documentsSkipped: true,
        documentsRejected: true,
        updatedAt: true,
        attemptHistory: true,
        documentsFailed: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
      } as const;

  const [jobs, total, activeJob, candidates, lastSuccess] = await Promise.all([
    prisma.salesSriSyncJob.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select,
    }),
    prisma.salesSriSyncJob.count({ where: { tenantId: tenant.id } }),
    prisma.salesSriSyncJob.findFirst({ where: { tenantId: tenant.id, status: { in: ["QUEUED", "RUNNING"] } }, orderBy: [{ status: "desc" }, { createdAt: "desc" }], select }),
    prisma.salesSriSyncJob.findMany({ where: { tenantId: tenant.id, type: "SYNC_ISSUED_DOCUMENTS", status: { in: ["FAILED", "PARTIAL", "HUMAN_VERIFICATION_REQUIRED"] } }, orderBy: [{ checkpointDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 50, select }),
    prisma.salesSriSyncJob.findFirst({ where: { tenantId: tenant.id, type: "SYNC_ISSUED_DOCUMENTS", status: "SUCCEEDED" }, orderBy: { dateTo: "desc" }, select: { dateFrom: true, dateTo: true } }),
  ]);

  const resumable = activeJob && canResumeSalesJob(activeJob) ? activeJob : candidates.find((job) => canResumeSalesJob(job) && !(lastSuccess?.dateFrom && lastSuccess.dateTo && job.dateFrom && job.dateTo && lastSuccess.dateFrom <= job.dateFrom && lastSuccess.dateTo >= job.dateTo));
  const present = (job: typeof jobs[number]) => ({ ...job, resumable: canResumeSalesJob(job) });
  return NextResponse.json({
    ok: true,
    jobs: jobs.map(present),
    activeJob: activeJob ? present(activeJob) : null,
    resumeJob: resumable ? present(resumable) : null,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
