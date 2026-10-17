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

  let body: {
    requestId?: string;
    tenantId?: string;
    sriConfirmed?: boolean;
  };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body.requestId !== "string" || !tenantId || !workerId ||
      body.requestId !== jobId || body.tenantId !== tenantId) {
    return NextResponse.json(
      { error: "requestId and tenantId are required." },
      { status: 400 },
    );
  }

  if (body.sriConfirmed !== true) {
    return NextResponse.json({ error: "Real SRI confirmation is required; SUBMITTED is insufficient." }, { status: 409 });
  }

  try {
    const result = await finalizeSriInvoiceCancellation(
      tenantId,
      body.requestId,
      { sriConfirmed: true, workerId },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Finalization failed." },
      { status: 500 },
    );
  }
}
