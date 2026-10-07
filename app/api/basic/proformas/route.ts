import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createProforma,
  listProformas,
} from "@/lib/core/lightweight-proformas";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function date(value: unknown, fallback?: Date) {
  const parsed = typeof value === "string" ? new Date(value) : fallback;
  if (!parsed || Number.isNaN(parsed.getTime()))
    throw new Error("Fecha inválida.");
  return parsed;
}

function payload(
  body: Record<string, unknown>,
  tenantId: string,
  user: { id: string; name: string },
) {
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
    issueDate: date(body.issueDate, new Date()),
    validUntil: body.validUntil ? date(body.validUntil) : undefined,
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

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const params = new URL(request.url).searchParams;
  const proformas = await listProformas(tenant.id, {
    search: params.get("search") ?? undefined,
    from: params.get("from") ? date(params.get("from")) : undefined,
    to: params.get("to") ? date(`${params.get("to")}T23:59:59.999`) : undefined,
  });
  return NextResponse.json({ ok: true, proformas });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const tenant = await getCurrentTenant(user);
    const proforma = await createProforma(
      payload(await request.json(), tenant.id, user),
    );
    return NextResponse.json({ ok: true, proforma }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la proforma.",
      },
      { status: 400 },
    );
  }
}
