import { NextResponse } from "next/server";
import { publicLegalBundle, legalErrorResponse } from "@/lib/legal/service";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ bundle: await publicLegalBundle() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { const legal = legalErrorResponse(error); return NextResponse.json({ message: legal?.message ?? "Condiciones legales temporalmente no disponibles.", code: legal?.code ?? "LEGAL_UNAVAILABLE" }, { status: legal?.status ?? 503 }); }
}
