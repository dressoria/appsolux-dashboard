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
    sourceType: "PURCHASE_WITHHOLDING",
    documentType: "WITHHOLDING",
  };
  if (status) where.status = status;

  const docs = await prisma.sriDocument.findMany({
    where: where as never,
    include: {
      establishment: { select: { code: true } },
      issuePoint: { select: { code: true } },
      withholdingLines: true,
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

  if (!body.purchaseDocumentId) {
    return NextResponse.json({ error: "Compra requerida." }, { status: 400 });
  }

  const purchaseDoc = await prisma.purchaseDocument.findFirst({
    where: { id: body.purchaseDocumentId, tenantId: tenant.id },
    include: { supplier: true },
  });
  if (!purchaseDoc) {
    return NextResponse.json({ error: "Compra no encontrada." }, { status: 404 });
  }
  if (!purchaseDoc.supplier) {
    return NextResponse.json({ error: "Proveedor requerido." }, { status: 400 });
  }
  if (!purchaseDoc.supplier.identification) {
    return NextResponse.json({ error: "Proveedor sin identificación." }, { status: 400 });
  }

  if (!body.lines || body.lines.length === 0) {
    return NextResponse.json({ error: "Al menos una línea de retención." }, { status: 400 });
  }

  for (const line of body.lines) {
    if (!line.code || !line.taxType) {
      return NextResponse.json({ error: "Código y tipo de impuesto requeridos." }, { status: 400 });
    }
    if (Number(line.taxBase) <= 0) {
      return NextResponse.json({ error: "Base imponible debe ser mayor a 0." }, { status: 400 });
    }
    if (Number(line.retainedAmount) < 0) {
      return NextResponse.json({ error: "Valor retenido no puede ser negativo." }, { status: 400 });
    }
  }

  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Configuración SRI requerida." }, { status: 400 });
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

  const totalRetained = body.lines.reduce(
    (sum: number, l: { retainedAmount: number }) => sum + Number(l.retainedAmount),
    0,
  );

  const sriDoc = await prisma.sriDocument.create({
    data: {
      tenantId: tenant.id,
      sourceType: "PURCHASE_WITHHOLDING",
      sourceId: purchaseDoc.id,
      documentType: "WITHHOLDING",
      status: "DRAFT",
      environment: "TEST",
      establishmentId: establishment.id,
      issuePointId: issuePoint.id,
      customerName: purchaseDoc.supplier.name,
      customerIdentification: purchaseDoc.supplier.identification,
      subtotal: totalRetained,
      taxTotal: 0,
      discountTotal: 0,
      grandTotal: totalRetained,
      withholdingLines: {
        create: body.lines.map((line: {
          taxType: string;
          code: string;
          description?: string;
          taxBase: number;
          percentage: number;
          retainedAmount: number;
          withholdingCodeId?: string;
        }) => ({
          taxType: line.taxType,
          code: line.code,
          description: line.description ?? null,
          taxBase: line.taxBase,
          percentage: line.percentage,
          retainedAmount: line.retainedAmount,
          withholdingCodeId: line.withholdingCodeId ?? null,
          purchaseDocumentNumber: purchaseDoc.supplierDocumentNumber,
          purchaseDocumentDate: purchaseDoc.issueDate,
        })),
      },
    },
    include: { withholdingLines: true },
  });

  return NextResponse.json({ ok: true, document: sriDoc });
}
