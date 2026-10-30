import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { resolveTokenTenant } from "@/lib/core/sales-ingest-tokens";

function xmlText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match?.[1] ?? "";
}

function xmlAllText(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "g");
  const results: string[] = [];
  let m;
  while ((m = regex.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

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
  const prisma = getPrismaClient();

  let xmlContent: string;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("xml") || contentType.includes("text/plain")) {
    xmlContent = await request.text();
  } else {
    try {
      const body = await request.json();
      xmlContent = typeof body.xml === "string" ? body.xml : "";
    } catch {
      return NextResponse.json({ ok: false, error: "No XML content provided." }, { status: 400 });
    }
  }

  if (!xmlContent.trim()) {
    return NextResponse.json({ ok: false, error: "Empty XML." }, { status: 400 });
  }

  // Reject external entities (XXE protection)
  if (/<!DOCTYPE|<!ENTITY/i.test(xmlContent)) {
    return NextResponse.json({ ok: false, error: "XML with DOCTYPE/ENTITY not allowed." }, { status: 400 });
  }

  // Parse SRI XML
  const claveAcceso = xmlText(xmlContent, "claveAcceso");
  const rucEmisor = xmlText(xmlContent, "ruc");
  const estab = xmlText(xmlContent, "estab");
  const ptoEmi = xmlText(xmlContent, "ptoEmi");
  const secuencial = xmlText(xmlContent, "secuencial");
  const fechaEmision = xmlText(xmlContent, "fechaEmision");
  const razonSocialComprador = xmlText(xmlContent, "razonSocialComprador");
  const identificacionComprador = xmlText(xmlContent, "identificacionComprador");
  const totalSinImpuestos = xmlText(xmlContent, "totalSinImpuestos");
  const importeTotal = xmlText(xmlContent, "importeTotal");
  const codDoc = xmlText(xmlContent, "codDoc");

  if (!rucEmisor) {
    return NextResponse.json({ ok: false, error: "Cannot extract RUC from XML." }, { status: 400 });
  }

  // Validate issuer RUC matches tenant
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId },
    select: { ruc: true },
  });

  if (!profile || profile.ruc !== rucEmisor) {
    return NextResponse.json(
      { ok: false, error: `RUC emisor (${rucEmisor}) no coincide con el RUC del tenant (${profile?.ruc ?? "no configurado"}).` },
      { status: 403 },
    );
  }

  const documentNumber = `${estab}-${ptoEmi}-${secuencial}`;

  // Determine document type
  let docType: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE" = "INVOICE";
  if (codDoc === "04") docType = "CREDIT_NOTE";
  else if (codDoc === "05") docType = "DEBIT_NOTE";

  // Dedup by access key
  if (claveAcceso && /^\d{49}$/.test(claveAcceso)) {
    const existing = await prisma.externalSalesDocument.findUnique({
      where: { tenantId_accessKey: { tenantId, accessKey: claveAcceso } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true, existingId: existing.id });
    }

    const sriDoc = await prisma.sriDocument.findFirst({
      where: { tenantId, accessKey: claveAcceso },
      select: { id: true },
    });
    if (sriDoc) {
      return NextResponse.json({ ok: true, duplicate: true, existingSource: "FACTUROM" });
    }
  }

  // Parse items from <detalles>
  const detallesBlock = xmlContent.match(/<detalles>([\s\S]*?)<\/detalles>/)?.[1] ?? "";
  const detalleBlocks = detallesBlock.match(/<detalle>([\s\S]*?)<\/detalle>/g) ?? [];

  const itemsData = detalleBlocks.map((block) => {
    const cantidad = Number(xmlText(block, "cantidad") || 0);
    const precioUnitario = Number(xmlText(block, "precioUnitario") || 0);
    const descuento = Number(xmlText(block, "descuento") || 0);
    const precioTotalSinImpuesto = Number(xmlText(block, "precioTotalSinImpuesto") || 0);
    const codigoPrincipal = xmlText(block, "codigoPrincipal");
    const descripcion = xmlText(block, "descripcion");

    return {
      productCode: codigoPrincipal || null,
      productName: descripcion || null,
      taxRate: new Prisma.Decimal(0),
      quantity: new Prisma.Decimal(cantidad),
      unitPrice: new Prisma.Decimal(precioUnitario),
      discountAmount: new Prisma.Decimal(descuento),
      subtotal: new Prisma.Decimal(precioTotalSinImpuesto),
      taxAmount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(precioTotalSinImpuesto),
      observation: null,
    };
  });

  // Parse date (dd/mm/yyyy)
  const parsedDate = (() => {
    const m = fechaEmision.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00-05:00`);
    return new Date(fechaEmision);
  })();

  const subtotal = Number(totalSinImpuestos || 0);
  const total = Number(importeTotal || 0);
  const tax = Math.max(0, total - subtotal);

  const doc = await prisma.externalSalesDocument.create({
    data: {
      tenantId,
      source: source as "API" | "TELEGRAM",
      documentType: docType,
      documentNumber,
      accessKey: claveAcceso && /^\d{49}$/.test(claveAcceso) ? claveAcceso : null,
      issueDate: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      customerIdentification: identificacionComprador || null,
      customerName: razonSocialComprador || "Consumidor Final",
      subtotal: new Prisma.Decimal(subtotal),
      taxTotal: new Prisma.Decimal(tax),
      total: new Prisma.Decimal(total),
      status: "IMPORTED",
      rawPayload: { xml: xmlContent.slice(0, 50000) },
      items: itemsData.length > 0 ? { create: itemsData } : undefined,
    },
    select: { id: true, documentNumber: true },
  });

  return NextResponse.json({ ok: true, id: doc.id, documentNumber: doc.documentNumber });
}
