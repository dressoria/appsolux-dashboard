import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  getLoginUserByEmail,
  loginUserInclude,
  mapLoginUserToAppsoluxUser,
  type LoginUserRecord,
} from "@/lib/auth/persistent-user";
import type { AppsoluxUser } from "@/types/user";

export type ClerkUserInput = {
  clerkUserId: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export async function findAppsoluxUserByClerkId(
  clerkUserId: string
): Promise<AppsoluxUser | null> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      memberships: {
        where: { status: "active" },
        include: {
          tenant: { include: { integrations: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user || user.status === "disabled" || user.memberships.length === 0) {
    return null;
  }

  return mapLoginUserToAppsoluxUser(user as LoginUserRecord);
}

export async function linkClerkUserIdToUser(input: {
  userId: string;
  clerkUserId: string;
}): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      clerkUserId: input.clerkUserId,
      status: "active",
    },
  });
}

export async function findOrCreateAppsoluxUserForClerk(
  input: ClerkUserInput
): Promise<AppsoluxUser | null> {
  const prisma = getPrismaClient();

  const existing = await getLoginUserByEmail(input.email);

  if (existing) {
    if (!existing.clerkUserId) {
      await linkClerkUserIdToUser({
        userId: existing.id,
        clerkUserId: input.clerkUserId,
      });

      const updated = await prisma.user.findUnique({
        where: { id: existing.id },
        include: loginUserInclude,
      });

      return updated ? mapLoginUserToAppsoluxUser(updated as LoginUserRecord) : null;
    }

    return mapLoginUserToAppsoluxUser(existing);
  }

  const tenant = await prisma.tenant.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });

  if (!tenant) {
    return null;
  }

  const created = await prisma.user.create({
    data: {
      name: input.name || input.email.split("@")[0],
      email: input.email,
      clerkUserId: input.clerkUserId,
      status: "active",
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      memberships: {
        create: {
          tenantId: tenant.id,
          role: "viewer",
          status: "active",
        },
      },
    },
    include: loginUserInclude,
  });

  return mapLoginUserToAppsoluxUser(created as LoginUserRecord);
}

export async function syncClerkUserToDb(input: ClerkUserInput): Promise<void> {
  const prisma = getPrismaClient();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { clerkUserId: input.clerkUserId },
        { email: input.email },
      ],
    },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        clerkUserId: input.clerkUserId,
        name: input.name || existing.name,
        emailVerifiedAt:
          input.emailVerified && !existing.emailVerifiedAt
            ? new Date()
            : existing.emailVerifiedAt,
        status: existing.status === "disabled" ? "disabled" : "active",
      },
    });

    return;
  }

  const tenant = await prisma.tenant.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });

  if (!tenant) {
    return;
  }

  await prisma.user.create({
    data: {
      name: input.name || input.email.split("@")[0],
      email: input.email,
      clerkUserId: input.clerkUserId,
      status: "active",
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      memberships: {
        create: {
          tenantId: tenant.id,
          role: "viewer",
          status: "active",
        },
      },
    },
  });
}

export async function deactivateClerkUser(clerkUserId: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.user.updateMany({
    where: { clerkUserId },
    data: { status: "disabled" },
  });
}
