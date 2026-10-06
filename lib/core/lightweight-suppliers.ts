import type {
  LightweightCustomerIdentificationType,
  Prisma,
} from "@prisma/client";

import { isValidEcuadorCedula, isValidEcuadorRuc } from "./ecuador-tax-id";
import { getPrismaClient } from "../db/prisma";
import { requireTenantOperationalAccess } from "./tenant-operational-access";

export type SupplierInput = {
  tenantId: string;
  supplierId?: string;
  identificationType?: LightweightCustomerIdentificationType | null;
  identification?: string;
  name?: string;
  tradeName?: string;
  email?: string;
  additionalEmails?: string[];
  phone?: string;
  phoneNumbers?: string[];
  address?: string;
  country?: string;
  province?: string;
  city?: string;
  parish?: string;
  sector?: string;
  zone?: string;
  supplierType?: string;
  supplierOrigin?: string;
  groupName?: string;
  assignedBuyerId?: string;
  isRelated?: boolean;
  isForeign?: boolean;
  taxpayerStatus?: string;
  taxpayerLegalName?: string;
  taxpayerTradeName?: string;
  taxpayerClass?: string;
  taxpayerType?: string;
  economicActivity?: string;
  ciiuCode?: string;
  accountingRequired?: boolean;
  specialTaxpayer?: boolean;
  withholdingAgent?: boolean;
  taxDataSource?: string;
  taxDataSourceUpdatedAt?: Date;
  taxDataQueriedAt?: Date;
  isActive?: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: string | undefined) => value?.trim() || null;

export function validateSupplierIdentification(
  type: LightweightCustomerIdentificationType | null | undefined,
  raw: string | undefined,
) {
  const identification = raw?.trim() ?? "";
  if (!type || !identification)
    throw new Error("Completa el tipo y la identificación fiscal.");
  if (type === "RUC" && !isValidEcuadorRuc(identification))
    throw new Error("El RUC no es válido.");
  if (type === "CEDULA" && !isValidEcuadorCedula(identification))
    throw new Error("La cédula no es válida.");
  return identification;
}

export function normalizeSupplierContacts(
  email: string | undefined,
  additionalEmails: string[] | undefined,
  phone: string | undefined,
  phoneNumbers: string[] | undefined,
) {
  const emails = [email, ...(additionalEmails ?? [])]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  const phones = [phone, ...(phoneNumbers ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (emails.length > 5) throw new Error("Puedes registrar máximo 5 correos.");
  if (phones.length > 3)
    throw new Error("Puedes registrar máximo 3 teléfonos.");
  if (
    new Set(emails).size !== emails.length ||
    emails.some((item) => !EMAIL_PATTERN.test(item))
  )
    throw new Error("Revisa los correos del proveedor.");
  if (new Set(phones).size !== phones.length)
    throw new Error("No repitas teléfonos dentro del mismo proveedor.");
  return { emails, phones };
}

function dataFromInput(
  input: SupplierInput,
): Prisma.LightweightSupplierUncheckedCreateInput {
  const name = input.name?.trim();
  if (!name) throw new Error("La razón social o nombre es requerido.");
  const identification = validateSupplierIdentification(
    input.identificationType,
    input.identification,
  );
  const { emails, phones } = normalizeSupplierContacts(
    input.email,
    input.additionalEmails,
    input.phone,
    input.phoneNumbers,
  );
  return {
    tenantId: input.tenantId,
    identificationType: input.identificationType,
    identification,
    name,
    tradeName: clean(input.tradeName),
    email: emails[0] ?? null,
    additionalEmails: emails.slice(1),
    phone: phones[0] ?? null,
    phoneNumbers: phones.slice(1),
    address: clean(input.address),
    country: input.country?.trim() || "Ecuador",
    province: clean(input.province),
    city: clean(input.city),
    parish: clean(input.parish),
    sector: clean(input.sector),
    zone: clean(input.zone),
    supplierType: clean(input.supplierType),
    supplierOrigin: clean(input.supplierOrigin),
    groupName: clean(input.groupName),
    assignedBuyerId: clean(input.assignedBuyerId),
    isRelated: input.isRelated ?? false,
    isForeign: input.isForeign ?? false,
    taxpayerStatus: clean(input.taxpayerStatus),
    taxpayerLegalName: clean(input.taxpayerLegalName),
    taxpayerTradeName: clean(input.taxpayerTradeName),
    taxpayerClass: clean(input.taxpayerClass),
    taxpayerType: clean(input.taxpayerType),
    economicActivity: clean(input.economicActivity),
    ciiuCode: clean(input.ciiuCode),
    accountingRequired: input.accountingRequired,
    specialTaxpayer: input.specialTaxpayer,
    withholdingAgent: input.withholdingAgent,
    taxDataSource: clean(input.taxDataSource),
    taxDataSourceUpdatedAt: input.taxDataSourceUpdatedAt,
    taxDataQueriedAt: input.taxDataQueriedAt,
    isActive: input.isActive ?? true,
  };
}

async function assertUnique(
  tenantId: string,
  identification: string,
  supplierId?: string,
) {
  const duplicate = await getPrismaClient().lightweightSupplier.findFirst({
    where: {
      tenantId,
      identification,
      ...(supplierId ? { id: { not: supplierId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate)
    throw new Error("Ya existe un proveedor con esta identificación.");
}

export async function createSupplier(input: SupplierInput) {
  await requireTenantOperationalAccess(input.tenantId);
  const data = dataFromInput(input);
  await assertUnique(input.tenantId, data.identification!);
  return getPrismaClient().lightweightSupplier.create({ data });
}

export async function updateSupplier(
  input: SupplierInput & { supplierId: string },
) {
  await requireTenantOperationalAccess(input.tenantId);
  const existing = await getPrismaClient().lightweightSupplier.findFirst({
    where: { id: input.supplierId, tenantId: input.tenantId },
  });
  if (!existing) throw new Error("Proveedor no encontrado.");
  const data = dataFromInput({
    ...(existing as unknown as SupplierInput),
    ...input,
    name: input.name ?? existing.name,
    identificationType: input.identificationType ?? existing.identificationType,
    identification:
      input.identification ?? existing.identification ?? undefined,
  });
  await assertUnique(input.tenantId, data.identification!, input.supplierId);
  const { tenantId: _tenantId, ...update } = data;
  return getPrismaClient().lightweightSupplier.update({
    where: { id: input.supplierId },
    data: update,
  });
}

export async function listSuppliers(tenantId: string, search?: string) {
  const query = search?.trim();
  return getPrismaClient().lightweightSupplier.findMany({
    where: {
      tenantId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { tradeName: { contains: query, mode: "insensitive" } },
              { identification: { contains: query } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
