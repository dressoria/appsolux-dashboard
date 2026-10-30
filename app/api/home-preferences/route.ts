import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  getUserShortcutKeys,
  saveUserShortcutKeys,
  getShortcutCatalog,
} from "@/lib/core/home-preferences";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const keys = await getUserShortcutKeys(user.id, tenant.id);
  const catalog = getShortcutCatalog();

  return NextResponse.json({ success: true, data: { keys, catalog } });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("keys" in body)) {
    return NextResponse.json({ error: "Campo 'keys' requerido." }, { status: 400 });
  }

  try {
    await saveUserShortcutKeys(user.id, tenant.id, (body as { keys: unknown }).keys as string[]);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
