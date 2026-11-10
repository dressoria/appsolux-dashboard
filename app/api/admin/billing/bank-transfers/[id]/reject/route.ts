import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertBillingReviewAdmin } from "@/lib/auth/billing-review-admin";
import { rejectBankTransfer } from "@/lib/core/billing/bank-transfer-service";

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
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";

    if (!adminNote) {
      return NextResponse.json(
        { ok: false, message: "Debe proporcionar un motivo para el rechazo." },
        { status: 400 },
      );
    }

    await rejectBankTransfer({
      requestId: id,
      adminUserId: user.id,
      adminNote,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al rechazar.";
    const status = message.includes("requerido") ? 403 : 400;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
