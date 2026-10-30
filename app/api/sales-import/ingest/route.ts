import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { resolveTokenTenant } from "@/lib/core/sales-ingest-tokens";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing authorization token." }, { status: 401 });
  }

  const resolved = await resolveTokenTenant(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "Invalid or disabled token." }, { status: 401 });
  }

  const { tenantId, source } = resolved;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    externalId,
    documentType: rawDocType,
    documentNumber,
    accessKey,
    authorizationDate,
    issueDate,
    subtotal,
    tax,
    total,
    customer,
    items,
    observation,
  } = body as Record<string, unknown>;

  if (!documentNumber || typeof documentNumber !== "string") {
    return NextResponse.json({ ok: false, error: "documentNumber is required." }, { status: 400 });
  }
  if (!issueDate) {
    return NextResponse.json({ ok: false, error: "issueDate is required." }, { status: 400 });
  }

  const prisma = getPrismaClient();

  // Dedup check
  const docType = (typeof rawDocType === "string" ? rawDocType : "INVOICE") as "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE";

  if (typeof accessKey === "string" && /^\d{49}$/.test(accessKey)) {
    const existing = await prisma.externalSalesDocument.findUnique({
      where: { tenantId_accessKey: { tenantId, accessKey } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true, existingId: existing.id });
    }

    const sriDoc = await prisma.sriDocument.findFirst({
      where: { tenantId, accessKey },
      select: { id: true },
    });
    if (sriDoc) {
      return NextResponse.json({ ok: true, duplicate: true, existingSource: "FACTUROM" });
    }
  }

  const existsByNumber = await prisma.externalSalesDocument.findUnique({
    where: { tenantId_documentType_documentNumber: { tenantId, documentType: docType, documentNumber: String(documentNumber) } },
    select: { id: true },
  });
  if (existsByNumber) {
    return NextResponse.json({ ok: true, duplicate: true, existingId: existsByNumber.id });
  }

  if (typeof externalId === "string" && externalId) {
    const existsBySrcId = await prisma.externalSalesDocument.findUnique({
      where: { tenantId_source_sourceExternalId: { tenantId, source: source as "API" | "TELEGRAM", sourceExternalId: externalId } },
      select: { id: true },
    });
    if (existsBySrcId) {
      return NextResponse.json({ ok: true, duplicate: true, existingId: existsBySrcId.id });
    }
  }

  // Resolve customer
  const cust = (customer ?? {}) as Record<string, unknown>;
  const custIdentification = String(cust.identification ?? "").trim();
  let customerId: string | null = null;
  if (custIdentification) {
    const found = await prisma.lightweightCustomer.findFirst({
      where: { tenantId, identification: custIdentification },
      select: { id: true },
    });
    if (found) customerId = found.id;
  }

  const parsedDate = new Date(String(issueDate));
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid issueDate." }, { status: 400 });
  }

  const itemsData = Array.isArray(items)
    ? (items as Record<string, unknown>[]).map((it) => ({
        productCode: it.code ? String(it.code) : null,
        productName: it.name ? String(it.name) : null,
        taxRate: new Prisma.Decimal(Number(it.taxRate ?? 0)),
        quantity: new Prisma.Decimal(Number(it.quantity ?? 0)),
        unitPrice: new Prisma.Decimal(Number(it.unitPrice ?? 0)),
        discountAmount: new Prisma.Decimal(Number(it.discount ?? 0)),
        subtotal: new Prisma.Decimal(
          Number((Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0) - Number(it.discount ?? 0)).toFixed(2)),
        ),
        taxAmount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        observation: it.observation ? String(it.observation) : null,
      }))
    : [];

  const doc = await prisma.externalSalesDocument.create({
    data: {
      tenantId,
      source: source as "API" | "TELEGRAM",
      sourceExternalId: typeof externalId === "string" ? externalId : null,
      documentType: docType,
      documentNumber: String(documentNumber),
      accessKey: typeof accessKey === "string" && /^\d{49}$/.test(accessKey) ? accessKey : null,
      authorizationDate: authorizationDate ? new Date(String(authorizationDate)) : null,
      issueDate: parsedDate,
      customerIdentificationType: cust.identificationType ? String(cust.identificationType) : null,
      customerIdentification: custIdentification || null,
      customerName: String(cust.name ?? "Consumidor Final"),
      customerId,
      subtotal: new Prisma.Decimal(Number(subtotal ?? 0)),
      taxTotal: new Prisma.Decimal(Number(tax ?? 0)),
      total: new Prisma.Decimal(Number(total ?? 0)),
      observation: typeof observation === "string" ? observation : null,
      status: "IMPORTED",
      items: itemsData.length > 0 ? { create: itemsData } : undefined,
    },
    select: { id: true, documentNumber: true },
  });

  return NextResponse.json({ ok: true, id: doc.id, documentNumber: doc.documentNumber });
}
