import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  createErpnextModeOfPayment,
  getErpnextModesOfPayment,
} from "@/lib/api/erpnext/modes-of-payment";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
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
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    await getCurrentTenant(user);
    const modesOfPayment = await getErpnextModesOfPayment();

    return NextResponse.json({
      success: true,
      data: { modes_of_payment: modesOfPayment },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar los metodos de pago";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_MODES_OF_PAYMENT_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getBooleanField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "boolean" ? value : true;
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
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    await getCurrentTenant(user);

    const body = (await request.json()) as Record<string, unknown>;
    const modeOfPayment = getStringField(body, "mode_of_payment");
    const type = getStringField(body, "type");
    const enabled = getBooleanField(body, "enabled");

    if (!modeOfPayment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_MODE_OF_PAYMENT_INPUT",
            message: "El nombre del metodo de pago es requerido.",
          },
        },
        { status: 400 }
      );
    }

    const existingModes = await getErpnextModesOfPayment();
    const duplicateMode = existingModes.find(
      (mode) => mode.name.toLowerCase() === modeOfPayment.toLowerCase()
    );

    if (duplicateMode) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MODE_OF_PAYMENT_ALREADY_EXISTS",
            message: "Este metodo de pago ya existe.",
          },
        },
        { status: 400 }
      );
    }

    const createdModeOfPayment = await createErpnextModeOfPayment({
      mode_of_payment: modeOfPayment,
      type: type || undefined,
      enabled,
    });

    return NextResponse.json({
      success: true,
      data: { mode_of_payment: createdModeOfPayment },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo crear el metodo de pago";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_MODE_OF_PAYMENT_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
