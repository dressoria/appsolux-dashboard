import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  getTaxWithholdingMappings,
  upsertTaxWithholdingMapping,
} from "@/lib/core/accounting-parameters";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const mappings = await getTaxWithholdingMappings(tenant.id);
  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { withholdingCodeId, assetAccountId, liabilityAccountId, expenseAccountId } = body;

  if (!withholdingCodeId) {
    return NextResponse.json({ error: "withholdingCodeId requerido." }, { status: 400 });
  }

  const mapping = await upsertTaxWithholdingMapping(tenant.id, withholdingCodeId, {
    assetAccountId, liabilityAccountId, expenseAccountId,
  });
  return NextResponse.json(mapping);
}
