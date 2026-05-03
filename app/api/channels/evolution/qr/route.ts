import { NextResponse } from "next/server";
import { getSafeEvolutionError } from "@/lib/api/evolution/client";
import {
  getEvolutionConnectionState,
  getEvolutionQr,
} from "@/lib/api/evolution/qr";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
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
    const evolutionIntegration = await getTenantIntegrationByProvider(
      tenant.id,
      "evolution"
    ).catch(() => null);
    const instanceName =
      evolutionIntegration?.externalInstanceName?.trim() ??
      tenant.channels.evolution?.instance_name?.trim();

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

    console.info("[Evolution] QR request", {
      instanceName,
      endpoint: `/instance/connect/${instanceName}`,
      method: "GET",
    });

    const qr = await getEvolutionQr(instanceName);

    return NextResponse.json({
      success: true,
      ok: true,
      instanceName,
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
    const safeError = getSafeEvolutionError(error);

    if (safeError.status === 400) {
      try {
        const user = await getCurrentUser();
        const tenant = user ? await getCurrentTenant(user) : null;
        const evolutionIntegration = tenant
          ? await getTenantIntegrationByProvider(tenant.id, "evolution").catch(
              () => null
            )
          : null;
        const instanceName =
          evolutionIntegration?.externalInstanceName?.trim() ??
          tenant?.channels.evolution?.instance_name?.trim();

        if (instanceName) {
          const state = await getEvolutionConnectionState(instanceName);

          if (state.status === "connected") {
            return NextResponse.json({
              success: true,
              ok: true,
              instanceName,
              data: {
                tenant: tenant
                  ? {
                      id: tenant.id,
                      name: tenant.name,
                      slug: tenant.slug,
                    }
                  : undefined,
                evolution: {
                  instance_name: instanceName,
                  status: state.status,
                  qr_code: null,
                  base64: null,
                },
              },
            });
          }
        }
      } catch (stateError) {
        const stateSafeError = getSafeEvolutionError(stateError);
        console.warn("[Evolution] Connection state check failed", {
          status: stateSafeError.status,
          detail: stateSafeError.detail,
        });
      }
    }

    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: safeError.message,
        detail: safeError.detail,
        error: {
          code: "EVOLUTION_QR_ERROR",
          message: safeError.message,
          detail: safeError.detail,
        },
      },
      { status: safeError.status }
    );
  }
}
