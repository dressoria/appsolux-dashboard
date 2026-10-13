import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db/prisma";
import { validateHmacRequest, hashBody } from "@/lib/core/purchase-sync-hmac";
import { importPurchaseXml } from "@/lib/core/purchase-xml-import";

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
    return NextResponse.json(
      { error: hmacResult.error },
      { status: 403 },
    );
  }

  const prisma = getPrismaClient();
  const job = await prisma.purchaseSriSyncJob.findFirst({
    where: { id: jobId, status: "RUNNING" },
    select: { tenantId: true },
  });

  if (!job) {
    return NextResponse.json(
      { error: "Job no encontrado o no está en ejecución." },
      { status: 400 },
    );
  }
  if (job.tenantId !== tenantId) {
    return NextResponse.json(
      { error: "El tenant del job no coincide." },
      { status: 403 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, taxIdentificationNormalized: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  }

  const xmlContent = bodyText;
  if (!xmlContent || !xmlContent.includes("<")) {
    return NextResponse.json(
      { error: "XML inválido.", code: "INVALID_XML" },
      { status: 400 },
    );
  }

  const result = await importPurchaseXml(
    tenantId,
    "system",
    xmlContent,
    tenant.taxIdentificationNormalized,
  );

  if (result.ok) {
    return NextResponse.json({ status: "IMPORTED", purchaseDocumentId: result.purchaseDocumentId });
  }

  if (result.error.includes("ya está registrado")) {
    return NextResponse.json({ status: "ALREADY_EXISTS" });
  }
  if (result.error.includes("no corresponde")) {
    return NextResponse.json({ status: "WRONG_RECEIVER", error: result.error }, { status: 400 });
  }

  return NextResponse.json({ status: "INVALID", error: result.error }, { status: 400 });
}
