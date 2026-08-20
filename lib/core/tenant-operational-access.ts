import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import {
  evaluateBillingAccess,
  isWithinPlanLimit,
  type BillingAccessDecision,
} from "@/lib/core/billing-access-policy";
import { getLimit, getTenantSubscription } from "@/lib/core/plans";

export class TenantOperationalAccessError extends Error {
  readonly code = "TENANT_OPERATION_SUSPENDED";
  readonly status = 403;
  readonly href = "/billing";

  constructor(public readonly access: BillingAccessDecision) {
    super(
      access.reason === "trial_expired"
        ? "Tu prueba terminó. Elige un plan para continuar usando Facturom."
        : "Tu plan requiere atención para continuar operando Facturom."
    );
  }
}

export async function getTenantOperationalAccess(
  tenantId: string,
  now = new Date()
) {
  const prisma = getPrismaClient();
  const [tenant, subscription] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        status: true,
        operationalConfig: { select: { status: true } },
      },
    }),
    getTenantSubscription(tenantId),
  ]);

  if (!tenant) {
    throw new Error("Tenant no encontrado.");
  }

  const billing = evaluateBillingAccess({
    status: subscription?.status ?? "suspended",
    now,
    trialEndsAt: subscription?.trialEndsAt,
    graceEndsAt: subscription?.graceEndsAt,
  });
  const trialDaysRemaining = subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  const administrativelySuspended =
    tenant.status === "suspended" ||
    tenant.status === "failed" ||
    tenant.operationalConfig?.status === "suspended" ||
    tenant.operationalConfig?.status === "disabled";

  if (administrativelySuspended) {
    return {
      ...billing,
      trialDaysRemaining,
      canRead: true as const,
      canOperate: false,
      effectiveStatus: "suspended" as const,
      reason: "subscription_suspended" as const,
    };
  }

  return { ...billing, trialDaysRemaining };
}

export async function requireTenantOperationalAccess(tenantId: string) {
  const access = await getTenantOperationalAccess(tenantId);

  if (!access.canOperate) {
    if (access.reason === "trial_expired" || access.reason === "grace_expired") {
      const prisma = getPrismaClient();
      await prisma.$transaction(async (tx) => {
        const subscription = await tx.tenantSubscription.findFirst({
          where: { tenantId },
          orderBy: { startedAt: "desc" },
        });
        if (!subscription) return;

        const changed = await tx.tenantSubscription.updateMany({
          where: { id: subscription.id, status: subscription.status, suspendedAt: null },
          data: { status: "suspended", suspendedAt: new Date() },
        });
        if (changed.count === 0) return;

        await tx.auditLog.createMany({
          data: [
            ...(access.reason === "trial_expired"
              ? [{ tenantId, action: "trial_expired", entityType: "TenantSubscription", entityId: subscription.id }]
              : []),
            {
              tenantId,
              action: "subscription_suspended",
              entityType: "TenantSubscription",
              entityId: subscription.id,
              metadata: { reason: access.reason },
            },
          ],
        });
      });
    }
    throw new TenantOperationalAccessError(access);
  }

  return access;
}

export async function getTenantPlanUsage(tenantId: string) {
  const prisma = getPrismaClient();
  const [users, products, issuePoints, userLimit, productLimit, issuePointLimit] =
    await Promise.all([
      prisma.membership.count({ where: { tenantId, status: { in: ["active", "invited"] } } }),
      prisma.lightweightProduct.count({ where: { tenantId } }),
      prisma.sriIssuePoint.count({ where: { tenantId } }),
      getLimit(tenantId, "users"),
      getLimit(tenantId, "products"),
      getLimit(tenantId, "issuePoints"),
    ]);

  return {
    users: { current: users, limit: userLimit, exceeded: users > userLimit },
    products: { current: products, limit: productLimit, exceeded: products > productLimit },
    issuePoints: { current: issuePoints, limit: issuePointLimit, exceeded: issuePoints > issuePointLimit },
  };
}

export async function requireTenantUserCapacity(tenantId: string) {
  await requireTenantOperationalAccess(tenantId);
  const prisma = getPrismaClient();
  const [current, limit] = await Promise.all([
    prisma.membership.count({ where: { tenantId, status: { in: ["active", "invited"] } } }),
    getLimit(tenantId, "users"),
  ]);

  if (!isWithinPlanLimit(current, limit)) {
    throw new Error(`Alcanzaste el límite de ${limit} usuarios de tu plan.`);
  }
}

export function getOperationalAccessErrorResponse(error: unknown) {
  if (!(error instanceof TenantOperationalAccessError)) {
    return null;
  }

  return {
    status: error.status,
    body: {
      ok: false,
      code: error.code,
      message: error.message,
      href: error.href,
      access: error.access,
    },
  };
}
