import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { MembershipRole, MembershipStatus } from "@prisma/client";

export type CreateMembershipInput = {
  userId: string;
  tenantId: string;
  role: MembershipRole;
  status?: MembershipStatus;
};

export async function createMembership(input: CreateMembershipInput) {
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
