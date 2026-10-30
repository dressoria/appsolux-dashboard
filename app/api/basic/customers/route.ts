import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createCustomer } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  validateTenantMembership,
  validateRelatedCustomer,
} from "@/lib/core/people-validation";

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function getEmails(body: Record<string, unknown>) {
  return Array.isArray(body.emails)
    ? body.emails.filter((value): value is string => typeof value === "string")
    : [];
}

function getStrings(body: Record<string, unknown>, key: string) {
  return Array.isArray(body[key])
    ? body[key].filter((value): value is string => typeof value === "string")
    : undefined;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 },
      );
    }

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;

    const assignedSellerId = getString(body, "assignedSellerId") || undefined;
    if (assignedSellerId) {
      await validateTenantMembership(tenant.id, assignedSellerId, "vendedor");
    }

    const relatedCustomerId =
      getString(body, "relatedCustomerId") || undefined;
    if (relatedCustomerId) {
      await validateRelatedCustomer(tenant.id, relatedCustomerId);
    }

    const invoiceThirdPartyCustomerId =
      getString(body, "invoiceThirdPartyCustomerId") || undefined;
    if (invoiceThirdPartyCustomerId) {
      await validateRelatedCustomer(tenant.id, invoiceThirdPartyCustomerId);
    }

    const customer = await createCustomer({
      tenantId: tenant.id,
      name: getString(body, "name"),
      tradeName: getString(body, "tradeName") || undefined,
      phone: getString(body, "phone") || undefined,
      phoneNumbers: getStrings(body, "phoneNumbers"),
      email: getEmails(body)[0] || getString(body, "email") || undefined,
      additionalEmails: getEmails(body).slice(1),
      address: getString(body, "address") || undefined,
      country: getString(body, "country") || "Ecuador",
      province: getString(body, "province") || undefined,
      city: getString(body, "city") || undefined,
      parish: getString(body, "parish") || undefined,
      sector: getString(body, "sector") || undefined,
      zone: getString(body, "zone") || undefined,
      customerType: getString(body, "customerType") || undefined,
      customerOrigin: getString(body, "customerOrigin") || undefined,
      groupName: getString(body, "groupName") || undefined,
      assignedSellerId,
      isRelated: body.isRelated === true,
      isForeign: body.isForeign === true,
      invoiceThirdParty: body.invoiceThirdParty === true,
      identificationType: (getString(body, "identificationType") ||
        null) as never,
      identification: getString(body, "identification") || undefined,
      taxpayerStatus: getString(body, "taxpayerStatus") || undefined,
      taxpayerLegalName: getString(body, "taxpayerLegalName") || undefined,
      taxpayerTradeName: getString(body, "taxpayerTradeName") || undefined,
      taxpayerType: getString(body, "taxpayerType") || undefined,
      economicActivity: getString(body, "economicActivity") || undefined,
      taxDataSource: getString(body, "taxDataSource") || undefined,
      taxDataQueriedAt: getString(body, "taxDataQueriedAt")
        ? new Date(getString(body, "taxDataQueriedAt"))
        : undefined,
      notes: getString(body, "notes") || undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      gender: getString(body, "gender") || undefined,
      relatedCustomerId,
      invoiceThirdPartyCustomerId,
    });

    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear cliente.",
      },
      { status: 400 },
    );
  }
}
