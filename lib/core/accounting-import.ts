import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { AccountingRootType, AccountingNormalBalance } from "@prisma/client";

type ImportRow = {
  code: string;
  name: string;
  rootType: AccountingRootType;
  normalBalance: AccountingNormalBalance;
  isGroup: boolean;
  f101Code?: string;
};

function inferRootType(code: string): AccountingRootType {
  const first = code.charAt(0);
  if (first === "1") return "ASSET";
  if (first === "2") return "LIABILITY";
  if (first === "3") return "EQUITY";
  if (first === "4") return "INCOME";
  return "COST_EXPENSE";
}

function inferNormalBalance(rootType: AccountingRootType): AccountingNormalBalance {
  if (rootType === "ASSET" || rootType === "COST_EXPENSE") return "DEBIT";
  return "CREDIT";
}

export function parseXlsxRows(
  rows: Array<{ code: string; name: string; f101Code?: string }>,
): ImportRow[] {
  return rows.map((row) => {
    const rootType = inferRootType(row.code);
    const normalBalance = inferNormalBalance(rootType);
    const dotCount = row.code.split(".").length - 1;
    return {
      code: row.code,
      name: row.name.trim(),
      rootType,
      normalBalance,
      isGroup: dotCount < 3,
      f101Code: row.f101Code,
    };
  });
}

function buildParentCode(code: string): string | null {
  const parts = code.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

export async function importAccountsFromParsedRows(
  tenantId: string,
  planId: string,
  rows: ImportRow[],
) {
  const prisma = getPrismaClient();

  const codeToId = new Map<string, string>();
  let created = 0;
  let skipped = 0;

  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code));

  for (const row of sorted) {
    const existing = await prisma.accountingAccount.findFirst({
      where: { tenantId, planId, code: row.code },
      select: { id: true },
    });

    if (existing) {
      codeToId.set(row.code, existing.id);
      skipped++;
      continue;
    }

    const parentCode = buildParentCode(row.code);
    const parentId = parentCode ? codeToId.get(parentCode) ?? null : null;

    const account = await prisma.accountingAccount.create({
      data: {
        tenantId,
        planId,
        code: row.code,
        name: row.name,
        parentId,
        level: row.code.split(".").length,
        rootType: row.rootType,
        normalBalance: row.normalBalance,
        isGroup: row.isGroup,
        allowsPosting: !row.isGroup,
        f101Code: row.f101Code ?? null,
      },
    });

    codeToId.set(row.code, account.id);
    created++;
  }

  return { created, skipped, total: rows.length };
}
