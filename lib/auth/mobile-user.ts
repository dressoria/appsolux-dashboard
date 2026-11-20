import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { getTenantPlanState } from "@/lib/core/plans";
import { getTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import {
  resolveEffectiveTenantAccessForTenant,
  type EffectiveTenantAccess,
} from "@/lib/core/tenant-features";
import type { MembershipRole } from "@prisma/client";

export type MobileTenantSummary = {
  id: string;
  name: string;
  slug: string;
  role: MembershipRole;
};

export type MobileUserProfile = {
  id: string;
  name: string;
  email: string;
  status: string;
  tenants: MobileTenantSummary[];
};

export type MobileSubscriptionState = {
  plan: string;
  planName: string;
  status: string;
  canOperate: boolean;
  trialDaysRemaining: number | null;
  currentPeriodEndsAt: string | null;
};

export type MobileTenantContext = {
  user: { id: string; name: string; email: string; role: MembershipRole };
  tenant: { id: string; name: string; slug: string };
  subscription: MobileSubscriptionState;
  access: Record<string, boolean>;
};

export async function getMobileUserProfile(
  clerkUserId: string,
): Promise<MobileUserProfile | null> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      memberships: {
        where: { status: "active" },
        include: {
          tenant: { select: { id: true, name: true, slug: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) return null;

  const tenants: MobileTenantSummary[] = user.memberships
    .filter((m) => m.tenant.status === "active" || m.tenant.status === "provisioning")
    .map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role,
    }));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    tenants,
  };
}

export async function resolveMobileTenantContext(
  clerkUserId: string,
  tenantId: string,
): Promise<
  | { ok: true; context: MobileTenantContext }
  | { ok: false; code: string; message: string; status: number }
> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, name: true, email: true, status: true },
  });

  if (!user || user.status === "disabled") {
    return { ok: false, code: "USER_DISABLED", message: "Usuario deshabilitado.", status: 403 };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      tenantId,
      status: "active",
    },
    include: {
      tenant: { select: { id: true, name: true, slug: true, status: true } },
    },
  });

  if (!membership) {
    return { ok: false, code: "NO_MEMBERSHIP", message: "No tienes membresía activa en esta empresa.", status: 403 };
  }

  if (membership.tenant.status === "suspended" || membership.tenant.status === "failed") {
    return { ok: false, code: "TENANT_SUSPENDED", message: "Esta empresa se encuentra suspendida.", status: 403 };
  }

  const planState = await getTenantPlanState(tenantId);

  let operationalAccessFailed = false;
  let effectiveAccessFailed = false;

  const [operationalAccess, effectiveAccess] = await Promise.all([
    getTenantOperationalAccess(tenantId).catch((err): null => {
      operationalAccessFailed = true;
      console.error("[mobile-auth] operational access check failed — denying operation", {
        tenantId,
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    }),
    resolveEffectiveTenantAccessForTenant({ tenantId }).catch(
      (err): EffectiveTenantAccess | null => {
        effectiveAccessFailed = true;
        console.error("[mobile-auth] effective access resolution failed — denying access", {
          tenantId,
          error: err instanceof Error ? err.message : "unknown",
        });
        return null;
      },
    ),
  ]);

  const accessResolutionFailed = operationalAccessFailed || effectiveAccessFailed || !effectiveAccess;
  const canOperate = !accessResolutionFailed && operationalAccess?.canOperate === true;

  const subscription: MobileSubscriptionState = {
    plan: planState.planKey,
    planName: planState.planName,
    status: accessResolutionFailed ? "error" : planState.status,
    canOperate,
    trialDaysRemaining: operationalAccess?.trialDaysRemaining ?? null,
    currentPeriodEndsAt: planState.currentPeriodEndsAt?.toISOString() ?? null,
  };

  const access: Record<string, boolean> = {};

  if (effectiveAccess) {
    for (const [key, value] of Object.entries(effectiveAccess.features)) {
      access[key] = value === true;
    }
  } else {
    // Preserve known keys as denials, never grant base-plan capabilities.
    for (const key of Object.keys(planState.features)) {
      access[key] = false;
    }
  }

  if (!subscription.canOperate) {
    for (const key of Object.keys(access)) {
      if (
        operationalAccess?.canRead !== true ||
        (key !== "sri_invoicing" && key !== "sri_configuration")
      ) {
        access[key] = false;
      }
    }
  }

  return {
    ok: true,
    context: {
      user: { id: user.id, name: user.name, email: user.email, role: membership.role },
      tenant: { id: membership.tenant.id, name: membership.tenant.name, slug: membership.tenant.slug },
      subscription,
      access,
    },
  };
}
