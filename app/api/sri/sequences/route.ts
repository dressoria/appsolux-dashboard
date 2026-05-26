import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { listSriSequences, upsertSriSequence } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const VALID_DOCUMENT_TYPES = ["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "WITHHOLDING", "REFERRAL_GUIDE"] as const;
type DocType = (typeof VALID_DOCUMENT_TYPES)[number];

function isValidDocType(v: unknown): v is DocType {
  return VALID_DOCUMENT_TYPES.includes(v as DocType);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const sequences = await listSriSequences(tenant.id);
  return NextResponse.json({ sequences });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const establishmentId = typeof data.establishmentId === "string" ? data.establishmentId : "";
  const issuePointId = typeof data.issuePointId === "string" ? data.issuePointId : "";
  const documentType = data.documentType;
  const startNumber = typeof data.startNumber === "number" ? Math.floor(data.startNumber) : NaN;
  const currentNumber = typeof data.currentNumber === "number" ? Math.floor(data.currentNumber) : startNumber;

  if (!establishmentId) return NextResponse.json({ error: "Establecimiento requerido." }, { status: 422 });
  if (!issuePointId) return NextResponse.json({ error: "Punto de emision requerido." }, { status: 422 });
  if (!isValidDocType(documentType)) {
    return NextResponse.json({ error: "Tipo de comprobante invalido." }, { status: 422 });
  }
  if (!Number.isFinite(startNumber) || startNumber < 1) {
    return NextResponse.json({ error: "El numero inicial debe ser mayor a 0." }, { status: 422 });
  }

  // Validate establishment and issue point belong to this tenant
  const prisma = getPrismaClient();
  const [establishment, issuePoint] = await Promise.all([
    prisma.sriEstablishment.findFirst({ where: { id: establishmentId, tenantId: tenant.id } }),
    prisma.sriIssuePoint.findFirst({ where: { id: issuePointId, tenantId: tenant.id, establishmentId } }),
  ]);

  if (!establishment) return NextResponse.json({ error: "Establecimiento no encontrado." }, { status: 404 });
  if (!issuePoint) return NextResponse.json({ error: "Punto de emision no encontrado." }, { status: 404 });

  const sequence = await upsertSriSequence(tenant.id, {
    establishmentId,
    issuePointId,
    documentType,
    currentNumber,
    startNumber,
  });

  return NextResponse.json({ sequence }, { status: 200 });
}
