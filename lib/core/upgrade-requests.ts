import "@/lib/security/server-only";

import { PlanUpgradeRequestStatus, TenantSubscriptionStatus } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { getTenantPlanState, type PlanKey } from "@/lib/core/plans";

export const upgradeRequestPlanKeys = ["pro", "enterprise"] as const;
export type UpgradeRequestPlanKey = (typeof upgradeRequestPlanKeys)[number];
export type UpgradeReviewAction = "approve" | "reject";

const planRank: Record<PlanKey, number> = {
  free: 0,
  trial: 1,
  pro: 2,
  enterprise: 3,
};

export function isUpgradeRequestPlanKey(
  value: unknown
): value is UpgradeRequestPlanKey {
  return (
    typeof value === "string" &&
    upgradeRequestPlanKeys.includes(value as UpgradeRequestPlanKey)
  );
}

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, 1000) : null;
}

function assertCanRequestPlan(currentPlanKey: PlanKey, requestedPlanKey: PlanKey) {
  if (planRank[currentPlanKey] >= planRank[requestedPlanKey]) {
    throw new Error("Tu plan actual ya es igual o superior al solicitado.");
  }
}

export async function createPlanUpgradeRequest(input: {
  tenantId: string;
  userId: string;
  requestedPlanKey: UpgradeRequestPlanKey;
  message?: string | null;
}) {
  const prisma = getPrismaClient();
  const plan = await getTenantPlanState(input.tenantId);

  assertCanRequestPlan(plan.planKey, input.requestedPlanKey);

  const existingPending = await prisma.planUpgradeRequest.findFirst({
    where: {
      tenantId: input.tenantId,
      status: PlanUpgradeRequestStatus.pending,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingPending) {
    return {
      request: existingPending,
      created: false,
      message: "Ya tienes una solicitud en revision.",
    };
  }

  const request = await prisma.planUpgradeRequest.create({
    data: {
      tenantId: input.tenantId,
      requestedById: input.userId,
      currentPlanKey: plan.planKey,
      requestedPlanKey: input.requestedPlanKey,
      message: cleanText(input.message),
      status: PlanUpgradeRequestStatus.pending,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      action: "plan_upgrade.requested",
      entityType: "PlanUpgradeRequest",
      entityId: request.id,
      metadata: {
        currentPlanKey: plan.planKey,
        requestedPlanKey: input.requestedPlanKey,
      },
    },
  });

  return {
    request,
    created: true,
    message: "Solicitud enviada.",
  };
}

export async function getTenantUpgradeRequests(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.planUpgradeRequest.findMany({
    where: { tenantId },
    include: {
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 20,
  });
}

export async function listUpgradeRequestsForAdmin() {
  const prisma = getPrismaClient();
  const requests = await prisma.planUpgradeRequest.findMany({
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          planKey: true,
        },
      },
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  return requests.sort((a, b) => {
    if (a.status === PlanUpgradeRequestStatus.pending && b.status !== PlanUpgradeRequestStatus.pending) {
      return -1;
    }

    if (a.status !== PlanUpgradeRequestStatus.pending && b.status === PlanUpgradeRequestStatus.pending) {
      return 1;
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function reviewUpgradeRequest(input: {
  requestId: string;
  action: UpgradeReviewAction;
  adminUserId: string;
  adminNote?: string | null;
}) {
  const prisma = getPrismaClient();
  const adminNote = cleanText(input.adminNote);

  return prisma.$transaction(async (tx) => {
    const request = await tx.planUpgradeRequest.findUnique({
      where: { id: input.requestId },
      include: { tenant: true },
    });

    if (!request) {
      throw new Error("Solicitud no encontrada.");
    }

    if (request.status !== PlanUpgradeRequestStatus.pending) {
      throw new Error("La solicitud ya fue revisada.");
    }

    if (!isUpgradeRequestPlanKey(request.requestedPlanKey)) {
      throw new Error("Plan solicitado invalido.");
    }

    if (input.action === "reject") {
      const rejected = await tx.planUpgradeRequest.update({
        where: { id: request.id },
        data: {
          status: PlanUpgradeRequestStatus.rejected,
          reviewedById: input.adminUserId,
          reviewedAt: new Date(),
          adminNote,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: request.tenantId,
          userId: input.adminUserId,
          action: "plan_upgrade.rejected",
          entityType: "PlanUpgradeRequest",
          entityId: request.id,
          metadata: {
            requestedPlanKey: request.requestedPlanKey,
            adminNote,
          },
        },
      });

      return rejected;
    }

    const plan = await tx.plan.findUnique({
      where: { key: request.requestedPlanKey },
    });

    if (!plan) {
      throw new Error("Plan no encontrado. Ejecuta maintenance:ensure-plans.");
    }

    const currentSubscription = await tx.tenantSubscription.findFirst({
      where: { tenantId: request.tenantId },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });

    const subscription = currentSubscription
      ? await tx.tenantSubscription.update({
          where: { id: currentSubscription.id },
          data: {
            planId: plan.id,
            status: TenantSubscriptionStatus.manual,
          },
          include: { plan: true },
        })
      : await tx.tenantSubscription.create({
          data: {
            tenantId: request.tenantId,
            planId: plan.id,
            status: TenantSubscriptionStatus.manual,
          },
          include: { plan: true },
        });

    await tx.tenant.update({
      where: { id: request.tenantId },
      data: { planKey: request.requestedPlanKey },
    });

    const approved = await tx.planUpgradeRequest.update({
      where: { id: request.id },
      data: {
        status: PlanUpgradeRequestStatus.approved,
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        adminNote,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: input.adminUserId,
        action: "plan_upgrade.approved",
        entityType: "PlanUpgradeRequest",
        entityId: request.id,
        metadata: {
          previousPlanKey: currentSubscription?.plan.key ?? request.currentPlanKey,
          nextPlanKey: request.requestedPlanKey,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          adminNote,
        },
      },
    });

    return approved;
  });
}
