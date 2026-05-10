import { NextResponse } from "next/server";
import {
  createErpnextSupplier,
  deleteErpnextSupplier,
  disableErpnextSupplier,
  getErpnextSuppliers,
} from "@/lib/api/erpnext/suppliers";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreateErpnextSupplierInput } from "@/types/erpnext";

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
          error: { code: "UNAUTHORIZED", message: "User session is required" },
        },
        { status: 401 }
      );
    }

    const suppliers = await getErpnextSuppliers();

    return NextResponse.json({ success: true, data: { suppliers } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERPNext suppliers error";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_SUPPLIERS_ERROR", message },
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

    const body = (await request.json()) as Record<string, unknown>;
    const supplierName = getStringField(body, "supplier_name");

    if (!supplierName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SUPPLIER_INPUT",
            message: "supplier_name is required",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateErpnextSupplierInput = {
      supplier_name: supplierName,
      supplier_type: getStringField(body, "supplier_type") || "Company",
      tax_id: getStringField(body, "tax_id") || undefined,
      mobile_no: getStringField(body, "mobile_no") || undefined,
      email_id: getStringField(body, "email_id") || undefined,
    };
    const supplier = await createErpnextSupplier(input);

    return NextResponse.json({ success: true, data: { supplier } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERPNext supplier error";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_CREATE_SUPPLIER_ERROR", message },
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
          error: { code: "UNAUTHORIZED", message: "User session is required" },
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
            code: "INVALID_SUPPLIER_DELETE_INPUT",
            message: "supplier name is required",
          },
        },
        { status: 400 }
      );
    }

    try {
      await deleteErpnextSupplier(name);

      return NextResponse.json({
        success: true,
        data: { action: "deleted", name },
      });
    } catch {
      const supplier = await disableErpnextSupplier(name);

      return NextResponse.json({
        success: true,
        data: { action: "disabled", supplier },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERP supplier delete";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_DELETE_SUPPLIER_ERROR", message },
      },
      { status: 500 }
    );
  }
}
