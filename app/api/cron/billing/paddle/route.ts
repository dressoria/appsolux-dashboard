import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processPaddleInbox } from "@/lib/core/billing/paddle-inbox";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, results: await processPaddleInbox() });
}
