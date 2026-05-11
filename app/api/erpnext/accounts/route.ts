import { NextResponse } from "next/server";
import {
  createErpnextAccount,
  createErpnextCashOrBankAccount,
  disableErpnextAccount,
  getCashAndBankAccounts,
  getErpnextAccounts,
  updateErpnextAccount,
} from "@/lib/api/erpnext/accounts";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
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

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);
    if (!tenantMode.erpProvisioning.isRealActive) {
      return NextResponse.json(
        { success: false, error: { code: "ERP_NOT_ACTIVE", message: "ERP dedicado no esta activo." } },
        { status: 400 }
      );
    }

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

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);
    if (!tenantMode.erpProvisioning.isRealActive) {
      return NextResponse.json(
        { success: false, error: { code: "ERP_NOT_ACTIVE", message: "ERP dedicado no esta activo." } },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const accountName = getStringField(body, "account_name");
    const company = getStringField(body, "company");
    const accountType = getStringField(body, "account_type");
    const rootType = getStringField(body, "root_type");
    const accountCurrency = getStringField(body, "account_currency");
    const parentAccount = getStringField(body, "parent_account");
    const mode = getStringField(body, "mode");

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

    if (mode !== "general" && accountType !== "Cash" && accountType !== "Bank") {
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

    const account =
      mode === "general"
        ? await createErpnextAccount({
            account_name: accountName,
            company,
            root_type: rootType || undefined,
            account_type: accountType || undefined,
            account_currency: accountCurrency || undefined,
            parent_account: parentAccount || undefined,
          })
        : await createErpnextCashOrBankAccount({
            account_name: accountName,
            company,
            account_type: accountType as "Cash" | "Bank",
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

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User session is required" } },
        { status: 401 }
      );
    }
    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);
    if (!tenantMode.erpProvisioning.isRealActive) {
      return NextResponse.json(
        { success: false, error: { code: "ERP_NOT_ACTIVE", message: "ERP dedicado no esta activo." } },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = getStringField(body, "name");
    const action = getStringField(body, "action");

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ACCOUNT", message: "Cuenta requerida." } },
        { status: 400 }
      );
    }

    const account =
      action === "disable"
        ? await disableErpnextAccount(name)
        : await updateErpnextAccount(name, {
            account_name: getStringField(body, "account_name") || undefined,
            account_type: getStringField(body, "account_type") || undefined,
            account_currency: getStringField(body, "account_currency") || undefined,
            parent_account: getStringField(body, "parent_account") || undefined,
          });

    return NextResponse.json({ success: true, data: { account } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar la cuenta";
    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_UPDATE_ACCOUNT_ERROR", message } },
      { status: 500 }
    );
  }
}
