import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getProforma, updateProforma } from "@/lib/core/lightweight-proformas";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type Context = { params: Promise<{ proformaId: string }> };

function readPayload(
  body: Record<string, unknown>,
  tenantId: string,
  user: { id: string; name: string },
) {
  const parseDate = (value: unknown, fallback?: Date) => {
    const result = typeof value === "string" ? new Date(value) : fallback;
    if (!result || Number.isNaN(result.getTime()))
      throw new Error("Fecha inválida.");
    return result;
  };
  return {
    tenantId,
    userId: user.id,
    userName: user.name,
    customerId:
      typeof body.customerId === "string" ? body.customerId : undefined,
    establishmentId:
      typeof body.establishmentId === "string"
        ? body.establishmentId
        : undefined,
    issueDate: parseDate(body.issueDate, new Date()),
    validUntil: body.validUntil ? parseDate(body.validUntil) : undefined,
    observation:
      typeof body.observation === "string" ? body.observation : undefined,
    items: Array.isArray(body.items)
      ? body.items.map((value) => {
          const item = value as Record<string, unknown>;
          return {
            productId: String(item.productId ?? ""),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount ?? 0),
            taxRate: Number(item.taxRate ?? 0),
            observation:
              typeof item.observation === "string"
                ? item.observation
                : undefined,
          };
        })
      : [],
  };
}

export async function GET(_: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const [tenant, { proformaId }] = await Promise.all([
    getCurrentTenant(user),
    context.params,
  ]);
  const proforma = await getProforma(tenant.id, proformaId);
  if (!proforma) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, proforma });
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const [tenant, { proformaId }, body] = await Promise.all([
      getCurrentTenant(user),
      context.params,
      request.json(),
    ]);
    const proforma = await updateProforma(
      proformaId,
      readPayload(body, tenant.id, user),
    );
    return NextResponse.json({ ok: true, proforma });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la proforma.",
      },
      { status: 400 },
    );
  }
}
