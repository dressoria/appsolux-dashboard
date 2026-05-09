import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { createCustomer } from "@/lib/core/lightweight-pos";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Sesion requerida." } },
        { status: 401 }
      );
    }

    const { conversationId } = await context.params;
    const parsedId = Number(conversationId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "Conversacion invalida." } },
        { status: 400 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const name = getString(body, "name");
    const phone = getString(body, "phone");
    const email = getString(body, "email");

    if (!name && !phone) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Se requiere al menos nombre o telefono." },
        },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    // Check for existing customer by phone or email to avoid duplicates
    const existing = await prisma.lightweightCustomer.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: { customer: { ...existing, balance: Number(existing.balance) }, created: false },
      });
    }

    const customer = await createCustomer({
      tenantId: tenant.id,
      name: name || phone,
      phone: phone || undefined,
      email: email || undefined,
    });

    return NextResponse.json({
      success: true,
      data: { customer: { ...customer, balance: Number(customer.balance) }, created: true },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CUSTOMER_CREATE_ERROR",
          message: error instanceof Error ? error.message : "No se pudo crear el cliente.",
        },
      },
      { status: 400 }
    );
  }
}
