import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  let settings = await prisma.businessSettings.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!settings) {
    settings = await prisma.businessSettings.create({
      data: { tenantId: tenant.id },
    });
  }

  const { creditNoteAuthPasswordHash, ...safeSettings } = settings;

  return NextResponse.json({
    success: true,
    data: {
      ...safeSettings,
      hasCreditNoteAuthPassword: Boolean(creditNoteAuthPasswordHash),
    },
  });
}

const ALLOWED_FIELDS = new Set([
  "defaultCustomerEmail",
  "defaultQuantity",
  "salesDecimals",
  "saleDescription",
  "enableSubsidyManagement",
  "editSellerData",
  "showSellerCustomers",
  "costPriceFromNetTotal",
  "hideObservation",
  "hideStock",
  "hideIva",
  "hideDiscounts",
  "controlStockOnSale",
  "controlStockOnProforma",
  "detailedInventory",
  "enableProductCosting",
  "autoDiscountOnSale",
  "colBarcode",
  "colImage",
  "colCode",
  "colName",
  "colBrand",
  "colCost",
  "colPvpIva",
  "colBar",
  "colTax",
  "colCategory",
  "colStock",
  "colStatus",
  "allowDeleteDocuments",
  "requireKeyOnSale",
  "selectSellerOnInvoice",
  "selectDateOnInvoice",
  "disableManualPriceChange",
  "showPriceWithIvaOnTicket",
  "useBranchInfoOnPrint",
  "includeLogoOnTicket",
  "barcodeColumns",
  "labelShowName",
  "labelShowCode",
  "labelShowBrand",
  "labelShowColor",
  "labelShowPrice",
  "labelShowSize",
  "cashClosingMode",
  "cashClosingType",
  "requireCreditNoteAuth",
  "pdfBackgroundColor",
  "pdfAccentColor",
  "includeExtraSequential",
  "invoiceLegend",
  "invoiceExtraNote",
  "proformaFormat",
  "showResponsible",
  "showWarehouse",
  "showSeller",
  "showTicketAutomatically",
  "showResponsibilitySignatures",
]);

const VALID_CLOSING_MODES = ["by_cash_register", "by_user"];
const VALID_CLOSING_TYPES = ["cash_only", "total"];
const VALID_PROFORMA_FORMATS = ["standard", "format_a", "format_b", "format_c"];

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;

    if (key === "cashClosingMode") {
      if (typeof value !== "string" || !VALID_CLOSING_MODES.includes(value)) continue;
    }
    if (key === "cashClosingType") {
      if (typeof value !== "string" || !VALID_CLOSING_TYPES.includes(value)) continue;
    }
    if (key === "proformaFormat") {
      if (typeof value !== "string" || !VALID_PROFORMA_FORMATS.includes(value)) continue;
    }
    if (key === "pdfBackgroundColor" || key === "pdfAccentColor") {
      if (typeof value !== "string" || !isValidHexColor(value)) continue;
    }
    if (key === "defaultQuantity" || key === "salesDecimals" || key === "barcodeColumns") {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || num > 99) continue;
      data[key] = Math.round(num);
      continue;
    }

    data[key] = value;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay campos válidos para actualizar." }, { status: 400 });
  }

  const settings = await prisma.businessSettings.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, ...data },
    update: data,
  });

  const { creditNoteAuthPasswordHash, ...safeSettings } = settings;

  return NextResponse.json({
    success: true,
    data: {
      ...safeSettings,
      hasCreditNoteAuthPassword: Boolean(creditNoteAuthPasswordHash),
    },
  });
}
