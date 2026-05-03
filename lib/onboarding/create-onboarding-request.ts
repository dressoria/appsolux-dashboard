import "@/lib/security/server-only";
import type {
  CreateOnboardingRequestInput,
  NormalizedOnboardingRequest,
} from "./types";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptional(value: string) {
  return value ? value : undefined;
}

export function createOnboardingRequest(
  body: unknown
): NormalizedOnboardingRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Solicitud de registro invalida.");
  }

  const record = body as Record<string, unknown>;
  const input: CreateOnboardingRequestInput = {
    user_name: getStringField(record, "user_name") || getStringField(record, "name"),
    email: getStringField(record, "email").toLowerCase(),
    company_name:
      getStringField(record, "company_name") || getStringField(record, "company"),
    phone: normalizeOptional(getStringField(record, "phone")),
    business_type: normalizeOptional(getStringField(record, "business_type")),
    country: normalizeOptional(getStringField(record, "country")),
    base_currency: normalizeOptional(getStringField(record, "base_currency")),
    initial_plan: normalizeOptional(getStringField(record, "initial_plan")),
    source: normalizeOptional(getStringField(record, "source")),
  };

  if (!input.user_name) {
    throw new Error("El nombre es requerido.");
  }

  if (!input.email || !input.email.includes("@")) {
    throw new Error("Ingresa un correo valido.");
  }

  if (!input.company_name) {
    throw new Error("El nombre de empresa es requerido.");
  }

  return {
    user_name: input.user_name,
    email: input.email,
    company_name: input.company_name,
    phone: input.phone,
    business_type: input.business_type,
    country: input.country,
    base_currency: input.base_currency,
    initial_plan: input.initial_plan,
    source: input.source ?? "appsolux_register",
  };
}
