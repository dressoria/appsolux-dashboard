import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { AccountingRootType, AccountingNormalBalance } from "@prisma/client";

export type CreateAccountInput = {
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  rootType: AccountingRootType;
  normalBalance: AccountingNormalBalance;
  isGroup?: boolean;
  allowsPosting?: boolean;
  f101Code?: string;
};

export async function getAccountTree(tenantId: string, planId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingAccount.findMany({
    where: { tenantId, planId, active: true },
    orderBy: { code: "asc" },
  });
}

export async function getAccountById(tenantId: string, accountId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingAccount.findFirst({
    where: { id: accountId, tenantId },
  });
}

export async function getPostableAccounts(tenantId: string, planId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingAccount.findMany({
    where: { tenantId, planId, allowsPosting: true, active: true },
    orderBy: { code: "asc" },
  });
}

function computeLevel(code: string): number {
  const parts = code.split(".");
  return parts.length;
}

export async function createAccount(
  tenantId: string,
  planId: string,
  data: CreateAccountInput,
) {
  const prisma = getPrismaClient();
  return prisma.accountingAccount.create({
    data: {
      tenantId,
      planId,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      level: computeLevel(data.code),
      rootType: data.rootType,
      normalBalance: data.normalBalance,
      isGroup: data.isGroup ?? false,
      allowsPosting: data.allowsPosting ?? true,
      f101Code: data.f101Code ?? null,
    },
  });
}

export async function updateAccount(
  tenantId: string,
  accountId: string,
  data: Partial<Pick<CreateAccountInput, "name" | "description" | "allowsPosting" | "f101Code" | "isGroup">>,
) {
  const prisma = getPrismaClient();
  return prisma.accountingAccount.update({
    where: { id: accountId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.allowsPosting !== undefined && { allowsPosting: data.allowsPosting }),
      ...(data.f101Code !== undefined && { f101Code: data.f101Code }),
      ...(data.isGroup !== undefined && { isGroup: data.isGroup }),
    },
  });
}

export async function deactivateAccount(tenantId: string, accountId: string) {
  const prisma = getPrismaClient();

  const hasLines = await prisma.accountingJournalLine.findFirst({
    where: { accountId, tenantId },
    select: { id: true },
  });
  if (hasLines) {
    throw new Error("No se puede desactivar una cuenta con movimientos contables");
  }

  return prisma.accountingAccount.update({
    where: { id: accountId },
    data: { active: false },
  });
}

export async function searchAccounts(
  tenantId: string,
  planId: string,
  query: string,
) {
  const prisma = getPrismaClient();
  return prisma.accountingAccount.findMany({
    where: {
      tenantId,
      planId,
      active: true,
      OR: [
        { code: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { code: "asc" },
    take: 50,
  });
}
