import "@/lib/security/server-only";

import { Prisma, TenantSubscriptionStatus } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getTenantPlanState, type PlanKey } from "@/lib/core/plans";
import type { AppsoluxTenant } from "@/types/tenant";

export const manualBillingPlanKeys = [
  "free",
  "trial",
  "pro",
  "enterprise",
] as const;
export const manualBillingStatuses = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "manual",
] as const;

export type ManualBillingPlanKey = (typeof manualBillingPlanKeys)[number];
export type ManualBillingStatus = (typeof manualBillingStatuses)[number];

export function isManualBillingPlanKey(
  value: unknown
): value is ManualBillingPlanKey {
  return typeof value === "string" && manualBillingPlanKeys.includes(value as ManualBillingPlanKey);
}

export function isManualBillingStatus(
  value: unknown
): value is ManualBillingStatus {
  return typeof value === "string" && manualBillingStatuses.includes(value as ManualBillingStatus);
}

function asAppTenant(input: {
  id: string;
  name: string;
  slug: string;
  integrations: Array<{
    provider: string;
    status: string;
    externalAccountId: string | null;
    externalCompanyId: string | null;
    externalSiteName: string | null;
    externalInstanceName: string | null;
    config: Prisma.JsonValue | null;
    lastError: string | null;
  }>;
}): AppsoluxTenant {
  const chatwoot = input.integrations.find((item) => item.provider === "chatwoot");
  const erpnext = input.integrations.find((item) => item.provider === "erpnext");
  const evolution = input.integrations.find((item) => item.provider === "evolution");

  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    chatwoot_account_id: Number(chatwoot?.externalAccountId ?? 0),
    erpnext_company_id: erpnext?.externalCompanyId ?? undefined,
    channels: {
      evolution: {
        enabled: Boolean(evolution?.externalInstanceName),
        instance_name: evolution?.externalInstanceName ?? undefined,
        status: evolution ? "pending" : "pending",
      },
    },
  };
}

export async function listTenantBillingStates() {
  const prisma = getPrismaClient();
  const tenants = await prisma.tenant.findMany({
    include: {
      integrations: true,
      memberships: {
        where: { role: "owner" },
        include: { user: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    tenants.map(async (tenant) => {
      const [plan, erp] = await Promise.all([
        getTenantPlanState(tenant.id),
        getErpProvisioningState(asAppTenant(tenant)),
      ]);

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        ownerEmail: tenant.memberships[0]?.user.email ?? null,
        planKey: plan.planKey,
        planName: plan.planName,
        status: plan.status,
        trialEndsAt: plan.trialEndsAt,
        currentPeriodEndsAt: plan.currentPeriodEndsAt,
        canRequestDedicatedErp: plan.canRequestDedicatedErp,
        erpStatus: erp.status,
        erpDisplayStatus: erp.displayStatus,
      };
    })
  );
}

export async function setTenantPlanManually(input: {
  actorUserId: string;
  tenantId: string;
  planKey: PlanKey;
  status: TenantSubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodEndsAt?: Date | null;
}) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({
      where: { key: input.planKey },
    });

    if (!plan) {
      throw new Error("Plan no encontrado. Ejecuta maintenance:ensure-plans.");
    }

    const current = await tx.tenantSubscription.findFirst({
      where: { tenantId: input.tenantId },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
    const subscription = current
      ? await tx.tenantSubscription.update({
          where: { id: current.id },
          data: {
            planId: plan.id,
            status: input.status,
            trialEndsAt: input.trialEndsAt,
            currentPeriodEndsAt: input.currentPeriodEndsAt,
          },
          include: { plan: true },
        })
      : await tx.tenantSubscription.create({
          data: {
            tenantId: input.tenantId,
            planId: plan.id,
            status: input.status,
            trialEndsAt: input.trialEndsAt,
            currentPeriodEndsAt: input.currentPeriodEndsAt,
          },
          include: { plan: true },
        });

    await tx.tenant.update({
      where: { id: input.tenantId },
      data: { planKey: input.planKey },
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.actorUserId,
        action: "tenant_subscription.manual_update",
        entityType: "TenantSubscription",
        entityId: subscription.id,
        metadata: {
          previousPlanKey: current?.plan.key ?? null,
          nextPlanKey: input.planKey,
          previousStatus: current?.status ?? null,
          nextStatus: input.status,
          trialEndsAt: input.trialEndsAt?.toISOString() ?? null,
          currentPeriodEndsAt: input.currentPeriodEndsAt?.toISOString() ?? null,
        },
      },
    });

    return subscription;
  });
}
