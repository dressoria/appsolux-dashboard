import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSriProfile, upsertSriProfile, validateRuc } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const profile = await getSriProfile(tenant.id);
  return NextResponse.json({ profile });
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
  const legalName = typeof data.legalName === "string" ? data.legalName.trim() : "";
  const ruc = typeof data.ruc === "string" ? data.ruc.trim() : "";
  const environment = data.environment === "PRODUCTION" ? "PRODUCTION" : "TEST";

  if (!legalName) {
    return NextResponse.json({ error: "La razon social es obligatoria." }, { status: 422 });
  }
  if (!validateRuc(ruc)) {
    return NextResponse.json({ error: "El RUC debe tener 13 digitos numericos." }, { status: 422 });
  }

  const profile = await upsertSriProfile(tenant.id, {
    legalName,
    tradeName: typeof data.tradeName === "string" && data.tradeName.trim() ? data.tradeName.trim() : null,
    ruc,
    accountingRequired: data.accountingRequired === true || data.accountingRequired === "true",
    specialTaxpayerNumber: typeof data.specialTaxpayerNumber === "string" && data.specialTaxpayerNumber.trim() ? data.specialTaxpayerNumber.trim() : null,
    withholdingAgentResolution: typeof data.withholdingAgentResolution === "string" && data.withholdingAgentResolution.trim() ? data.withholdingAgentResolution.trim() : null,
    environment,
  });

  return NextResponse.json({ profile }, { status: 200 });
}
