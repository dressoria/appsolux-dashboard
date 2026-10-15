import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { reverseJournalEntry } from "@/lib/core/accounting-journal";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { entryId } = await params;

  const body = await req.json();
  const reversalDate = body.date ? new Date(body.date) : new Date();

  try {
    const reversal = await reverseJournalEntry(tenant.id, entryId, user.id, reversalDate);
    return NextResponse.json(reversal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al reversar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
