import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getJournalEntries, createJournalEntry } from "@/lib/core/accounting-journal";
import { ensurePeriodOpen } from "@/lib/core/accounting-periods";
import type { AccountingJournalEntryStatus, AccountingSourceType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const sp = req.nextUrl.searchParams;
  const result = await getJournalEntries(tenant.id, {
    status: (sp.get("status") as AccountingJournalEntryStatus) || undefined,
    sourceType: (sp.get("sourceType") as AccountingSourceType) || undefined,
    dateFrom: sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : undefined,
    dateTo: sp.get("dateTo") ? new Date(sp.get("dateTo")!) : undefined,
    search: sp.get("search") || undefined,
    page: sp.get("page") ? parseInt(sp.get("page")!, 10) : undefined,
    pageSize: sp.get("pageSize") ? parseInt(sp.get("pageSize")!, 10) : undefined,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { date, description, sourceType, sourceId, lines } = body;

  if (!date || !description || !Array.isArray(lines)) {
    return NextResponse.json({ error: "Campos obligatorios: date, description, lines." }, { status: 400 });
  }

  const entryDate = new Date(date);

  try {
    await ensurePeriodOpen(tenant.id, entryDate);
    const entry = await createJournalEntry(
      tenant.id,
      { date: entryDate, description, sourceType, sourceId, lines },
      user.id,
    );
    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear asiento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
