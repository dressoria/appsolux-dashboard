import { NextResponse } from "next/server";
import { Prisma, QuickInvoiceDraftStatus } from "@prisma/client";

import { createErpnextCustomer, createErpnextCustomerAddress } from "@/lib/api/erpnext/customers";
import { createErpnextPosCheckout } from "@/lib/api/erpnext/pos-checkout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  requireActiveErpTenantForApi,
  resolveTenantErpCompany,
} from "@/lib/core/require-active-erp-tenant";
import type { PriceChannel, QuickInvoiceParsedDraft } from "@/types/quick-invoice";
import type { PosCheckoutInput } from "@/types/erpnext";

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
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function getBooleanField(body: Record<string, unknown>, field: string) {
  return body[field] === true;
}

function getDraftField(body: Record<string, unknown>) {
  const draft = body.draft;
  return draft && typeof draft === "object" ? (draft as QuickInvoiceParsedDraft) : null;
}

function buildAuditNote(draft: QuickInvoiceParsedDraft, note: string) {
  const itemDetails = draft.items
    .map((item) => `${item.itemName}: ${item.priceChannel}${item.manualPriceReason ? ` (${item.manualPriceReason})` : ""}`)
    .join(" | ");

  return [note.trim(), "Facturador rapido", `Canales/precios: ${itemDetails}`]
    .filter(Boolean)
    .join("\n");
}

async function resolveCustomerName(input: {
  draft: QuickInvoiceParsedDraft;
  createCustomerIfMissing: boolean;
  territory: string;
}) {
  const existingCustomerName = input.draft.customer.existingCustomerName?.trim();

  if (existingCustomerName) {
    return existingCustomerName;
  }

  if (!input.createCustomerIfMissing) {
    throw new Error("El cliente no existe todavia. Activa la creacion de cliente para continuar.");
  }

  if (!input.draft.customer.customerName.trim()) {
    throw new Error("No se detecto un nombre de cliente suficiente para crear el registro.");
  }

  if (!input.territory.trim()) {
    throw new Error("Selecciona un territorio para crear el cliente.");
  }

  const customer = await createErpnextCustomer({
    customer_name: input.draft.customer.customerName.trim(),
    customer_type: "Individual",
    territory: input.territory.trim(),
    tax_id: input.draft.customer.taxId.trim() || undefined,
    mobile_no: input.draft.customer.phone.trim() || undefined,
  });

  if (input.draft.customer.address.trim()) {
    try {
      await createErpnextCustomerAddress(customer.name, input.draft.customer.address.trim());
    } catch {
      // address creation is best-effort
    }
  }

  return customer.name;
}

function validateDraft(draft: QuickInvoiceParsedDraft) {
  if (!draft.rawMessage.trim()) {
    throw new Error("El mensaje original es requerido.");
  }

  if (draft.requiresReview) {
    throw new Error("El borrador aun tiene advertencias o datos ambiguos. Revísalo antes de facturar.");
  }

  if (draft.items.length === 0) {
    throw new Error("Agrega al menos un producto antes de confirmar la factura.");
  }

  const invalidItem = draft.items.find(
    (item) => !item.itemCode || !Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(item.unitPrice ?? NaN) || (item.unitPrice ?? 0) <= 0
  );

  if (invalidItem) {
    throw new Error("Cada linea debe tener producto valido, cantidad positiva y precio mayor a 0.");
  }
}

export async function POST(request: Request) {
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
            message: "Sesion requerida.",
          },
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const draft = getDraftField(body);

    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_QUICK_INVOICE_DRAFT",
            message: "El borrador analizado es requerido.",
          },
        },
        { status: 400 }
      );
    }

    validateDraft(draft);

    const companyResult = await resolveTenantErpCompany(erpGuard, getStringField(body, "company"));
    if (!companyResult.ok) return companyResult.response;

    const warehouse = getStringField(body, "warehouse");
    const modeOfPayment = getStringField(body, "modeOfPayment");
    const note = getStringField(body, "note");
    const territory = getStringField(body, "territory");
    const paidAmount = getNumberField(body, "paidAmount");
    const referenceNo = getStringField(body, "referenceNo");
    const referenceDate = getStringField(body, "referenceDate");
    const createCustomerIfMissing = getBooleanField(body, "createCustomerIfMissing");

    if (!warehouse || !modeOfPayment || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_QUICK_INVOICE_CONFIRM_INPUT",
            message: "Bodega, metodo de pago y monto recibido son requeridos.",
          },
        },
        { status: 400 }
      );
    }

    const customer = await resolveCustomerName({
      draft,
      createCustomerIfMissing,
      territory,
    });

    const input: PosCheckoutInput = {
      customer,
      company: companyResult.company,
      warehouse,
      mode_of_payment: modeOfPayment,
      paid_amount: paidAmount,
      note: buildAuditNote(draft, note),
      reference_no: referenceNo || undefined,
      reference_date: referenceDate || undefined,
      items: draft.items.map((item) => ({
        item_code: item.itemCode!,
        qty: item.qty,
        rate: item.unitPrice!,
        warehouse,
      })),
    };

    const checkout = await createErpnextPosCheckout(input);
    const prisma = getPrismaClient();
    const savedDraft = await prisma.quickInvoiceDraft.create({
      data: {
        tenantId: erpGuard.tenant.id,
        createdByUserId: user.id,
        status: QuickInvoiceDraftStatus.CONFIRMED,
        rawMessage: draft.rawMessage,
        parsedData: draft as Prisma.InputJsonValue,
        warnings: draft.warnings as Prisma.InputJsonValue,
        salesInvoiceName: checkout.invoice.name,
        customerName: draft.customer.customerName || null,
        customerTaxId: draft.customer.taxId || null,
        customerPhone: draft.customer.phone || null,
        customerAddress: draft.customer.address || null,
        companyName: companyResult.company,
        priceChannel: draft.priceChannel as PriceChannel,
        totalAmount:
          draft.totalAmount != null ? new Prisma.Decimal(draft.totalAmount) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: erpGuard.tenant.id,
        userId: user.id,
        action: "quick_invoice.confirmed",
        entityType: "QuickInvoiceDraft",
        entityId: savedDraft.id,
        metadata: {
          salesInvoiceName: checkout.invoice.name,
          paymentName: checkout.payment.name,
          warnings: draft.warnings,
          createCustomerIfMissing,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        quickInvoiceDraftId: savedDraft.id,
        checkout,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo confirmar la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_QUICK_INVOICE_CONFIRM_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
