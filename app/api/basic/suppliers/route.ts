import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createSupplier,
  type SupplierInput,
} from "@/lib/core/lightweight-suppliers";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  validateTenantMembership,
  validateRelatedSupplier,
} from "@/lib/core/people-validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json(
        { message: "Sesión requerida." },
        { status: 401 },
      );
    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Omit<SupplierInput, "tenantId">;

    if (body.assignedBuyerId) {
      await validateTenantMembership(
        tenant.id,
        body.assignedBuyerId,
        "comprador",
      );
    }

    if (body.relatedSupplierId) {
      await validateRelatedSupplier(tenant.id, body.relatedSupplierId);
    }

    return NextResponse.json(
      { supplier: await createSupplier({ ...body, tenantId: tenant.id }) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear el proveedor.",
      },
      { status: 400 },
    );
  }
}
