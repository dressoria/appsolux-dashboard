import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isValidEcuadorRuc } from "@/lib/core/ecuador-tax-id";
import { PrismaSriTaxpayerStore } from "@/lib/core/sri-data-service";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = { params: Promise<{ identification: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
  await getCurrentTenant(user);

  const identification = (await context.params).identification.replace(
    /\D/g,
    "",
  );
  if (!isValidEcuadorRuc(identification))
    return NextResponse.json({ message: "RUC no válido." }, { status: 400 });

  const record = await new PrismaSriTaxpayerStore(getPrismaClient()).findByRuc(
    identification,
  );
  if (!record)
    return NextResponse.json({ found: false, identification }, { status: 404 });

  return NextResponse.json({
    found: true,
    data: {
      identification: record.ruc,
      legalName: record.legalName,
      tradeName: record.tradeName,
      taxpayerStatus: record.taxpayerStatus,
      taxpayerType: record.taxpayerType,
      economicActivity: record.economicActivity,
      province: record.province,
      city: record.city,
      parish: record.parish,
      source: record.source,
    },
    sourceUpdatedAt: record.sourceUpdatedAt?.toISOString(),
  });
}
