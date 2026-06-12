import { LightweightPaymentMethod } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { startSriFlowFromBasicSale } from "@/lib/core/basic-sales-sri";
import { createSale, listSales } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function isPaymentMethod(value: unknown): value is LightweightPaymentMethod {
  return (
    value === "cash" ||
    value === "transfer" ||
    value === "card" ||
    value === "credit"
  );
}

function readItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      productId: typeof row.productId === "string" ? row.productId : "",
      quantity:
        typeof row.quantity === "number"
          ? row.quantity
          : Number(row.quantity ?? 0),
    };
  });
}

function isOutputMode(value: unknown): value is "internal_receipt" | "sri_invoice" {
  return value === "internal_receipt" || value === "sri_invoice";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sales = await listSales(tenant.id, {
    status:
      status === "paid" || status === "pending" || status === "canceled"
        ? status
        : "all",
  });

  return NextResponse.json({ ok: true, sales });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const method = body.paymentMethod;

    if (!isPaymentMethod(method)) {
      throw new Error("Metodo de pago invalido.");
    }

    const outputMode = isOutputMode(body.outputMode) ? body.outputMode : "internal_receipt";

    const sale = await createSale({
      tenantId: tenant.id,
      customerId:
        typeof body.customerId === "string" && body.customerId
          ? body.customerId
          : undefined,
      paymentMethod: method,
      paidAmount:
        typeof body.paidAmount === "number"
          ? body.paidAmount
          : Number(body.paidAmount ?? 0),
      items: readItems(body.items),
    });

    let output: Record<string, unknown> = {
      mode: outputMode,
      status: "completed",
      saleId: sale.id,
    };

    if (outputMode === "sri_invoice") {
      try {
        const sri = await startSriFlowFromBasicSale({
          tenantId: tenant.id,
          saleId: sale.id,
          requestedByUserId: user.id,
        });

        output = {
          ...output,
          status: "completed",
          sri,
        };
      } catch (sriError) {
        output = {
          ...output,
          status: "partial",
          errorMessage:
            sriError instanceof Error
              ? sriError.message
              : "La venta se creo, pero no se pudo iniciar la factura SRI.",
        };
      }
    }

    return NextResponse.json({ ok: true, sale, output });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear venta.",
      },
      { status: 400 }
    );
  }
}
