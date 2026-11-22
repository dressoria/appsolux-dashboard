import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { MembershipRole, MembershipStatus } from "@prisma/client";
import { checkPlanLimit } from "./plan-limits";

export type CreateMembershipInput = {
  userId: string;
  tenantId: string;
  role: MembershipRole;
  status?: MembershipStatus;
};

export class PlanLimitError extends Error {
  readonly status = 403;
  readonly code = "PLAN_LIMIT_REACHED";
  constructor(message: string, readonly current: number, readonly limit: number) {
    super(message);
  }
}

export async function createMembership(input: CreateMembershipInput) {
  if (input.status === "active" || input.status === undefined) {
    const limitCheck = await checkPlanLimit(input.tenantId, "users");
    if (!limitCheck.allowed) {
      throw new PlanLimitError(
        `Has alcanzado el límite de usuarios de tu plan (${limitCheck.current}/${limitCheck.limit}). Mejora tu plan para agregar más usuarios.`,
        limitCheck.current,
        limitCheck.limit,
      );
    }
  }

  const prisma = getPrismaClient();

  return prisma.membership.create({
    data: {
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      status: input.status ?? "active",
    },
  });
}

export async function getUserMemberships(userId: string) {
  const prisma = getPrismaClient();

  return prisma.membership.findMany({
    where: { userId, status: "active" },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getTenantMemberships(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.membership.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}
