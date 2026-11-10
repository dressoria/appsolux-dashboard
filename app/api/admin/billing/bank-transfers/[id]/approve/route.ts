import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertBillingReviewAdmin } from "@/lib/auth/billing-review-admin";
import { approveBankTransfer } from "@/lib/core/billing/bank-transfer-service";
import { getPrismaClient } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    }

    assertBillingReviewAdmin(user);

    const { id } = await params;

    const prisma = getPrismaClient();
    const transferRequest = await prisma.bankTransferRequest.findUnique({
      where: { id },
      select: { tenantId: true, status: true },
    });

    if (!transferRequest) {
      return NextResponse.json({ ok: false, message: "Solicitud no encontrada." }, { status: 404 });
    }

    if (transferRequest.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { ok: false, message: "Esta solicitud ya fue procesada." },
        { status: 409 },
      );
    }

    const adminMembership = await prisma.membership.findFirst({
      where: { userId: user.id, tenantId: transferRequest.tenantId },
    });
    if (adminMembership) {
      return NextResponse.json(
        { ok: false, message: "No puedes aprobar una solicitud de tu propia empresa." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote : undefined;

    const result = await approveBankTransfer({
      requestId: id,
      adminUserId: user.id,
      adminNote,
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: result.subscription.id,
      periodStart: result.period.startsAt.toISOString(),
      periodEnd: result.period.endsAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al aprobar.";
    const status = message.includes("requerido") ? 403 : 400;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
