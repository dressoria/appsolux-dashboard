import { NextResponse } from "next/server";
import {
  createErpnextWarehouse,
  deleteErpnextWarehouse,
  disableErpnextWarehouse,
  getErpnextWarehouses,
  updateErpnextWarehouse,
} from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

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

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const name = getStringField(body, "name");
    const warehouseName = getStringField(body, "warehouse_name");
    const company = getStringField(body, "company") || tenant.erpnext_company_id;

    if (!name || !warehouseName || !company) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_WAREHOUSE_UPDATE_INPUT",
            message: "name, warehouse_name and company are required",
          },
        },
        { status: 400 }
      );
    }

    const warehouse = await updateErpnextWarehouse(name, {
      warehouse_name: warehouseName,
      company,
    });

    return NextResponse.json({
      success: true,
      data: { warehouse },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERP warehouse update";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_UPDATE_WAREHOUSE_ERROR",
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

    const warehouses = await getErpnextWarehouses();

    return NextResponse.json({
      success: true,
      data: { warehouses },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext warehouses error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_WAREHOUSES_ERROR",
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
            code: "INVALID_WAREHOUSE_DELETE_INPUT",
            message: "warehouse name is required",
          },
        },
        { status: 400 }
      );
    }

    try {
      await deleteErpnextWarehouse(name);

      return NextResponse.json({
        success: true,
        data: {
          action: "deleted",
          name,
        },
      });
    } catch {
      const warehouse = await disableErpnextWarehouse(name);

      return NextResponse.json({
        success: true,
        data: {
          action: "disabled",
          warehouse,
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERP warehouse delete error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_DELETE_WAREHOUSE_ERROR",
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

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const warehouseName = getStringField(body, "warehouse_name");
    const company = getStringField(body, "company") || tenant.erpnext_company_id;

    if (!warehouseName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_WAREHOUSE_INPUT",
            message: "warehouse_name is required",
          },
        },
        { status: 400 }
      );
    }

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_ERPNEXT_COMPANY",
            message:
              "ERPNext company must be configured before creating a warehouse",
          },
        },
        { status: 400 }
      );
    }

    const warehouse = await createErpnextWarehouse({
      warehouse_name: warehouseName,
      company,
    });

    return NextResponse.json({
      success: true,
      data: { warehouse },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext warehouse error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_WAREHOUSE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
