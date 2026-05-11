import { NextResponse } from "next/server";
import {
  requireActiveErpTenantForApi,
  resolveTenantErpCompany,
} from "@/lib/core/require-active-erp-tenant";
import { getCashAndBankAccounts } from "@/lib/api/erpnext/accounts";
import { updateModeOfPaymentAccountMapping } from "@/lib/api/erpnext/modes-of-payment";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type ModeAccountRouteContext = {
  params: Promise<{
    modeOfPayment: string;
  }>;
};

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  context: ModeAccountRouteContext
) {
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

    const { modeOfPayment } = await context.params;
    const decodedModeOfPayment = decodeURIComponent(modeOfPayment).trim();
    const body = (await request.json()) as Record<string, unknown>;
    const companyResult = await resolveTenantErpCompany(
      erpGuard,
      getStringField(body, "company")
    );
    if (!companyResult.ok) return companyResult.response;
    const company = companyResult.company;
    const account = getStringField(body, "account");

    if (!decodedModeOfPayment || !company || !account) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PAYMENT_ACCOUNT_MAPPING",
            message: "Metodo de pago, empresa y cuenta son requeridos.",
          },
        },
        { status: 400 }
      );
    }

    const accounts = await getCashAndBankAccounts(company);
    const selectedAccount = accounts.find(
      (erpAccount) => erpAccount.name === account
    );

    if (!selectedAccount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PAYMENT_ACCOUNT",
            message: "Selecciona una cuenta de caja o banco valida.",
          },
        },
        { status: 400 }
      );
    }

    const mapping = await updateModeOfPaymentAccountMapping(
      decodedModeOfPayment,
      company,
      account
    );

    return NextResponse.json({
      success: true,
      data: { mapping },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo asociar la cuenta al metodo de pago";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_PAYMENT_ACCOUNT_MAPPING_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
