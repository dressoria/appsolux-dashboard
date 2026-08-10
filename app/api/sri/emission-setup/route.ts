import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { validateThreeDigitCode } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function text(data: Record<string, unknown>, key: string) {
  return typeof data[key] === "string" ? data[key].trim() : "";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const establishmentCode = text(data, "establishmentCode");
  const establishmentName = text(data, "establishmentName");
  const address = text(data, "address");
  const issuePointCode = text(data, "issuePointCode");
  const hasPreviousInvoices = data.hasPreviousInvoices === true;
  const lastIssuedNumber = Number(data.lastIssuedNumber ?? 0);

  if (!validateThreeDigitCode(establishmentCode)) {
    return NextResponse.json({ error: "El establecimiento debe tener 3 dígitos." }, { status: 422 });
  }
  if (!validateThreeDigitCode(issuePointCode)) {
    return NextResponse.json({ error: "El punto de emisión debe tener 3 dígitos." }, { status: 422 });
  }
  if (!establishmentName) {
    return NextResponse.json({ error: "Escribe el nombre del establecimiento." }, { status: 422 });
  }
  if (!address) {
    return NextResponse.json({ error: "Escribe la dirección desde donde facturas." }, { status: 422 });
  }
  if (hasPreviousInvoices && (!Number.isSafeInteger(lastIssuedNumber) || lastIssuedNumber < 1)) {
    return NextResponse.json({ error: "Ingresa el último número de factura emitido." }, { status: 422 });
  }

  const requestedNextNumber = hasPreviousInvoices ? lastIssuedNumber + 1 : 1;
  const prisma = getPrismaClient();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.sriTaxpayerProfile.findUnique({
        where: { tenantId: tenant.id },
        select: { id: true },
      });
      if (!profile) throw new Error("Confirma primero tus datos fiscales.");

      const existingEstablishment = await tx.sriEstablishment.findUnique({
        where: { tenantId_code: { tenantId: tenant.id, code: establishmentCode } },
      });
      const establishment = existingEstablishment
        ? await tx.sriEstablishment.update({
            where: { id: existingEstablishment.id },
            data: { name: establishmentName, address, isMain: true, isActive: true },
          })
        : await tx.sriEstablishment.create({
            data: {
              tenantId: tenant.id,
              profileId: profile.id,
              code: establishmentCode,
              name: establishmentName,
              address,
              isMain: true,
              isActive: true,
            },
          });

      const existingIssuePoint = await tx.sriIssuePoint.findUnique({
        where: { establishmentId_code: { establishmentId: establishment.id, code: issuePointCode } },
      });
      const issuePoint = existingIssuePoint
        ? await tx.sriIssuePoint.update({
            where: { id: existingIssuePoint.id },
            data: { name: "Facturación", isActive: true },
          })
        : await tx.sriIssuePoint.create({
            data: {
              tenantId: tenant.id,
              establishmentId: establishment.id,
              code: issuePointCode,
              name: "Facturación",
              isActive: true,
            },
          });

      const [localHistory, existingSequence] = await Promise.all([
        tx.sriDocument.aggregate({
          where: {
            tenantId: tenant.id,
            establishmentId: establishment.id,
            issuePointId: issuePoint.id,
            documentType: "INVOICE",
            sequentialNumber: { not: null },
          },
          _max: { sequentialNumber: true },
        }),
        tx.sriDocumentSequence.findUnique({
          where: {
            tenantId_establishmentId_issuePointId_documentType: {
              tenantId: tenant.id,
              establishmentId: establishment.id,
              issuePointId: issuePoint.id,
              documentType: "INVOICE",
            },
          },
        }),
      ]);

      const minimumNextNumber = Math.max(
        (localHistory._max.sequentialNumber ?? 0) + 1,
        existingSequence?.currentNumber ?? 1
      );
      if (requestedNextNumber < minimumNextNumber) {
        throw new Error(
          `Facturom ya tiene numeración registrada. Continúa desde ${String(minimumNextNumber).padStart(9, "0")} o un número mayor.`
        );
      }

      const sequence = await tx.sriDocumentSequence.upsert({
        where: {
          tenantId_establishmentId_issuePointId_documentType: {
            tenantId: tenant.id,
            establishmentId: establishment.id,
            issuePointId: issuePoint.id,
            documentType: "INVOICE",
          },
        },
        create: {
          tenantId: tenant.id,
          establishmentId: establishment.id,
          issuePointId: issuePoint.id,
          documentType: "INVOICE",
          startNumber: requestedNextNumber,
          currentNumber: requestedNextNumber,
        },
        update: { currentNumber: requestedNextNumber, isActive: true },
      });

      return { establishment, issuePoint, sequence };
    });

    return NextResponse.json({ ok: true, nextNumber: result.sequence.currentNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la configuración de emisión.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
