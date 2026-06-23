import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { listErpProductPricings, upsertErpProductPricing } from "@/lib/core/erp-pricing";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalStringField(body: Record<string, unknown>, field: string) {
  const value = getStringField(body, field);
  return value || null;
}

function getOptionalNumberField(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;

    const itemCodesParam = new URL(request.url).searchParams.get("itemCodes");
    const itemCodes = itemCodesParam
      ? itemCodesParam
          .split(",")
          .map((itemCode) => itemCode.trim())
          .filter(Boolean)
      : undefined;

    const records = await listErpProductPricings(erpGuard.tenant.id, itemCodes);

    return NextResponse.json({
      success: true,
      data: {
        pricings: records,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron cargar los precios por canal";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_PRODUCT_PRICING_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Sesion requerida.",
          },
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const itemCode = getStringField(body, "itemCode");
    const itemName = getOptionalStringField(body, "itemName");
    const retailPrice = getOptionalNumberField(body, "retailPrice");
    const wholesalePrice = getOptionalNumberField(body, "wholesalePrice");
    const distributorPrice = getOptionalNumberField(body, "distributorPrice");
    const notes = getOptionalStringField(body, "notes");

    if (!itemCode || retailPrice == null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PRODUCT_PRICING_INPUT",
            message: "itemCode y retailPrice son requeridos.",
          },
        },
        { status: 400 }
      );
    }

    const pricing = await upsertErpProductPricing({
      actorUserId: user.id,
      tenantId: erpGuard.tenant.id,
      itemCode,
      itemName,
      retailPrice,
      wholesalePrice,
      distributorPrice,
      notes,
    });

    return NextResponse.json({
      success: true,
      data: {
        pricing: {
          id: pricing.id,
          itemCode: pricing.itemCode,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar el precio por canal";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_PRODUCT_PRICING_SAVE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
