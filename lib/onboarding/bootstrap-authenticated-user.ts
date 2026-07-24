import "@/lib/security/server-only";

import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";

type BootstrapAuthenticatedUserInput = {
  userId: string;
  email: string;
  name: string;
  companyName: string;
  ruc?: string;
  phone?: string;
  businessType?: string;
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

  if (input.ruc) {
    payload.ruc = input.ruc;
  }

  if (input.phone) {
    payload.phone = input.phone;
  }

  if (input.businessType) {
    payload.business_type = input.businessType;
  }

  return payload;
}

export async function bootstrapAuthenticatedUserTenant(
  input: BootstrapAuthenticatedUserInput
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
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

    const tenantSlug = await getUniqueTenantSlug(tx, input.companyName);
    const tenant = await tx.tenant.create({
      data: {
        name: input.companyName,
        slug: tenantSlug,
        legalName: input.companyName,
        country: "Ecuador",
        currency: "USD",
        status: "active",
        planKey: "free",
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
        planKey: "free",
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
