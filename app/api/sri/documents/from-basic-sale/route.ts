import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { startSriFlowFromBasicSale } from "@/lib/core/basic-sales-sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

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

  const saleId = (body as Record<string, unknown>).saleId;
  if (typeof saleId !== "string" || !saleId.trim()) {
    return NextResponse.json({ error: "saleId es requerido." }, { status: 422 });
  }

  try {
    const result = await startSriFlowFromBasicSale({
      tenantId: tenant.id,
      saleId: saleId.trim(),
      requestedByUserId: user.id,
    });

    return NextResponse.json(
      result,
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
