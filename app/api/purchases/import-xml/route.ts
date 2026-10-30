import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { importPurchaseXml, parsePurchaseXml } from "@/lib/core/purchase-xml-import";
import { getPrismaClient } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const { user, tenant } = await requireDashboardSession();

  const contentType = req.headers.get("content-type") ?? "";

  let xmlString: string;
  let parseOnly = false;

  if (contentType.includes("application/json")) {
    const body = await req.json();
    xmlString = body.xml;
    parseOnly = !!body.parseOnly;
    if (!xmlString) return NextResponse.json({ ok: false, error: "XML requerido." }, { status: 400 });
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Archivo XML requerido." }, { status: 400 });
    xmlString = await file.text();
  }

  if (parseOnly) {
    const parsed = parsePurchaseXml(xmlString);
    return NextResponse.json({ ok: true, parsed });
  }

  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId: tenant.id },
    select: { ruc: true },
  });

  const result = await importPurchaseXml(tenant.id, user.id, xmlString, profile?.ruc);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
