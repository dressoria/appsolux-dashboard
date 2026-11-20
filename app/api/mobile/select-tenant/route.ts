import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveMobileTenantContext } from "@/lib/auth/mobile-user";

export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }

  let body: { tenantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "Cuerpo JSON inválido." } },
      { status: 400 },
    );
  }

  const { tenantId } = body;

  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "tenantId es requerido." } },
      { status: 400 },
    );
  }

  const result = await resolveMobileTenantContext(clerkUserId, tenantId);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: { code: result.code, message: result.message } },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    user: result.context.user,
    tenant: result.context.tenant,
    subscription: result.context.subscription,
    access: result.context.access,
  });
}
