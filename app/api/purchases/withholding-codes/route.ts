import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const prisma = getPrismaClient();
  const codes = await prisma.taxWithholdingCode.findMany({
    where: { isActive: true },
    orderBy: [{ taxType: "asc" }, { code: "asc" }],
  });

  return NextResponse.json(codes);
}
