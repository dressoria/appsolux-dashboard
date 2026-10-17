import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  checkCancellationEligibility,
  requestSriInvoiceCancellation,
  getCancellationRequestsForDocument,
} from "@/lib/core/sri-cancellation";
import type { SriCancellationReason } from "@prisma/client";

type Props = { params: Promise<{ documentId: string }> };

const VALID_REASONS: SriCancellationReason[] = [
  "EMISSION_ERROR",
  "OPERATION_NOT_OCCURRED",
];

export async function GET(_req: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const [eligibility, requests] = await Promise.all([
    checkCancellationEligibility(tenant.id, documentId),
    getCancellationRequestsForDocument(tenant.id, documentId),
  ]);

  return NextResponse.json({ eligibility, requests });
}

export async function POST(req: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const body = (await req.json()) as {
    reasonCode?: string;
    reasonText?: string;
  };

  if (!body.reasonCode || !VALID_REASONS.includes(body.reasonCode as SriCancellationReason)) {
    return NextResponse.json(
      { ok: false, message: "Motivo de anulación inválido." },
      { status: 400 },
    );
  }

  try {
    const request = await requestSriInvoiceCancellation({
      tenantId: tenant.id,
      sriDocumentId: documentId,
      reasonCode: body.reasonCode as SriCancellationReason,
      reasonText: body.reasonText,
      requestedByUserId: user.id,
    });

    return NextResponse.json({ ok: true, request });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo solicitar la anulación." },
      { status: 400 },
    );
  }
}
