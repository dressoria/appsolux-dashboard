import { NextResponse } from "next/server";
import {
  createErpnextCashOrBankAccount,
  getCashAndBankAccounts,
  getErpnextAccounts,
} from "@/lib/api/erpnext/accounts";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET(request: Request) {
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

    await getCurrentTenant(user);

    const url = new URL(request.url);
    const company = url.searchParams.get("company")?.trim() || undefined;
    const type = url.searchParams.get("type")?.trim();
    const accounts =
      type === "cash-bank"
        ? await getCashAndBankAccounts(company)
        : await getErpnextAccounts(company);

    return NextResponse.json({
      success: true,
      data: { accounts },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron cargar cuentas";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_ACCOUNTS_ERROR",
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

    await getCurrentTenant(user);

    const body = (await request.json()) as Record<string, unknown>;
    const accountName = getStringField(body, "account_name");
    const company = getStringField(body, "company");
    const accountType = getStringField(body, "account_type");
    const accountCurrency = getStringField(body, "account_currency");
    const parentAccount = getStringField(body, "parent_account");

    if (!accountName || !company) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ACCOUNT_INPUT",
            message: "Nombre de cuenta y empresa son requeridos.",
          },
        },
        { status: 400 }
      );
    }

    if (accountType !== "Cash" && accountType !== "Bank") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ACCOUNT_TYPE",
            message: "Selecciona Caja / efectivo o Banco.",
          },
        },
        { status: 400 }
      );
    }

    const account = await createErpnextCashOrBankAccount({
      account_name: accountName,
      company,
      account_type: accountType,
      account_currency: accountCurrency || undefined,
      parent_account: parentAccount || undefined,
    });

    return NextResponse.json({
      success: true,
      data: { account },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cuenta";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_ACCOUNT_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
