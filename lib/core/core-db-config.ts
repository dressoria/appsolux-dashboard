import "@/lib/security/server-only";

export function isCoreDbRequired() {
  const explicitValue = process.env.APPSOLUX_CORE_DB_REQUIRED?.trim().toLowerCase();

  if (explicitValue === "true") {
    return true;
  }

  if (explicitValue === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export function isCoreDbConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getCoreDbUnavailableMessage() {
  return "No pudimos registrar la solicitud porque la base central de Appsolux no esta disponible.";
}
