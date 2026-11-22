import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { generateRenewalReminders } from "@/lib/core/billing/renewal-reminders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await generateRenewalReminders();

  return NextResponse.json({ ok: true, ...result });
}
