import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { lookupSriTaxpayer } from "@/lib/core/sri-taxpayer-lookup";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ found: false, message: "Sesión requerida." }, { status: 401 });
    await getCurrentTenant(user);
    const identification = new URL(request.url).searchParams.get("identification")?.trim() ?? "";
    return NextResponse.json(await lookupSriTaxpayer(identification));
  } catch (error) {
    return NextResponse.json({ found: false, message: error instanceof Error ? error.message : "No se pudo consultar la identificación." }, { status: 400 });
  }
}
