import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { gateModuleApiAccess } from "@/lib/core/capabilities";
import { importPurchaseXml, parsePurchaseXml } from "@/lib/core/purchase-xml-import";
import { getPrismaClient } from "@/lib/db/prisma";
import { receivedXmlInputError } from "@/lib/core/sri-tax/received-import-input";

export async function POST(req: NextRequest) {
  const { user, tenant } = await requireDashboardSession();
  const gate = await gateModuleApiAccess(tenant.id, "purchases");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const contentType = req.headers.get("content-type") ?? "";

  let xmlString: string;
  let parseOnly = false;

  if (contentType.includes("application/json")) {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !("xml" in body)) return NextResponse.json({ ok: false, error: "XML requerido." }, { status: 400 });
    if (typeof body.xml !== "string") return NextResponse.json({ ok: false, error: "XML requerido." }, { status: 400 });
    xmlString = body.xml;
    parseOnly = "parseOnly" in body && body.parseOnly === true;
    if (typeof xmlString !== "string" || !xmlString.trim()) return NextResponse.json({ ok: false, error: "XML requerido." }, { status: 400 });
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Archivo XML requerido." }, { status: 400 });
    if (!(file instanceof File) || file.size > 4 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Archivo XML inválido o mayor a 4 MB." }, { status: 400 });
    xmlString = await file.text();
  }

  if (Buffer.byteLength(xmlString, "utf8") > 4 * 1024 * 1024) return NextResponse.json({ ok: false, error: "El XML no puede superar 4 MB." }, { status: 400 });
  if (parseOnly) {
    const parsed = parsePurchaseXml(xmlString);
    return NextResponse.json({ ok: true, parsed });
  }

  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId: tenant.id },
    select: { ruc: true },
  });

  const inputError = receivedXmlInputError(xmlString, profile?.ruc);
  if (inputError) return NextResponse.json({ ok: false, error: inputError }, { status: 422 });
  const result = await importPurchaseXml(tenant.id, user.id, xmlString, profile?.ruc);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ...result, reviewRequired: true, authorizationVerification: "NOT_PERFORMED" });
}
