import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { TenantStatus } from "@prisma/client";

export type CreateCoreTenantInput = {
  name: string;
  slug: string;
  legalName?: string;
  country?: string;
  currency?: string;
  status?: TenantStatus;
  planKey?: string;
};

export async function createTenant(input: CreateCoreTenantInput) {
  const prisma = getPrismaClient();

  return prisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      legalName: input.legalName,
      country: input.country,
      currency: input.currency,
      status: input.status ?? "provisioning",
      planKey: input.planKey,
    },
  });
}

export async function findTenantBySlug(slug: string) {
  const prisma = getPrismaClient();

  return prisma.tenant.findUnique({
    where: { slug },
  });
}
