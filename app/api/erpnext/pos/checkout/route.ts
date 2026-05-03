import { NextResponse } from "next/server";
import { createErpnextPosCheckout } from "@/lib/api/erpnext/pos-checkout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { PosCheckoutInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }

  return Number.NaN;
}

function getCheckoutItems(body: Record<string, unknown>) {
  const items = body.items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    return {
      item_code: getStringField(record, "item_code"),
      qty: getNumberField(record, "qty"),
      rate: getNumberField(record, "rate"),
      warehouse: getStringField(record, "warehouse") || undefined,
    };
  });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);

    const body = (await request.json()) as Record<string, unknown>;
    const customer = getStringField(body, "customer");
    const requestedCompany = getStringField(body, "company");
    const company = tenant.erpnext_company_id ?? requestedCompany;
    const warehouse = getStringField(body, "warehouse");
    const modeOfPayment = getStringField(body, "mode_of_payment");
    const paidAmount = getNumberField(body, "paid_amount");
    const note = getStringField(body, "note");
    const referenceNo = getStringField(body, "reference_no");
    const referenceDate = getStringField(body, "reference_date");
    const items = getCheckoutItems(body);

    if (
      !customer ||
      !company ||
      !warehouse ||
      !modeOfPayment ||
      !Number.isFinite(paidAmount) ||
      paidAmount <= 0 ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_POS_CHECKOUT_INPUT",
            message:
              "Cliente, empresa, bodega, metodo de pago, monto y productos son requeridos",
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
        item.rate < 0
    );

    if (invalidItem) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_POS_CHECKOUT_ITEM",
            message:
              "Cada producto necesita codigo, cantidad mayor a 0 y precio valido",
          },
        },
        { status: 400 }
      );
    }

    const input: PosCheckoutInput = {
      customer,
      company,
      warehouse,
      mode_of_payment: modeOfPayment,
      paid_amount: paidAmount,
      items,
      note: note || undefined,
      reference_no: referenceNo || undefined,
      reference_date: referenceDate || undefined,
    };
    const checkout = await createErpnextPosCheckout(input);

    return NextResponse.json({
      success: true,
      data: checkout,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo finalizar la venta";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_POS_CHECKOUT_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
