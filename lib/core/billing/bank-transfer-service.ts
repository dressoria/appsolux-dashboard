import "@/lib/security/server-only";

import { Prisma, type BankTransferRequestStatus } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { commercialPlans, type CommercialPlanCode } from "./commercial-plans";
import { calculateRenewalPeriod } from "./subscription-periods";
import { registerPendingInvoice } from "./commercial-invoicing";

function getCommercialPlanPrice(
  planCode: CommercialPlanCode,
  billingInterval: "MONTHLY" | "YEARLY",
): number {
  const plan = commercialPlans.find((p) => p.code === planCode);
  if (!plan) throw new Error(`Plan comercial desconocido: ${planCode}.`);
  return billingInterval === "MONTHLY" ? plan.monthly : plan.yearly;
}

function getBankAccountConfig() {
  const accountNumber = process.env.BILLING_BANK_ACCOUNT_NUMBER?.trim();
  if (!accountNumber) {
    throw new Error("BILLING_BANK_ACCOUNT_NUMBER no está configurado. Las transferencias bancarias no están disponibles.");
  }
  return { accountNumber };
}

export function getBankTransferInfo(planCode: CommercialPlanCode, billingInterval: "MONTHLY" | "YEARLY") {
  const plan = commercialPlans.find((p) => p.code === planCode);
  if (!plan) throw new Error(`Plan comercial desconocido: ${planCode}.`);

  const amount = getCommercialPlanPrice(planCode, billingInterval);
  const bank = getBankAccountConfig();

  return {
    planDisplayName: plan.displayName,
    planCode,
    billingInterval,
    amount,
    currency: "USD",
    accountNumber: bank.accountNumber,
  };
}

export async function createBankTransferRequest(input: {
  tenantId: string;
  requestedById: string;
  planCode: CommercialPlanCode;
  billingInterval: "MONTHLY" | "YEARLY";
  bankReference: string;
  receiptFileId: string;
  receiptFileName: string;
  receiptFileType: string;
  receiptFileSizeBytes: number;
}) {
  const prisma = getPrismaClient();
  const amount = getCommercialPlanPrice(input.planCode, input.billingInterval);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.bankTransferRequest.findFirst({
      where: {
        tenantId: input.tenantId,
        status: "PENDING_REVIEW",
      },
    });

    if (existing) {
      throw new Error("Ya existe una solicitud de transferencia pendiente de revisión para tu empresa.");
    }

    const existingRef = await tx.bankTransferRequest.findFirst({
      where: { bankReference: input.bankReference },
    });

    if (existingRef) {
      throw new Error("Esta referencia bancaria ya fue utilizada en otra solicitud.");
    }

    const request = await tx.bankTransferRequest.create({
      data: {
        tenantId: input.tenantId,
        requestedById: input.requestedById,
        planCode: input.planCode,
        billingInterval: input.billingInterval,
        amountUsd: new Prisma.Decimal(amount),
        bankReference: input.bankReference,
        receiptFileId: input.receiptFileId,
        receiptFileName: input.receiptFileName,
        receiptFileType: input.receiptFileType,
        receiptFileSizeBytes: input.receiptFileSizeBytes,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.requestedById,
        action: "bank_transfer.requested",
        entityType: "BankTransferRequest",
        entityId: request.id,
        metadata: {
          planCode: input.planCode,
          billingInterval: input.billingInterval,
          amountUsd: amount,
          bankReference: input.bankReference,
        },
      },
    });

    return request;
  });
}

export async function getTenantTransferRequests(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.bankTransferRequest.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      planCode: true,
      billingInterval: true,
      amountUsd: true,
      currency: true,
      bankReference: true,
      status: true,
      adminNote: true,
      subscriptionStartsAt: true,
      subscriptionEndsAt: true,
      createdAt: true,
      reviewedAt: true,
    },
  });
}

export async function listAllTransferRequests(filters?: {
  status?: BankTransferRequestStatus;
  search?: string;
}) {
  const prisma = getPrismaClient();
  const where: Prisma.BankTransferRequestWhereInput = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.search) {
    const search = filters.search.trim();
    if (search) {
      where.OR = [
        { bankReference: { contains: search, mode: "insensitive" } },
        { tenant: { name: { contains: search, mode: "insensitive" } } },
        { requestedBy: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
  }

  return prisma.bankTransferRequest.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      requestedBy: { select: { id: true, email: true, name: true } },
      reviewedBy: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function approveBankTransfer(input: {
  requestId: string;
  adminUserId: string;
  adminNote?: string;
}) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bankTransferRequest.updateMany({
      where: { id: input.requestId, status: "PENDING_REVIEW" },
      data: {
        status: "APPROVED",
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        adminNote: input.adminNote?.trim() || null,
      },
    });

    if (updated.count === 0) {
      throw new Error("Esta solicitud ya fue procesada o no existe.");
    }

    const request = await tx.bankTransferRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });

    const plan = await tx.plan.findFirst({
      where: {
        key: request.planCode === "BASIC"
          ? "free"
          : request.planCode === "BUSINESS"
            ? "pro"
            : "enterprise",
      },
    });

    if (!plan) {
      await tx.bankTransferRequest.update({
        where: { id: input.requestId },
        data: { status: "ACTIVATION_FAILED", adminNote: "Plan local no encontrado." },
      });
      throw new Error("Plan local no configurado. La activación falló.");
    }

    const currentSubscription = await tx.tenantSubscription.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { startedAt: "desc" },
    });

    if (
      currentSubscription &&
      currentSubscription.billingMode === "paddle" &&
      currentSubscription.status === "active"
    ) {
      await tx.bankTransferRequest.update({
        where: { id: input.requestId },
        data: { status: "PENDING_REVIEW" },
      });
      throw new Error(
        "Este tenant tiene una suscripción Paddle activa. "
        + "Para aprobar esta transferencia, la suscripción Paddle debe estar efectivamente "
        + "cancelada (status: canceled) — una cancelación programada (cancelAtPeriodEnd) no "
        + "es suficiente porque Paddle sigue cobrando hasta el fin del período.",
      );
    }

    const period = calculateRenewalPeriod(
      currentSubscription?.currentPeriodEndsAt,
      request.billingInterval,
    );

    const providerMetadataForTransition = currentSubscription?.providerSubscriptionId
      ? {
          previousPaddleSubscriptionId: currentSubscription.providerSubscriptionId,
          previousPaddlePriceId: currentSubscription.providerPriceId,
          previousPaddleCustomerId: currentSubscription.providerCustomerId,
          transitionedAt: new Date().toISOString(),
          transitionReason: "bank_transfer_approved",
        }
      : currentSubscription?.providerMetadata ?? undefined;

    const subscription = currentSubscription
      ? await tx.tenantSubscription.update({
          where: { id: currentSubscription.id },
          data: {
            planId: plan.id,
            status: "active",
            billingMode: "manual",
            billingInterval: request.billingInterval,
            currentPeriodStartsAt: period.startsAt,
            currentPeriodEndsAt: period.endsAt,
            graceEndsAt: null,
            suspendedAt: null,
            providerSubscriptionId: null,
            providerPriceId: null,
            providerMetadata: providerMetadataForTransition ?? undefined,
          },
        })
      : await tx.tenantSubscription.create({
          data: {
            tenantId: request.tenantId,
            planId: plan.id,
            status: "active",
            billingMode: "manual",
            billingInterval: request.billingInterval,
            currentPeriodStartsAt: period.startsAt,
            currentPeriodEndsAt: period.endsAt,
          },
        });

    await tx.tenant.update({
      where: { id: request.tenantId },
      data: { planKey: plan.key },
    });

    await tx.bankTransferRequest.update({
      where: { id: input.requestId },
      data: {
        activatedSubscriptionId: subscription.id,
        subscriptionStartsAt: period.startsAt,
        subscriptionEndsAt: period.endsAt,
      },
    });

    await tx.auditLog.createMany({
      data: [
        {
          tenantId: request.tenantId,
          userId: input.adminUserId,
          action: "bank_transfer.approved",
          entityType: "BankTransferRequest",
          entityId: request.id,
          metadata: {
            planCode: request.planCode,
            billingInterval: request.billingInterval,
            amountUsd: request.amountUsd.toString(),
            subscriptionId: subscription.id,
            periodStart: period.startsAt.toISOString(),
            periodEnd: period.endsAt.toISOString(),
          },
        },
        {
          tenantId: request.tenantId,
          userId: input.adminUserId,
          action: "subscription_activated",
          entityType: "TenantSubscription",
          entityId: subscription.id,
          metadata: {
            source: "bank_transfer",
            billingMode: "manual",
            bankTransferRequestId: request.id,
            previousProviderSubscriptionId: currentSubscription?.providerSubscriptionId ?? null,
            previousProviderCustomerId: currentSubscription?.providerCustomerId ?? null,
          },
        },
      ],
    });

    await registerPendingInvoice({
      bankTransferRequestId: request.id,
      tenantId: request.tenantId,
      planCode: request.planCode,
      amountUsd: Number(request.amountUsd),
      currency: request.currency,
      billingInterval: request.billingInterval,
    });

    return { subscription, period };
  });
}

export async function rejectBankTransfer(input: {
  requestId: string;
  adminUserId: string;
  adminNote: string;
}) {
  if (!input.adminNote.trim()) {
    throw new Error("Debe proporcionar un motivo para el rechazo.");
  }

  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bankTransferRequest.updateMany({
      where: { id: input.requestId, status: "PENDING_REVIEW" },
      data: {
        status: "REJECTED",
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        adminNote: input.adminNote.trim(),
      },
    });

    if (updated.count === 0) {
      throw new Error("Esta solicitud ya fue procesada o no existe.");
    }

    const request = await tx.bankTransferRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });

    await tx.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: input.adminUserId,
        action: "bank_transfer.rejected",
        entityType: "BankTransferRequest",
        entityId: request.id,
        metadata: {
          planCode: request.planCode,
          billingInterval: request.billingInterval,
          adminNote: input.adminNote.trim(),
        },
      },
    });

    return request;
  });
}
