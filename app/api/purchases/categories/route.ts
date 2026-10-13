import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  listAccountingCategories,
  createAccountingCategory,
} from "@/lib/core/purchase-documents";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const categories = await listAccountingCategories(tenant.id);
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });
  }

  try {
    const category = await createAccountingCategory(tenant.id, body.name.trim());
    return NextResponse.json({ ok: true, category });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error." },
      { status: 400 },
    );
  }
}
