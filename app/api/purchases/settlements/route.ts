import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;

  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    sourceType: "PURCHASE_SETTLEMENT",
    documentType: "PURCHASE_SETTLEMENT",
  };
  if (status) where.status = status;

  const docs = await prisma.sriDocument.findMany({
    where: where as never,
    include: {
      establishment: { select: { code: true } },
      issuePoint: { select: { code: true } },
      lines: true,
      submissionJobs: {
        where: { status: "AUTHORIZED" },
        select: { sriAuthorizationNumber: true, authorizedAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const body = await req.json();

  if (!body.supplierName || !body.supplierIdentification) {
    return NextResponse.json({ error: "Proveedor con nombre e identificación requerido." }, { status: 400 });
  }

  if (!body.lines || body.lines.length === 0) {
    return NextResponse.json({ error: "Al menos una línea requerida." }, { status: 400 });
  }

  const establishment = await prisma.sriEstablishment.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: [{ isMain: "desc" }, { code: "asc" }],
  });
  if (!establishment) {
    return NextResponse.json({ error: "Establecimiento SRI requerido." }, { status: 400 });
  }

  const issuePoint = await prisma.sriIssuePoint.findFirst({
    where: { tenantId: tenant.id, establishmentId: establishment.id, isActive: true },
    orderBy: { code: "asc" },
  });
  if (!issuePoint) {
    return NextResponse.json({ error: "Punto de emisión requerido." }, { status: 400 });
  }

  const sriDoc = await prisma.sriDocument.create({
    data: {
      tenantId: tenant.id,
      sourceType: "PURCHASE_SETTLEMENT",
      documentType: "PURCHASE_SETTLEMENT",
      status: "DRAFT",
      environment: "TEST",
      establishmentId: establishment.id,
      issuePointId: issuePoint.id,
      customerName: body.supplierName,
      customerIdentification: body.supplierIdentification,
      subtotal: body.subtotal ?? 0,
      taxTotal: body.taxTotal ?? 0,
      discountTotal: body.discountTotal ?? 0,
      grandTotal: body.grandTotal ?? 0,
      sriPaymentCode: body.sriPaymentCode ?? "01",
      commercialPaymentMethod: body.paymentMethod,
      lines: {
        create: body.lines.map((line: {
          description: string;
          quantity: number;
          unitPrice: number;
          discountAmount?: number;
          taxRate?: number;
          taxAmount?: number;
        }) => {
          const sub = Number(line.quantity) * Number(line.unitPrice) - Number(line.discountAmount ?? 0);
          const taxAmt = sub * (Number(line.taxRate ?? 0) / 100);
          return {
            itemName: line.description,
            itemCode: "NA",
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount ?? 0,
            subtotal: sub,
            taxRate: line.taxRate ?? 0,
            taxAmount: line.taxAmount ?? taxAmt,
            total: sub + (line.taxAmount ?? taxAmt),
          };
        }),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json({ ok: true, document: sriDoc });
}
