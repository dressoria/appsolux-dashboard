import "@/lib/security/server-only";
import type { Prisma, TenantStatus } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import type { NormalizedOnboardingRequest } from "./types";

export class RegisterAccountError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export type RegisteredAccount = {
  userId: string;
  tenantId: string;
  onboardingRequestId: string;
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "empresa";
}

async function getUniqueTenantSlug(
  tx: Prisma.TransactionClient,
  companyName: string
) {
  const baseSlug = slugify(companyName);
  let candidate = baseSlug;
  let suffix = 2;

  while (await tx.tenant.findUnique({ where: { slug: candidate } })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function toSafeOnboardingPayload(
  request: NormalizedOnboardingRequest
): Prisma.InputJsonObject {
  const payload: Record<string, Prisma.InputJsonValue> = {
    user_name: request.user_name,
    email: request.email,
    company_name: request.company_name,
    country: request.country,
    source: request.source,
  };

  if (request.phone) {
    payload.phone = request.phone;
  }

  if (request.business_type) {
    payload.business_type = request.business_type;
  }

  if (request.base_currency) {
    payload.base_currency = request.base_currency;
  }

  if (request.initial_plan) {
    payload.initial_plan = request.initial_plan;
  }

  return payload;
}

export async function registerAccountFromOnboardingRequest(
  request: NormalizedOnboardingRequest
): Promise<RegisteredAccount> {
  const prisma = getPrismaClient();
  const passwordHash = await hashPassword(request.password);
  const tenantStatus: TenantStatus = "provisioning";

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: request.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new RegisterAccountError(
        "Ya existe una cuenta con este correo. Inicia sesion.",
        "EMAIL_ALREADY_EXISTS",
        409
      );
    }

    const tenantSlug = await getUniqueTenantSlug(tx, request.company_name);
    const user = await tx.user.create({
      data: {
        name: request.user_name,
        email: request.email,
        passwordHash,
        status: "active",
      },
      select: { id: true },
    });
    const tenant = await tx.tenant.create({
      data: {
        name: request.company_name,
        slug: tenantSlug,
        legalName: request.company_name,
        country: request.country,
        currency: request.base_currency ?? "USD",
        status: tenantStatus,
        planKey: request.initial_plan,
      },
      select: { id: true },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: "owner",
        status: "active",
      },
    });

    const onboardingRequest = await tx.onboardingRequest.create({
      data: {
        email: request.email,
        companyName: request.company_name,
        contactName: request.user_name,
        phone: request.phone,
        country: request.country,
        currency: request.base_currency,
        planKey: request.initial_plan,
        status: "provisioning",
        tenantId: tenant.id,
        userId: user.id,
        payload: toSafeOnboardingPayload(request),
      },
      select: { id: true },
    });

    return {
      userId: user.id,
      tenantId: tenant.id,
      onboardingRequestId: onboardingRequest.id,
    };
  });
}
