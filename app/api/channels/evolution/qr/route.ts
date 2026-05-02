import { NextResponse } from "next/server";
import { getEvolutionQr } from "@/lib/api/evolution/qr";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const instanceName = tenant.channels.evolution?.instance_name?.trim();

    if (!instanceName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_EVOLUTION_INSTANCE_NAME",
            message: "Tenant does not have an Evolution instance configured",
          },
        },
        { status: 400 }
      );
    }

    const qr = await getEvolutionQr(instanceName);

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        evolution: {
          instance_name: instanceName,
          status: qr.status,
          qr_code: qr.qr_code,
          base64: qr.base64,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected Evolution QR error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "EVOLUTION_QR_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
