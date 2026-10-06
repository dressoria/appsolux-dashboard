import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  updateSupplier,
  type SupplierInput,
} from "@/lib/core/lightweight-suppliers";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type Context = { params: Promise<{ supplierId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json(
        { message: "Sesión requerida." },
        { status: 401 },
      );
    const tenant = await getCurrentTenant(user);
    const { supplierId } = await context.params;
    const body = (await request.json()) as Omit<
      SupplierInput,
      "tenantId" | "supplierId"
    >;
    return NextResponse.json({
      supplier: await updateSupplier({
        ...body,
        tenantId: tenant.id,
        supplierId,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el proveedor.",
      },
      { status: 400 },
    );
  }
}
