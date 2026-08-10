"use server";

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { requireAppUser } from "@/lib/auth/require-app-user";
import {
  isValidEcuadorCedula,
  isValidEcuadorRuc,
  normalizeEcuadorIdentification,
  type TaxIdentificationType,
} from "@/lib/onboarding/ecuador-identification";
import { bootstrapAuthenticatedUserTenant } from "@/lib/onboarding/bootstrap-authenticated-user";

export type OnboardingActionState = {
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const allowedIdentificationTypes = new Set<TaxIdentificationType>(["ruc", "cedula", "none"]);

function valueOf(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeEcuadorPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("593")) return `+${digits}`;
  return `+593${digits.replace(/^0/, "")}`;
}

export async function createTenantAction(
  _previousState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const user = await requireAppUser();

  if (user.tenant?.id) redirect(routes.workspace);

  const rawType = valueOf(formData, "tax_identification_type");
  const taxIdentificationType = allowedIdentificationTypes.has(rawType as TaxIdentificationType)
    ? (rawType as TaxIdentificationType)
    : "ruc";
  const tradeName = valueOf(formData, "trade_name");
  const legalName = valueOf(formData, "legal_name");
  const identification = normalizeEcuadorIdentification(valueOf(formData, "tax_identification_value"));
  const address = valueOf(formData, "address");
  const phone = normalizeEcuadorPhone(valueOf(formData, "phone"));
  const contactEmail = valueOf(formData, "contact_email").toLowerCase();
  const province = valueOf(formData, "province");
  const city = valueOf(formData, "city");
  const fieldErrors: Record<string, string> = {};

  if (taxIdentificationType === "ruc" && !isValidEcuadorRuc(identification)) {
    fieldErrors.tax_identification_value = "Ingresa un RUC válido de 13 dígitos.";
  }
  if (taxIdentificationType === "cedula" && !isValidEcuadorCedula(identification)) {
    fieldErrors.tax_identification_value = "Ingresa una cédula ecuatoriana válida.";
  }
  if (taxIdentificationType !== "none" && !legalName) {
    fieldErrors.legal_name = taxIdentificationType === "cedula"
      ? "Escribe tu nombre completo."
      : "Escribe la razón social.";
  }
  if (taxIdentificationType !== "none" && !address) {
    fieldErrors.address = "Escribe la dirección principal.";
  }
  if (taxIdentificationType === "none" && !tradeName) {
    fieldErrors.trade_name = "Escribe el nombre de tu negocio.";
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    fieldErrors.contact_email = "Ingresa un correo válido.";
  }
  if (phone && !/^\+593\d{8,10}$/.test(phone)) {
    fieldErrors.phone = "Ingresa un teléfono ecuatoriano válido.";
  }

  const companyName = tradeName || legalName;
  if (!companyName) fieldErrors.trade_name = "Escribe el nombre de tu negocio.";

  if (Object.keys(fieldErrors).length > 0) {
    return { message: "Revisa los campos marcados para continuar.", fieldErrors };
  }

  try {
    await bootstrapAuthenticatedUserTenant({
      userId: user.id,
      email: user.email,
      name: user.name,
      companyName,
      legalName: legalName || undefined,
      taxIdentificationType,
      taxIdentificationValue: taxIdentificationType === "none" ? undefined : identification,
      phone,
      contactEmail: contactEmail || undefined,
      province: province || undefined,
      city: city || undefined,
      address: address || undefined,
    });
  } catch (error) {
    console.error("[onboarding] tenant creation failed", error);
    return { message: "No pudimos crear tu negocio. Inténtalo nuevamente." };
  }

  redirect(routes.workspace);
}
