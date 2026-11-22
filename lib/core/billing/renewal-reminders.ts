import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

export const RENEWAL_REMINDER_WINDOWS_DAYS = [7, 3, 1] as const;

export type RenewalReminderResult = {
  processed: number;
  reminders: Array<{
    tenantId: string;
    subscriptionId: string;
    daysUntilExpiry: number;
    periodEndsAt: string;
  }>;
};

export async function generateRenewalReminders(
  now: Date = new Date(),
): Promise<RenewalReminderResult> {
  const prisma = getPrismaClient();
  const result: RenewalReminderResult = { processed: 0, reminders: [] };

  for (const windowDays of RENEWAL_REMINDER_WINDOWS_DAYS) {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + windowDays);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(windowStart);
    windowEnd.setHours(23, 59, 59, 999);

    const expiring = await prisma.tenantSubscription.findMany({
      where: {
        status: "active",
        billingMode: "manual",
        currentPeriodEndsAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, tenantId: true, currentPeriodEndsAt: true },
    });

    if (expiring.length === 0) continue;

    const existingReminders = await prisma.auditLog.findMany({
      where: {
        action: "subscription_renewal_reminder",
        entityId: { in: expiring.map((s) => s.id) },
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      select: { entityId: true, metadata: true },
    });

    const alreadySent = new Set(
      existingReminders
        .filter((r) => {
          const meta = r.metadata as Record<string, unknown> | null;
          return meta?.windowDays === windowDays;
        })
        .map((r) => r.entityId),
    );

    const toNotify = expiring.filter((s) => !alreadySent.has(s.id));
    if (toNotify.length === 0) continue;

    await prisma.auditLog.createMany({
      data: toNotify.map((s) => ({
        tenantId: s.tenantId,
        action: "subscription_renewal_reminder",
        entityType: "TenantSubscription",
        entityId: s.id,
        metadata: {
          windowDays,
          periodEndsAt: s.currentPeriodEndsAt?.toISOString() ?? null,
          generatedAt: now.toISOString(),
        },
      })),
    });

    for (const s of toNotify) {
      result.reminders.push({
        tenantId: s.tenantId,
        subscriptionId: s.id,
        daysUntilExpiry: windowDays,
        periodEndsAt: s.currentPeriodEndsAt?.toISOString() ?? "",
      });
    }
  }

  result.processed = result.reminders.length;
  return result;
}

export async function getActiveRenewalReminders(tenantId: string, now: Date = new Date()) {
  const prisma = getPrismaClient();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return prisma.auditLog.findMany({
    where: {
      tenantId,
      action: "subscription_renewal_reminder",
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}
