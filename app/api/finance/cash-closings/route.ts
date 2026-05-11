import { NextResponse } from "next/server";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import {
  buildCashClosingSummary,
  createCashClosing,
  isIsoDate,
  listCashClosings,
} from "@/lib/core/cash-closings";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

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

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "User session is required" },
        },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const closings = await listCashClosings(tenant.id);

    return NextResponse.json({ success: true, data: { closings } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el historial de cierres.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "CASH_CLOSINGS_LIST_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "User session is required" },
        },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);

    if (!tenantMode.erpProvisioning.isRealActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ERP_NOT_ACTIVE",
            message: "ERP dedicado no esta activo.",
          },
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const date = getStringField(body, "date");
    const cashAccountName = getStringField(body, "cash_account_name");
    const notes = getStringField(body, "notes");
    const countedCashAmount = getNumberField(body, "counted_cash_amount");

    if (!date || !isIsoDate(date)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_DATE", message: "Fecha requerida." },
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(countedCashAmount) || countedCashAmount < 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_COUNTED_CASH",
            message: "El efectivo contado debe ser un monto valido.",
          },
        },
        { status: 400 }
      );
    }

    const paymentEntries = await getErpnextPaymentEntries();
    const summary = buildCashClosingSummary(paymentEntries, date);
    const erpCompanyName =
      summary.receivedPayments[0]?.company ?? summary.supplierPayments[0]?.company;

    const closing = await createCashClosing({
      tenantId: tenant.id,
      userId: user.id,
      date,
      cashAccountName: cashAccountName || undefined,
      erpCompanyName,
      countedCashAmount,
      notes: notes || undefined,
      summary,
    });

    return NextResponse.json({
      success: true,
      data: {
        closing: {
          id: closing.id,
          date: closing.date,
          expected_cash_amount: closing.expectedCashAmount,
          counted_cash_amount: closing.countedCashAmount,
          difference_amount: closing.differenceAmount,
          status: closing.status,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo registrar el cierre.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "CASH_CLOSING_CREATE_ERROR", message },
      },
      { status: 500 }
    );
  }
}
