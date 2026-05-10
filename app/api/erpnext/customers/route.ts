import { NextResponse } from "next/server";
import {
  createErpnextCustomer,
  createErpnextCustomerAddress,
  deleteErpnextCustomer,
  disableErpnextCustomer,
  getErpnextCustomers,
  updateErpnextCustomer,
} from "@/lib/api/erpnext/customers";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreateErpnextCustomerInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function PUT(request: Request) {
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
    const name = getStringField(body, "name");
    const customerName = getStringField(body, "customer_name");
    const territory = getStringField(body, "territory");

    if (!name || !customerName || !territory) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CUSTOMER_UPDATE_INPUT",
            message: "name, customer_name and territory are required",
          },
        },
        { status: 400 }
      );
    }

    const customer = await updateErpnextCustomer(name, {
      customer_name: customerName,
      customer_type: getStringField(body, "customer_type") || "Individual",
      territory,
      tax_id: getStringField(body, "tax_id") || undefined,
      mobile_no: getStringField(body, "mobile_no") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: { customer },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERP customer update";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_UPDATE_CUSTOMER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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
    const name = getStringField(body, "name");

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CUSTOMER_DELETE_INPUT",
            message: "customer name is required",
          },
        },
        { status: 400 }
      );
    }

    try {
      await deleteErpnextCustomer(name);

      return NextResponse.json({
        success: true,
        data: { action: "deleted", name },
      });
    } catch {
      const customer = await disableErpnextCustomer(name);

      return NextResponse.json({
        success: true,
        data: { action: "disabled", customer },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERP customer delete";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_DELETE_CUSTOMER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
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
      tax_id: getStringField(body, "tax_id") || undefined,
      mobile_no: getStringField(body, "mobile_no") || undefined,
    };
    const customer = await createErpnextCustomer(input);

    const addressLine1 = getStringField(body, "address_line1");
    if (addressLine1) {
      try {
        await createErpnextCustomerAddress(customer.name, addressLine1);
      } catch {
        // address creation is best-effort; customer was already saved
      }
    }

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
