import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  listClassificationRules,
  createClassificationRule,
  deleteClassificationRule,
} from "@/lib/core/purchase-classification";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const rules = await listClassificationRules(tenant.id);
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  if (!body.field || !body.value || !body.categoryId) {
    return NextResponse.json({ error: "Campo, valor y categoría requeridos." }, { status: 400 });
  }

  const rule = await createClassificationRule(tenant.id, {
    field: body.field,
    operator: body.operator ?? "contains",
    value: body.value,
    categoryId: body.categoryId,
  });

  return NextResponse.json({ ok: true, rule });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido." }, { status: 400 });

  await deleteClassificationRule(tenant.id, body.id);
  return NextResponse.json({ ok: true });
}
