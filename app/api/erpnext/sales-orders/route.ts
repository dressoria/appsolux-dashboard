import { NextResponse } from "next/server";
import {
  createErpnextSalesOrder,
  getErpnextSalesOrders,
} from "@/lib/api/erpnext/sales-orders";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { CreateSalesOrderInput } from "@/types/erpnext";

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

function getSalesOrderItems(body: Record<string, unknown>) {
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

    await getCurrentTenant(user);
    const salesOrders = await getErpnextSalesOrders();

    return NextResponse.json({
      success: true,
      data: { sales_orders: salesOrders },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar los pedidos";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_SALES_ORDERS_ERROR",
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

    await getCurrentTenant(user);

    const body = (await request.json()) as Record<string, unknown>;
    const customer = getStringField(body, "customer");
    const company = getStringField(body, "company");
    const warehouse = getStringField(body, "warehouse");
    const note = getStringField(body, "note");
    const items = getSalesOrderItems(body);

    if (!customer || !company || !warehouse || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SALES_ORDER_INPUT",
            message:
              "Cliente, empresa, bodega y al menos un producto son requeridos",
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
            code: "INVALID_SALES_ORDER_ITEM",
            message:
              "Cada producto necesita codigo, cantidad mayor a 0 y precio valido",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateSalesOrderInput = {
      customer,
      company,
      warehouse,
      items,
      note: note || undefined,
    };
    const salesOrder = await createErpnextSalesOrder(input);

    return NextResponse.json({
      success: true,
      data: {
        sales_order: {
          name: salesOrder.name,
          customer: salesOrder.customer,
          grand_total: salesOrder.grand_total,
          status: salesOrder.status,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el pedido";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_SALES_ORDER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
