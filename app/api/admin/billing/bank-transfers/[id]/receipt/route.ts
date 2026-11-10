import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertBillingReviewAdmin } from "@/lib/auth/billing-review-admin";
import { readReceiptAsAdmin } from "@/lib/core/billing/receipt-storage";
import { getPrismaClient } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
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
      select: { receiptFileId: true, receiptFileName: true, receiptFileType: true },
    });

    if (!transferRequest) {
      return NextResponse.json({ ok: false, message: "Solicitud no encontrada." }, { status: 404 });
    }

    const buffer = await readReceiptAsAdmin(transferRequest.receiptFileId);
    const bytes = new Uint8Array(buffer);

    const safeName = transferRequest.receiptFileName
      .replace(/[^\w.\-]/g, "_")
      .slice(0, 200);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": transferRequest.receiptFileType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error.";
    const status = message.includes("requerido") ? 403 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
