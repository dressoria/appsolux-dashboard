import type { LightweightPaymentMethod } from "@prisma/client";
import { NextResponse } from "next/server";

import { createErpnextPosCheckout } from "@/lib/api/erpnext/pos-checkout";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { startSriFlowFromBasicSale } from "@/lib/core/basic-sales-sri";
import { getTenantPreferredWarehouseName } from "@/lib/core/business-suite/erpnext-master-data";
import { getErpProductPricingMap } from "@/lib/core/erp-pricing";
import { createSale } from "@/lib/core/lightweight-pos";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { ErpnextModeOfPayment } from "@/types/erpnext";

function isPaymentMethod(value: unknown): value is LightweightPaymentMethod {
  return (
    value === "cash" ||
    value === "transfer" ||
    value === "card" ||
    value === "credit"
  );
}

function isOutputMode(value: unknown): value is "internal_receipt" | "sri_invoice" {
  return value === "internal_receipt" || value === "sri_invoice";
}

function readItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      productId: typeof row.productId === "string" ? row.productId : "",
      quantity: typeof row.quantity === "number" ? row.quantity : Number(row.quantity ?? 0),
      discountAmount:
        typeof row.discountAmount === "number"
          ? row.discountAmount
          : Number(row.discountAmount ?? 0),
    };
  });
}

function findErpModeOfPayment(
  paymentMethod: string,
  modes: ErpnextModeOfPayment[]
): string | null {
  const enabled = modes.filter((m) => m.enabled !== false && m.enabled !== 0);
  if (enabled.length === 0) return null;
  const lower = paymentMethod.toLowerCase();
  const found = enabled.find((m) => {
    const n = m.name.toLowerCase();
    if (lower === "cash") return n.includes("cash") || n.includes("efectivo") || n.includes("caja");
    if (lower === "transfer") return n.includes("transfer") || n.includes("banco");
    if (lower === "card") return n.includes("card") || n.includes("tarjeta");
    return false;
  });
  return found?.name ?? enabled[0]?.name ?? null;
}

function getRequestedWarehouseName(body: Record<string, unknown>) {
  return typeof body.warehouseName === "string" ? body.warehouseName.trim() : "";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);
    const body = (await request.json()) as Record<string, unknown>;
    const items = readItems(body.items);

    // ── SHARED_ERP path ────────────────────────────────────────────────────
    if (tenantMode.canUseAdvancedErp) {
      if (!body.customerId) {
        return NextResponse.json(
          { ok: false, message: "Selecciona un cliente para ventas con Gestión Empresarial." },
          { status: 400 }
        );
      }

      const [companies, warehousesRaw, modesOfPayment, pricingMap, preferredWarehouseName] = await Promise.all([
        getErpnextCompanies(),
        getErpnextWarehouses(),
        getErpnextModesOfPayment(),
        getErpProductPricingMap(tenant.id, items.map((i) => i.productId)),
        getTenantPreferredWarehouseName(tenant.id),
      ]);

      const usableWarehouses = warehousesRaw.filter(
        (w) => w.disabled !== 1 && w.is_group !== 1
      );
      const company = companies[0]?.name ?? null;
      const requestedWarehouseName = getRequestedWarehouseName(body);
      const warehouse =
        usableWarehouses.find((entry) => entry.name === requestedWarehouseName)?.name ??
        usableWarehouses.find((entry) => entry.name === preferredWarehouseName)?.name ??
        usableWarehouses[0]?.name ??
        null;
      const modeOfPayment = findErpModeOfPayment(String(body.paymentMethod ?? "cash"), modesOfPayment);

      if (!company) {
        return NextResponse.json(
          { ok: false, message: "No hay empresa configurada en Gestión Empresarial." },
          { status: 400 }
        );
      }
      if (!warehouse) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "No hay bodegas configuradas en Gestión Empresarial. Ve a Configuración > Bodegas.",
          },
          { status: 400 }
        );
      }
      if (requestedWarehouseName && warehouse !== requestedWarehouseName) {
        return NextResponse.json(
          {
            ok: false,
            message: "La bodega seleccionada no está disponible para este tenant.",
          },
          { status: 400 }
        );
      }
      if (!modeOfPayment) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "No hay métodos de pago configurados en Gestión Empresarial. Ve a Configuración > Métodos de pago.",
          },
          { status: 400 }
        );
      }

      const paidAmount =
        typeof body.paidAmount === "number" ? body.paidAmount : Number(body.paidAmount ?? 0);

      const result = await createErpnextPosCheckout({
        customer: String(body.customerId),
        company,
        warehouse,
        mode_of_payment: modeOfPayment,
        paid_amount: paidAmount,
        items: items.map((item) => {
          const basePrice = pricingMap[item.productId]?.retailPrice ?? 0;
          const qty = Math.max(1, item.quantity);
          const discountPerUnit = item.discountAmount / qty;
          const rate = Math.max(0, basePrice - discountPerUnit);
          return { item_code: item.productId, qty, rate, warehouse };
        }),
      });

      const sale = {
        id: result.invoice.name,
        createdAt: new Date().toISOString(),
        total: String(result.invoice.grand_total ?? paidAmount),
        subtotal: String(result.invoice.grand_total ?? paidAmount),
        taxTotal: "0",
        discountTotal: "0",
        status: "paid",
        paymentStatus: "paid",
        customer: { name: String(body.customerId) },
        items: [] as Array<{
          quantity: number;
          price: string;
          discountAmount: string;
          taxRate: string;
          taxAmount: string;
          total: string;
          product: { name: string };
        }>,
        payments: [
          {
            method: String(body.paymentMethod ?? "cash"),
            amount: String(result.payment.paid_amount ?? paidAmount),
          },
        ],
      };

      return NextResponse.json({
        ok: true,
        sale,
        output: {
          mode: "internal_receipt",
          status: "completed",
          saleId: result.invoice.name,
        },
      });
    }

    // ── CORE path (same logic as /api/basic/sales) ─────────────────────────
    const method = body.paymentMethod;
    if (!isPaymentMethod(method)) throw new Error("Metodo de pago invalido.");

    const outputMode = isOutputMode(body.outputMode) ? body.outputMode : "internal_receipt";

    const sale = await createSale({
      tenantId: tenant.id,
      customerId:
        typeof body.customerId === "string" && body.customerId
          ? body.customerId
          : undefined,
      paymentMethod: method,
      paidAmount:
        typeof body.paidAmount === "number" ? body.paidAmount : Number(body.paidAmount ?? 0),
      items,
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
        output = { ...output, status: "completed", sri };
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
        message: error instanceof Error ? error.message : "No se pudo crear venta.",
      },
      { status: 400 }
    );
  }
}
