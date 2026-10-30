import { NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { createIngestToken, listIngestTokens, revokeIngestToken } from "@/lib/core/sales-ingest-tokens";

export async function GET() {
  const { tenant } = await requireDashboardSession();
  const tokens = await listIngestTokens(tenant.id);
  return NextResponse.json({ ok: true, tokens });
}

export async function POST(request: Request) {
  const { tenant } = await requireDashboardSession();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const source = body.source as string;
  if (!["API", "TELEGRAM"].includes(source)) {
    return NextResponse.json({ ok: false, error: "source must be API or TELEGRAM." }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : undefined;
  const result = await createIngestToken(tenant.id, source as "API" | "TELEGRAM", label);

  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(request: Request) {
  const { tenant } = await requireDashboardSession();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const tokenId = body.tokenId as string;
  if (!tokenId) {
    return NextResponse.json({ ok: false, error: "tokenId required." }, { status: 400 });
  }

  await revokeIngestToken(tenant.id, tokenId);
  return NextResponse.json({ ok: true });
}
