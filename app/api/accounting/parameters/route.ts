import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getMappings, upsertMappings, deleteMapping } from "@/lib/core/accounting-parameters";
import type { AccountingAccountMappingKey } from "@prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const mappings = await getMappings(tenant.id);
  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { mappings, action, key } = body;

  if (action === "delete" && key) {
    await deleteMapping(tenant.id, key as AccountingAccountMappingKey);
    return NextResponse.json({ ok: true });
  }

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return NextResponse.json({ error: "Se requiere un arreglo de mappings." }, { status: 400 });
  }

  const result = await upsertMappings(tenant.id, mappings);
  return NextResponse.json(result);
}
