import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser, AppsoluxUserRole } from "@/types/user";
import type {
  IntegrationProvider,
  MembershipRole,
  Prisma,
  Tenant,
  TenantIntegration,
  User,
} from "@prisma/client";

type MembershipWithTenant = {
  role: MembershipRole;
  tenant: Tenant & {
    integrations: TenantIntegration[];
  };
};

function mapRole(role: MembershipRole): AppsoluxUserRole {
  return role;
}

function getIntegration(
  tenant: MembershipWithTenant["tenant"],
  provider: IntegrationProvider
) {
  return tenant.integrations.find(
    (integration) =>
      integration.provider === provider && integration.status === "active"
  );
}

function mapTenant(tenant: MembershipWithTenant["tenant"]): AppsoluxTenant {
  const chatwootIntegration = getIntegration(tenant, "chatwoot");
  const erpnextIntegration = getIntegration(tenant, "erpnext");
  const evolutionIntegration = getIntegration(tenant, "evolution");
  const evolutionConfig =
    evolutionIntegration?.config && typeof evolutionIntegration.config === "object"
      ? (evolutionIntegration.config as Record<string, unknown>)
      : null;
  const evolutionStatus =
    typeof evolutionConfig?.connectionStatus === "string"
      ? evolutionConfig.connectionStatus
      : evolutionIntegration
        ? "pending"
        : "pending";

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    chatwoot_account_id: Number(chatwootIntegration?.externalAccountId ?? 0),
    erpnext_company_id: erpnextIntegration?.externalCompanyId ?? undefined,
    channels: {
      evolution: {
        enabled: Boolean(evolutionIntegration?.externalInstanceName),
        instance_name: evolutionIntegration?.externalInstanceName ?? undefined,
        status: evolutionIntegration
          ? evolutionStatus === "open"
            ? "connected"
            : "pending"
          : "pending",
      },
    },
    subscription: isSubscriptionPlan(tenant.planKey)
      ? {
          plan: tenant.planKey,
          status: "active",
        }
      : undefined,
  };
}

function isSubscriptionPlan(
  planKey: string | null
): planKey is NonNullable<AppsoluxTenant["subscription"]>["plan"] {
  return (
    planKey === "free" ||
    planKey === "starter" ||
    planKey === "pro" ||
    planKey === "enterprise"
  );
}

function mapUser(user: User, membership: MembershipWithTenant): AppsoluxUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: mapRole(membership.role),
    tenant: mapTenant(membership.tenant),
  };
}

function mapUserWithoutTenant(user: User): AppsoluxUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "viewer",
    tenant: null,
  };
}

export const loginUserInclude = {
  memberships: {
    where: { status: "active" },
    include: {
      tenant: {
        include: {
          integrations: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.UserInclude;

export type LoginUserRecord = Prisma.UserGetPayload<{
  include: typeof loginUserInclude;
}>;

export async function getPersistentUserFromSession(input: {
  userId: string;
  tenantId: string;
}): Promise<AppsoluxUser | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      memberships: {
        where: {
          tenantId: input.tenantId,
          status: "active",
        },
        include: {
          tenant: {
            include: {
              integrations: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!user || user.status !== "active" || user.memberships.length === 0) {
    return null;
  }

  return mapUser(user, user.memberships[0]);
}

export async function getLoginUserByEmail(email: string) {
  const prisma = getPrismaClient();

  return prisma.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
    include: loginUserInclude,
  });
}

export async function getLoginUserBySupabaseAuthUserId(supabaseAuthUserId: string) {
  const prisma = getPrismaClient();

  return prisma.user.findUnique({
    where: {
      supabaseAuthUserId,
    },
    include: loginUserInclude,
  });
}

export async function linkUserToSupabaseAuthUserId(input: {
  userId: string;
  supabaseAuthUserId: string;
}) {
  const prisma = getPrismaClient();

  return prisma.user.update({
    where: { id: input.userId },
    data: {
      supabaseAuthUserId: input.supabaseAuthUserId,
    },
    include: loginUserInclude,
  });
}

export function mapLoginUserToAppsoluxUser(
  user: LoginUserRecord
) {
  const membership = user.memberships[0];

  return membership ? mapUser(user, membership) : mapUserWithoutTenant(user);
}
