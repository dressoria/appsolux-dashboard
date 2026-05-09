import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function phoneSuffix(raw: string): string {
  return digitsOnly(raw).slice(-9);
}

function phonesMatch(a: string, b: string): boolean {
  const sa = phoneSuffix(a);
  const sb = phoneSuffix(b);
  return sa.length >= 7 && sa === sb;
}

export type CustomerSnap = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  balance: number;
};

export type SaleSnap = {
  id: string;
  total: number;
  paymentStatus: string;
  status: string;
  createdAt: Date;
};

export type CommerceSummary = {
  totalSales: number;
  totalPurchased: number;
  pendingBalance: number;
  lastSaleAt: Date | null;
  lastSaleId: string | null;
};

export type ConversationCommerceContext = {
  matchedCustomer: CustomerSnap | null;
  candidateCustomers: CustomerSnap[];
  summary: CommerceSummary | null;
  recentSales: SaleSnap[];
};

export async function getConversationCommerceContext(params: {
  tenantId: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}): Promise<ConversationCommerceContext> {
  const prisma = getPrismaClient();
  const { tenantId, contactName, contactPhone, contactEmail } = params;

  const normalizedEmail = contactEmail?.trim().toLowerCase() ?? null;
  const phoneDigits = contactPhone ? phoneSuffix(contactPhone) : null;

  let matchedCustomer: CustomerSnap | null = null;
  let candidateCustomers: CustomerSnap[] = [];

  // Search by phone or email
  if (phoneDigits || normalizedEmail) {
    const candidates = await prisma.lightweightCustomer.findMany({
      where: {
        tenantId,
        OR: [
          ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : []),
          ...(normalizedEmail
            ? [{ email: { equals: normalizedEmail, mode: "insensitive" as const } }]
            : []),
        ],
      },
      take: 10,
      select: { id: true, name: true, phone: true, email: true, balance: true },
    });

    // Precise JS-side validation
    const precise = candidates.filter((c) => {
      const emailMatch =
        normalizedEmail && c.email?.toLowerCase() === normalizedEmail;
      const phoneMatch =
        phoneDigits && c.phone ? phonesMatch(c.phone, contactPhone ?? "") : false;
      return emailMatch || phoneMatch;
    });

    if (precise.length === 1) {
      const c = precise[0];
      matchedCustomer = { ...c, balance: Number(c.balance) };
    } else if (precise.length > 1) {
      candidateCustomers = precise.map((c) => ({ ...c, balance: Number(c.balance) }));
    }
  }

  // Fallback: name search
  if (!matchedCustomer && candidateCustomers.length === 0 && contactName?.trim()) {
    const nameSearch = contactName.trim();
    if (nameSearch !== "Cliente") {
      const byName = await prisma.lightweightCustomer.findMany({
        where: {
          tenantId,
          name: { contains: nameSearch, mode: "insensitive" },
        },
        take: 5,
        select: { id: true, name: true, phone: true, email: true, balance: true },
      });
      candidateCustomers = byName.map((c) => ({ ...c, balance: Number(c.balance) }));
    }
  }

  // Sales data for matched customer
  let summary: CommerceSummary | null = null;
  let recentSales: SaleSnap[] = [];

  if (matchedCustomer) {
    const sales = await prisma.lightweightSale.findMany({
      where: {
        tenantId,
        customerId: matchedCustomer.id,
        status: { not: "canceled" },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        total: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
      },
    });

    const totalPurchased = sales.reduce((acc, s) => acc + Number(s.total), 0);
    const last = sales[0] ?? null;

    summary = {
      totalSales: sales.length,
      totalPurchased,
      pendingBalance: matchedCustomer.balance,
      lastSaleAt: last?.createdAt ?? null,
      lastSaleId: last?.id ?? null,
    };

    recentSales = sales.slice(0, 3).map((s) => ({
      id: s.id,
      total: Number(s.total),
      paymentStatus: s.paymentStatus,
      status: s.status,
      createdAt: s.createdAt,
    }));
  }

  return { matchedCustomer, candidateCustomers, summary, recentSales };
}
