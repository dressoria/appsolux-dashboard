import { NextResponse } from "next/server";
import {
  createErpnextCustomer,
  getErpnextCustomers,
} from "@/lib/api/erpnext/customers";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreateErpnextCustomerInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
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

    const customers = await getErpnextCustomers();

    return NextResponse.json({
      success: true,
      data: { customers },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext customers error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CUSTOMERS_ERROR",
          message,
        },
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
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const customerName = getStringField(body, "customer_name");
    const territory = getStringField(body, "territory");

    if (!customerName || !territory) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CUSTOMER_INPUT",
            message: "customer_name and territory are required",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateErpnextCustomerInput = {
      customer_name: customerName,
      customer_type: getStringField(body, "customer_type") || "Individual",
      territory,
    };
    const customer = await createErpnextCustomer(input);

    return NextResponse.json({
      success: true,
      data: { customer },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext customer error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_CUSTOMER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
