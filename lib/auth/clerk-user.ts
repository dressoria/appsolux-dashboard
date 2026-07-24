import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  getLoginUserByEmail,
  loginUserInclude,
  mapLoginUserToAppsoluxUser,
  type LoginUserRecord,
} from "@/lib/auth/persistent-user";
import type { AppsoluxUser } from "@/types/user";
import type { User } from "@prisma/client";

function maskEmail(email: string): string {
  const [localPart, domainPart] = email.toLowerCase().split("@");

  if (!localPart || !domainPart) {
    return "unknown";
  }

  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix || "*"}***@${domainPart}`;
}

function mapClerkUserWithoutTenant(user: Pick<User, "id" | "name" | "email">): AppsoluxUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "viewer",
    tenant: null,
  };
}

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

  if (!user || user.status === "disabled") {
    return null;
  }

  if (user.memberships.length === 0) {
    console.info("[auth][clerk] user resolved without tenant membership", {
      clerkUserId,
      userId: user.id,
      email: maskEmail(user.email),
      redirectTo: "/onboarding",
    });
    return mapClerkUserWithoutTenant(user);
  }

  console.info("[auth][clerk] user resolved with tenant membership", {
    clerkUserId,
    userId: user.id,
    email: maskEmail(user.email),
    tenantId: user.memberships[0]?.tenant.id ?? null,
  });
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

      const mapped = updated ? mapLoginUserToAppsoluxUser(updated as LoginUserRecord) : null;

      console.info("[auth][clerk] linked existing user by email", {
        clerkUserId: input.clerkUserId,
        userId: existing.id,
        email: maskEmail(input.email),
        tenantId: mapped?.tenant?.id ?? null,
        redirectTo: mapped?.tenant?.id ? null : "/onboarding",
      });

      return mapped;
    }

    const mapped = mapLoginUserToAppsoluxUser(existing);

    console.info("[auth][clerk] found existing user by email", {
      clerkUserId: input.clerkUserId,
      userId: existing.id,
      email: maskEmail(input.email),
      tenantId: mapped?.tenant?.id ?? null,
      redirectTo: mapped?.tenant?.id ? null : "/onboarding",
    });

    return mapped;
  }

  const created = await prisma.user.create({
    data: {
      name: input.name || input.email.split("@")[0],
      email: input.email,
      clerkUserId: input.clerkUserId,
      status: "active",
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    },
    include: loginUserInclude,
  });

  console.info("[auth][clerk] created new user without tenant membership", {
    clerkUserId: input.clerkUserId,
    userId: created.id,
    email: maskEmail(input.email),
    redirectTo: "/onboarding",
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

  await prisma.user.create({
    data: {
      name: input.name || input.email.split("@")[0],
      email: input.email,
      clerkUserId: input.clerkUserId,
      status: "active",
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    },
  });

  console.info("[auth][clerk] synced new user without tenant membership", {
    clerkUserId: input.clerkUserId,
    email: maskEmail(input.email),
    redirectTo: "/onboarding",
  });
}

export async function deactivateClerkUser(clerkUserId: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.user.updateMany({
    where: { clerkUserId },
    data: { status: "disabled" },
  });
}
