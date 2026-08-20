import "@/lib/security/server-only";

import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import type { TaxIdentificationType } from "@/lib/onboarding/ecuador-identification";
import { normalizeEcuadorIdentification } from "@/lib/onboarding/ecuador-identification";
import { canStartTrial } from "@/lib/core/billing-access-policy";

export class OnboardingCompanyAlreadyRegisteredError extends Error {
  readonly code = "COMPANY_ALREADY_REGISTERED";

  constructor() {
    super("Esta empresa ya está registrada en Facturom.");
  }
}

export class OnboardingTrialAlreadyConsumedError extends Error {
  readonly code = "TRIAL_ALREADY_CONSUMED";

  constructor() {
    super("Ya utilizaste una prueba gratuita. Usa tu empresa existente o elige un plan.");
  }
}

const TRIAL_DURATION_DAYS = 7;

type BootstrapAuthenticatedUserInput = {
  userId: string;
  email: string;
  name: string;
  companyName: string;
  legalName?: string;
  taxIdentificationType: TaxIdentificationType;
  taxIdentificationValue?: string;
  phone?: string;
  contactEmail?: string;
  province?: string;
  city?: string;
  address?: string;
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

function buildPayload(input: BootstrapAuthenticatedUserInput): Prisma.InputJsonObject {
  const payload: Record<string, Prisma.InputJsonValue> = {
    source: "clerk_authenticated_onboarding",
  };

  payload.tax_identification_type = input.taxIdentificationType;

  if (input.taxIdentificationValue) {
    payload.tax_identification_value = input.taxIdentificationValue;
  }

  if (input.phone) {
    payload.phone = input.phone;
  }

  if (input.contactEmail) payload.contact_email = input.contactEmail;
  if (input.province) payload.province = input.province;
  if (input.city) payload.city = input.city;
  if (input.address) payload.address = input.address;

  return payload;
}

export async function bootstrapAuthenticatedUserTenant(
  input: BootstrapAuthenticatedUserInput
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const normalizedTaxIdentification = input.taxIdentificationValue
      ? normalizeEcuadorIdentification(input.taxIdentificationValue)
      : undefined;
    const existingMembership = await tx.membership.findFirst({
      where: {
        userId: input.userId,
        status: "active",
      },
      include: {
        tenant: {
          include: {
            integrations: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (existingMembership) {
      return {
        tenantId: existingMembership.tenantId,
      };
    }

    const identity = await tx.user.findUnique({
      where: { id: input.userId },
      select: { trialConsumedAt: true, memberships: { where: { status: "active" }, select: { id: true } } },
    });

    if (!identity || !canStartTrial({
      trialConsumedAt: identity.trialConsumedAt,
      activeMemberships: identity.memberships.length,
    })) {
      throw new OnboardingTrialAlreadyConsumedError();
    }

    if (normalizedTaxIdentification) {
      const registeredCompany = await tx.tenant.findFirst({
        where: {
          OR: [
            { taxIdentificationNormalized: normalizedTaxIdentification },
            { taxIdentificationValue: normalizedTaxIdentification },
          ],
        },
        select: { id: true },
      });

      if (registeredCompany) {
        throw new OnboardingCompanyAlreadyRegisteredError();
      }
    }

    const trialPlan = await tx.plan.findUnique({ where: { key: "trial" } });
    if (!trialPlan) {
      throw new Error("El plan de prueba no está configurado.");
    }

    const tenantSlug = await getUniqueTenantSlug(tx, input.companyName);
    const tenant = await tx.tenant.create({
      data: {
        name: input.companyName,
        slug: tenantSlug,
        legalName: input.legalName,
        taxIdentificationType: input.taxIdentificationType,
        taxIdentificationValue: input.taxIdentificationValue,
        taxIdentificationNormalized: normalizedTaxIdentification,
        phone: input.phone,
        contactEmail: input.contactEmail,
        province: input.province,
        city: input.city,
        address: input.address,
        country: "Ecuador",
        currency: "USD",
        status: "active",
        planKey: "trial",
      },
      select: {
        id: true,
      },
    });

    await tx.membership.create({
      data: {
        userId: input.userId,
        tenantId: tenant.id,
        role: "owner",
        status: "active",
      },
    });

    const trialEndsAt = new Date(
      Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
    );
    const subscription = await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: trialPlan.id,
        status: "trialing",
        billingMode: "trial",
        trialEndsAt,
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: { trialConsumedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: input.userId,
        action: "trial_started",
        entityType: "TenantSubscription",
        entityId: subscription.id,
        metadata: { trialEndsAt: trialEndsAt.toISOString() },
      },
    });

    await tx.tenantOperationalConfig.create({
      data: {
        tenantId: tenant.id,
        operatingMode: "CORE",
        status: "active",
        businessSuiteStatus: "locked",
        sriEnabled: false,
        sharedErpEnabled: false,
        dedicatedErpEnabled: false,
      },
    });

    await tx.onboardingRequest.create({
      data: {
        email: input.email.toLowerCase(),
        companyName: input.companyName,
        contactName: input.name,
        phone: input.phone,
        country: "Ecuador",
        currency: "USD",
        planKey: "trial",
        status: "ready",
        tenantId: tenant.id,
        userId: input.userId,
        payload: buildPayload(input),
      },
    });

    console.info("[onboarding] created tenant for authenticated user", {
      userId: input.userId,
      email: input.email.includes("@")
        ? `${input.email.slice(0, 2)}***@${input.email.split("@")[1]}`
        : "unknown",
      tenantId: tenant.id,
      source: "clerk_authenticated_onboarding",
    });

    return {
      tenantId: tenant.id,
    };
  });
}
