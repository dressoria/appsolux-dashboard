import { NextRequest, NextResponse } from "next/server";

import { runDailySriSyncScheduler } from "@/lib/core/sales-sri-scheduler";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailySriSyncScheduler();

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
