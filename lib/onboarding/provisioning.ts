import "@/lib/security/server-only";
import { registerTenantViaN8n } from "@/lib/api/n8n/provision";
import type {
  NormalizedOnboardingRequest,
  OnboardingProvisioningResult,
} from "./types";

export async function provisionOnboardingRequest(
  request: NormalizedOnboardingRequest
): Promise<OnboardingProvisioningResult> {
  try {
    const result = await registerTenantViaN8n({
      name: request.user_name,
      email: request.email,
      company: request.company_name,
      phone: request.phone,
      business_type: request.business_type,
      country: request.country,
      base_currency: request.base_currency,
      initial_plan: request.initial_plan,
      source: request.source,
    });

    if (!result.success) {
      return {
        status: "failed",
        message:
          result.error ??
          "No pudimos preparar tu cuenta. Intenta nuevamente en unos minutos.",
      };
    }

    return {
      status: "ready",
      message: "Tu entorno de Appsolux esta listo.",
      user: result.user,
    };
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "No pudimos iniciar la configuracion.";
    const message = rawMessage.includes("N8N_REGISTER_WEBHOOK_URL")
      ? "Falta configurar N8N_REGISTER_WEBHOOK_URL para procesar registros."
      : rawMessage;

    return {
      status: "failed",
      message,
    };
  }
}
