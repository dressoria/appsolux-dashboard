import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { OnboardingStatus, Prisma } from "@prisma/client";

export type CreateOnboardingRequestInput = {
  email: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  country?: string;
  currency?: string;
  planKey?: string;
  status?: OnboardingStatus;
  tenantId?: string;
  userId?: string;
  payload?: Prisma.InputJsonObject;
  lastError?: string;
};

export async function createOnboardingRequest(
  input: CreateOnboardingRequestInput
) {
  const prisma = getPrismaClient();

  return prisma.onboardingRequest.create({
    data: {
      email: input.email.toLowerCase(),
      companyName: input.companyName,
      contactName: input.contactName,
      phone: input.phone,
      country: input.country,
      currency: input.currency,
      planKey: input.planKey,
      status: input.status ?? "pending",
      tenantId: input.tenantId,
      userId: input.userId,
      payload: input.payload,
      lastError: input.lastError,
    },
  });
}

export async function updateOnboardingRequestStatus(
  id: string,
  status: OnboardingStatus,
  input: {
    tenantId?: string;
    userId?: string;
    lastError?: string | null;
  } = {}
) {
  const prisma = getPrismaClient();

  return prisma.onboardingRequest.update({
    where: { id },
    data: {
      status,
      tenantId: input.tenantId,
      userId: input.userId,
      lastError: input.lastError,
    },
  });
}
