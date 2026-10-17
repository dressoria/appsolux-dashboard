import { NextRequest, NextResponse } from "next/server";
import { validateHmacRequest, hashBody } from "@/lib/core/purchase-sync-hmac";
import { finalizeSriInvoiceCancellation } from "@/lib/core/sri-cancellation";

export async function POST(req: NextRequest) {
  const timestamp = req.headers.get("x-facturom-timestamp");
  const signature = req.headers.get("x-facturom-signature");
  const workerId = req.headers.get("x-facturom-worker");
  const jobId = req.headers.get("x-facturom-job-id") ?? "";
  const tenantId = req.headers.get("x-facturom-tenant-id") ?? "";

  const bodyText = await req.text();
  const bodyDigest = hashBody(bodyText);

  const hmacResult = validateHmacRequest({
    timestamp,
    signature,
    workerId,
    jobId,
    tenantId,
    bodyHash: bodyDigest,
  });

  if (!hmacResult.valid) {
    return NextResponse.json({ error: hmacResult.error }, { status: 403 });
  }

  const body = JSON.parse(bodyText) as {
    requestId?: string;
    confirmedByUserId?: string;
  };

  if (!body.requestId || !tenantId) {
    return NextResponse.json(
      { error: "requestId and tenantId are required." },
      { status: 400 },
    );
  }

  try {
    const result = await finalizeSriInvoiceCancellation(
      tenantId,
      body.requestId,
      body.confirmedByUserId ?? "worker",
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Finalization failed." },
      { status: 500 },
    );
  }
}
