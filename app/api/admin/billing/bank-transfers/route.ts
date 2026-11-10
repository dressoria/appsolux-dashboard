import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertBillingReviewAdmin } from "@/lib/auth/billing-review-admin";
import { listAllTransferRequests } from "@/lib/core/billing/bank-transfer-service";
import type { BankTransferRequestStatus } from "@prisma/client";

export const runtime = "nodejs";

const VALID_STATUSES = new Set([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "ACTIVATION_FAILED",
  "INVOICING_PENDING",
  "INVOICING_FAILED",
]);

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    }

    assertBillingReviewAdmin(user);

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const search = url.searchParams.get("search") ?? undefined;

    const status =
      statusParam && VALID_STATUSES.has(statusParam)
        ? (statusParam as BankTransferRequestStatus)
        : undefined;

    const requests = await listAllTransferRequests({ status, search });

    return NextResponse.json({
      ok: true,
      requests: requests.map((r) => ({
        ...r,
        amountUsd: Number(r.amountUsd),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error.";
    const status = message.includes("requerido") ? 403 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
