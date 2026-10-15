import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { postJournalEntry } from "@/lib/core/accounting-journal";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { entryId } = await params;

  try {
    const entry = await postJournalEntry(tenant.id, entryId, user.id);
    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al contabilizar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
