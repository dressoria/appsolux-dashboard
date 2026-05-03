import { NextResponse } from "next/server";
import {
  deleteErpnextSalesInvoiceDraft,
  getErpnextSalesInvoiceDetail,
  updateErpnextSalesInvoiceDraft,
} from "@/lib/api/erpnext/sales-invoices";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { UpdateSalesInvoiceDraftInput } from "@/types/erpnext";

type SalesInvoiceRouteContext = {
  params: Promise<{
    salesInvoiceName: string;
  }>;
};

async function getAuthorizedInvoiceName(context: SalesInvoiceRouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      ),
    };
  }

  await getCurrentTenant(user);

  const { salesInvoiceName } = await context.params;
  const decodedName = decodeURIComponent(salesInvoiceName).trim();

  if (!decodedName) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SALES_INVOICE_NAME",
            message: "El numero de factura es requerido",
          },
        },
        { status: 400 }
      ),
    };
  }

  return { name: decodedName };
}

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

function getDraftItems(body: Record<string, unknown>) {
  const items = body.items;

  if (!Array.isArray(items)) {
    return undefined;
  }

  return items.map((item) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    return {
      name: getStringField(record, "name") || undefined,
      item_code: getStringField(record, "item_code"),
      qty: getNumberField(record, "qty"),
      rate: getNumberField(record, "rate"),
      warehouse: getStringField(record, "warehouse") || undefined,
    };
  });
}

export async function GET(_request: Request, context: SalesInvoiceRouteContext) {
  try {
    const resolved = await getAuthorizedInvoiceName(context);

    if (resolved.error) {
      return resolved.error;
    }

    const salesInvoice = await getErpnextSalesInvoiceDetail(resolved.name);

    return NextResponse.json({
      success: true,
      data: { sales_invoice: salesInvoice },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el detalle de la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_SALES_INVOICE_DETAIL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: SalesInvoiceRouteContext) {
  try {
    const resolved = await getAuthorizedInvoiceName(context);

    if (resolved.error) {
      return resolved.error;
    }

    const salesInvoice = await getErpnextSalesInvoiceDetail(resolved.name);

    if (salesInvoice.docstatus !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SALES_INVOICE_NOT_DRAFT",
            message:
              "Esta factura ya esta confirmada. Para corregirla debes anularla y crear una nueva.",
          },
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const input: UpdateSalesInvoiceDraftInput = {
      due_date: getStringField(body, "due_date") || undefined,
      remarks: getStringField(body, "remarks") || undefined,
      items: getDraftItems(body),
    };
    const invalidItem = input.items?.find(
      (item) =>
        !item.item_code ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isFinite(item.rate) ||
        item.rate < 0
    );

    if (input.items && input.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMPTY_SALES_INVOICE_ITEMS",
            message: "La factura debe tener al menos un producto.",
          },
        },
        { status: 400 }
      );
    }

    if (invalidItem) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SALES_INVOICE_ITEM",
            message:
              "Cada producto necesita codigo, cantidad mayor a 0 y precio valido",
          },
        },
        { status: 400 }
      );
    }

    if (input.items?.some((item) => item.warehouse)) {
      const warehouses = await getErpnextWarehouses();
      const invalidWarehouse = input.items.find((item) => {
        if (!item.warehouse) {
          return false;
        }

        const warehouse = warehouses.find(
          (erpWarehouse) => erpWarehouse.name === item.warehouse
        );

        return !warehouse || warehouse.disabled === 1 || warehouse.is_group === 1;
      });

      if (invalidWarehouse) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_SALES_INVOICE_WAREHOUSE",
              message: "Selecciona una bodega utilizable para los productos.",
            },
          },
          { status: 400 }
        );
      }
    }

    const updatedSalesInvoice = await updateErpnextSalesInvoiceDraft(
      resolved.name,
      input
    );

    return NextResponse.json({
      success: true,
      data: { sales_invoice: updatedSalesInvoice },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo editar la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_UPDATE_SALES_INVOICE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: SalesInvoiceRouteContext
) {
  try {
    const resolved = await getAuthorizedInvoiceName(context);

    if (resolved.error) {
      return resolved.error;
    }

    const salesInvoice = await getErpnextSalesInvoiceDetail(resolved.name);

    if (salesInvoice.docstatus !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SALES_INVOICE_NOT_DRAFT",
            message: "Solo se pueden eliminar facturas en borrador.",
          },
        },
        { status: 400 }
      );
    }

    await deleteErpnextSalesInvoiceDraft(resolved.name);

    return NextResponse.json({
      success: true,
      data: { action: "deleted", name: resolved.name },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_DELETE_SALES_INVOICE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
