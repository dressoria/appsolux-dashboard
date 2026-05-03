import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { UserStatus } from "@prisma/client";

export type CreateCoreUserInput = {
  name: string;
  email: string;
  passwordHash?: string;
  status?: UserStatus;
  emailVerifiedAt?: Date;
};

export async function createUser(input: CreateCoreUserInput) {
  const prisma = getPrismaClient();

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      status: input.status ?? "invited",
      emailVerifiedAt: input.emailVerifiedAt,
    },
  });
}

export async function findUserByEmail(email: string) {
  const prisma = getPrismaClient();

  return prisma.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
  });
}
