import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getAccountById, updateAccount, deactivateAccount } from "@/lib/core/accounting-accounts";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { accountId } = await params;

  const account = await getAccountById(tenant.id, accountId);
  if (!account) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
  return NextResponse.json(account);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { accountId } = await params;

  const body = await req.json();
  const account = await updateAccount(tenant.id, accountId, body);
  return NextResponse.json(account);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { accountId } = await params;

  try {
    await deactivateAccount(tenant.id, accountId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al desactivar cuenta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
