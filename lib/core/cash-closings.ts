import "@/lib/security/server-only";

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import type { ErpnextPaymentEntry } from "@/types/erpnext";

export type CashClosingSummary = {
  receivedTotal: number;
  supplierPaidTotal: number;
  netTotal: number;
  expectedCashAmount: number;
  expectedTransferAmount: number;
  expectedCardAmount: number;
  expectedOtherAmount: number;
  expectedTotalAmount: number;
  cancelledAmount: number;
  byMode: Array<{ mode: string; amount: number; count: number }>;
  receivedPayments: ErpnextPaymentEntry[];
  supplierPayments: ErpnextPaymentEntry[];
  cancelledPayments: ErpnextPaymentEntry[];
};

export type CreateCashClosingInput = {
  tenantId: string;
  userId: string;
  date: string;
  cashAccountName?: string;
  erpCompanyName?: string;
  countedCashAmount: number;
  notes?: string;
  summary: CashClosingSummary;
};

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function dateStringToUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function asAmount(payment: ErpnextPaymentEntry) {
  return payment.paid_amount ?? payment.received_amount ?? 0;
}

function isCashMode(payment: ErpnextPaymentEntry) {
  const mode = payment.mode_of_payment?.toLowerCase() ?? "";
  const paidTo = payment.paid_to?.toLowerCase() ?? "";
  const paidFrom = payment.paid_from?.toLowerCase() ?? "";

  return (
    mode.includes("cash") ||
    mode.includes("efectivo") ||
    paidTo.includes("cash") ||
    paidTo.includes("caja") ||
    paidFrom.includes("cash") ||
    paidFrom.includes("caja")
  );
}

function getModeBucket(mode: string) {
  const lowerMode = mode.toLowerCase();

  if (lowerMode.includes("cash") || lowerMode.includes("efectivo")) {
    return "cash";
  }

  if (
    lowerMode.includes("bank") ||
    lowerMode.includes("banco") ||
    lowerMode.includes("transfer")
  ) {
    return "transfer";
  }

  if (
    lowerMode.includes("card") ||
    lowerMode.includes("tarjeta") ||
    lowerMode.includes("credit") ||
    lowerMode.includes("debit")
  ) {
    return "card";
  }

  return "other";
}

export function buildCashClosingSummary(
  payments: ErpnextPaymentEntry[],
  date: string
): CashClosingSummary {
  const sameDayPayments = payments.filter((payment) => payment.posting_date === date);
  const receivedPayments = sameDayPayments.filter(
    (payment) => payment.payment_type === "Receive" && payment.docstatus === 1
  );
  const supplierPayments = sameDayPayments.filter(
    (payment) => payment.payment_type === "Pay" && payment.docstatus === 1
  );
  const cancelledPayments = sameDayPayments.filter((payment) => payment.docstatus === 2);

  const byModeMap = new Map<string, { amount: number; count: number }>();
  let expectedCashAmount = 0;
  let expectedTransferAmount = 0;
  let expectedCardAmount = 0;
  let expectedOtherAmount = 0;

  for (const payment of receivedPayments) {
    const amount = asAmount(payment);
    const mode = payment.mode_of_payment ?? "Sin metodo";
    const current = byModeMap.get(mode) ?? { amount: 0, count: 0 };
    byModeMap.set(mode, {
      amount: current.amount + amount,
      count: current.count + 1,
    });

    const bucket = getModeBucket(mode);
    if (bucket === "cash" || isCashMode(payment)) {
      expectedCashAmount += amount;
    } else if (bucket === "transfer") {
      expectedTransferAmount += amount;
    } else if (bucket === "card") {
      expectedCardAmount += amount;
    } else {
      expectedOtherAmount += amount;
    }
  }

  const receivedTotal = receivedPayments.reduce(
    (sum, payment) => sum + asAmount(payment),
    0
  );
  const supplierPaidTotal = supplierPayments.reduce(
    (sum, payment) => sum + asAmount(payment),
    0
  );
  const cancelledAmount = cancelledPayments.reduce(
    (sum, payment) => sum + asAmount(payment),
    0
  );

  return {
    receivedTotal,
    supplierPaidTotal,
    netTotal: receivedTotal - supplierPaidTotal,
    expectedCashAmount,
    expectedTransferAmount,
    expectedCardAmount,
    expectedOtherAmount,
    expectedTotalAmount: receivedTotal,
    cancelledAmount,
    byMode: Array.from(byModeMap.entries()).map(([mode, value]) => ({
      mode,
      ...value,
    })),
    receivedPayments,
    supplierPayments,
    cancelledPayments,
  };
}

export async function listCashClosings(tenantId: string, limit = 20) {
  const db = getPrismaClient();

  return db.cashClosing.findMany({
    where: { tenantId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getCashClosingForDate(tenantId: string, date: string) {
  const db = getPrismaClient();

  return db.cashClosing.findFirst({
    where: {
      tenantId,
      date: dateStringToUtcDate(date),
      status: "closed",
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function createCashClosing(input: CreateCashClosingInput) {
  const db = getPrismaClient();
  const differenceAmount =
    input.countedCashAmount - input.summary.expectedCashAmount;

  return db.cashClosing.create({
    data: {
      tenantId: input.tenantId,
      createdByUserId: input.userId,
      date: dateStringToUtcDate(input.date),
      cashAccountName: input.cashAccountName,
      erpCompanyName: input.erpCompanyName,
      expectedCashAmount: new Prisma.Decimal(input.summary.expectedCashAmount),
      expectedTransferAmount: new Prisma.Decimal(
        input.summary.expectedTransferAmount
      ),
      expectedCardAmount: new Prisma.Decimal(input.summary.expectedCardAmount),
      expectedOtherAmount: new Prisma.Decimal(input.summary.expectedOtherAmount),
      expectedTotalAmount: new Prisma.Decimal(input.summary.expectedTotalAmount),
      countedCashAmount: new Prisma.Decimal(input.countedCashAmount),
      differenceAmount: new Prisma.Decimal(differenceAmount),
      notes: input.notes,
      status: "closed",
    },
  });
}
