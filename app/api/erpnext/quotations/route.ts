import { NextResponse } from "next/server";
import {
  createErpnextQuotation,
  getErpnextQuotations,
} from "@/lib/api/erpnext/quotations";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { CreateQuotationInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);

  return Number.NaN;
}

function getQuotationItems(body: Record<string, unknown>) {
  const items = body.items;

  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    return {
      item_code: getStringField(record, "item_code"),
      qty: getNumberField(record, "qty"),
      rate: getNumberField(record, "rate"),
      discount_percentage: getNumberField(record, "discount_percentage"),
    };
  });
}

async function requireActiveErp() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "User session is required" },
        },
        { status: 401 }
      ),
    };
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "ERP_NOT_ACTIVE",
            message: "El ERP dedicado debe estar activo para usar cotizaciones.",
          },
        },
        { status: 403 }
      ),
    };
  }

  return { error: null };
}

export async function GET() {
  try {
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const quotations = await getErpnextQuotations();

    return NextResponse.json({
      success: true,
      data: { quotations },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar las cotizaciones";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_QUOTATIONS_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const body = (await request.json()) as Record<string, unknown>;
    const customer = getStringField(body, "customer");
    const company = getStringField(body, "company");
    const transactionDate = getStringField(body, "transaction_date");
    const validTill = getStringField(body, "valid_till");
    const notes = getStringField(body, "notes");
    const items = getQuotationItems(body);

    if (!customer || !company || !transactionDate || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_QUOTATION_INPUT",
            message:
              "Cliente, empresa, fecha y al menos un producto son requeridos",
          },
        },
        { status: 400 }
      );
    }

    const invalidItem = items.find(
      (item) =>
        !item.item_code ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isFinite(item.rate) ||
        item.rate < 0 ||
        (!Number.isNaN(item.discount_percentage) &&
          (item.discount_percentage < 0 || item.discount_percentage > 100))
    );

    if (invalidItem) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_QUOTATION_ITEM",
            message:
              "Cada producto necesita codigo, cantidad mayor a 0, precio valido y descuento entre 0 y 100",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateQuotationInput = {
      customer,
      company,
      transaction_date: transactionDate,
      valid_till: validTill || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        item_code: item.item_code,
        qty: item.qty,
        rate: item.rate,
        discount_percentage: Number.isNaN(item.discount_percentage)
          ? undefined
          : item.discount_percentage,
      })),
    };
    const quotation = await createErpnextQuotation(input);

    return NextResponse.json({
      success: true,
      data: { quotation },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cotizacion";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_CREATE_QUOTATION_ERROR", message },
      },
      { status: 500 }
    );
  }
}
