import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { validateReceiptFile, getExtension } from "@/lib/core/billing/file-validation";
import { saveReceipt } from "@/lib/core/billing/receipt-storage";
import {
  createBankTransferRequest,
  getBankTransferInfo,
} from "@/lib/core/billing/bank-transfer-service";
import type { CommercialPlanCode } from "@/lib/core/billing/commercial-plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export const runtime = "nodejs";

const VALID_PLAN_CODES = new Set(["BASIC", "BUSINESS", "ENTERPRISE"]);
const VALID_INTERVALS = new Set(["MONTHLY", "YEARLY"]);

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    }

    if (!isTenantOwner(user)) {
      return NextResponse.json(
        { ok: false, message: "Solo el propietario puede gestionar pagos." },
        { status: 403 },
      );
    }

    const tenant = await getCurrentTenant(user);
    const formData = await request.formData();

    const planCode = formData.get("planCode");
    const billingInterval = formData.get("billingInterval");
    const bankReference = formData.get("bankReference");
    const receipt = formData.get("receipt");

    if (typeof planCode !== "string" || !VALID_PLAN_CODES.has(planCode)) {
      return NextResponse.json({ ok: false, message: "Plan inválido." }, { status: 400 });
    }
    if (typeof billingInterval !== "string" || !VALID_INTERVALS.has(billingInterval)) {
      return NextResponse.json({ ok: false, message: "Intervalo inválido." }, { status: 400 });
    }
    if (typeof bankReference !== "string" || !bankReference.trim() || bankReference.trim().length > 100) {
      return NextResponse.json(
        { ok: false, message: "El número de referencia bancaria es obligatorio (máximo 100 caracteres)." },
        { status: 400 },
      );
    }
    if (!(receipt instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "El comprobante de pago es obligatorio." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await receipt.arrayBuffer());
    const validation = validateReceiptFile(buffer, receipt.name, receipt.size);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, message: validation.message }, { status: 400 });
    }

    const ext = getExtension(receipt.name);
    const fileId = await saveReceipt(tenant.id, ext, buffer);

    const transferRequest = await createBankTransferRequest({
      tenantId: tenant.id,
      requestedById: user.id,
      planCode: planCode as CommercialPlanCode,
      billingInterval: billingInterval as "MONTHLY" | "YEARLY",
      bankReference: bankReference.trim(),
      receiptFileId: fileId,
      receiptFileName: receipt.name.replace(/[^\w.\-]/g, "_").slice(0, 200),
      receiptFileType: validation.detectedMime,
      receiptFileSizeBytes: buffer.length,
    });

    return NextResponse.json({ ok: true, requestId: transferRequest.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Error al enviar la solicitud." },
      { status: 400 },
    );
  }
}

export async function GET() {
  try {
    const planCode = "BASIC" as CommercialPlanCode;
    const info = getBankTransferInfo(planCode, "MONTHLY");
    return NextResponse.json({
      ok: true,
      accountNumber: info.accountNumber,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
