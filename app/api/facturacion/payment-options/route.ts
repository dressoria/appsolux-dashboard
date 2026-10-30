import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { accountBalance } from "@/lib/core/treasury/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
  }
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const accounts = await prisma.treasuryAccount.findMany({
    where: { tenantId: tenant.id, active: true },
    select: {
      id: true,
      name: true,
      type: true,
      bankName: true,
      provider: true,
      openingBalance: true,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const enriched = await Promise.all(
    accounts.map(async (account) => {
      let balance = "0";
      try {
        const bal = await accountBalance(prisma, tenant.id, account.id);
        balance = bal.toFixed(2);
      } catch {
        balance = Number(account.openingBalance).toFixed(2);
      }
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        bankName: account.bankName,
        provider: account.provider,
        balance,
      };
    }),
  );

  return NextResponse.json({ ok: true, accounts: enriched });
}
