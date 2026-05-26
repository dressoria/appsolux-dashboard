import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  createSriIssuePoint,
  listSriIssuePoints,
  validateThreeDigitCode,
} from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const issuePoints = await listSriIssuePoints(tenant.id);
  return NextResponse.json({ issuePoints });
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
  const code = typeof data.code === "string" ? data.code.trim() : "";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const establishmentId = typeof data.establishmentId === "string" ? data.establishmentId : "";

  if (!validateThreeDigitCode(code)) {
    return NextResponse.json({ error: "El codigo debe tener 3 digitos." }, { status: 422 });
  }
  if (!name) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 422 });
  if (!establishmentId) return NextResponse.json({ error: "Establecimiento requerido." }, { status: 422 });

  // Validate establishmentId belongs to this tenant
  const prisma = getPrismaClient();
  const establishment = await prisma.sriEstablishment.findFirst({
    where: { id: establishmentId, tenantId: tenant.id },
  });
  if (!establishment) {
    return NextResponse.json({ error: "Establecimiento no encontrado." }, { status: 404 });
  }

  try {
    const issuePoint = await createSriIssuePoint(tenant.id, { establishmentId, code, name });
    return NextResponse.json({ issuePoint }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "El codigo ya existe en este establecimiento. Usa un codigo diferente." },
      { status: 409 }
    );
  }
}
