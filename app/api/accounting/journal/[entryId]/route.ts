import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getJournalEntryById } from "@/lib/core/accounting-journal";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { entryId } = await params;

  const entry = await getJournalEntryById(tenant.id, entryId);
  if (!entry) return NextResponse.json({ error: "Asiento no encontrado." }, { status: 404 });
  return NextResponse.json(entry);
}
