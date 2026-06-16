export type ServiceConfig = {
  enabled: boolean;
  baseUrl: string | null;
};

function readBoolEnv(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readUrlEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

export function getErpServiceConfig(): ServiceConfig {
  return {
    enabled: readBoolEnv("ERP_ENABLED"),
    baseUrl: readUrlEnv("ERPNEXT_BASE_URL"),
  };
}

export function getN8nServiceConfig(): ServiceConfig {
  return {
    enabled: readBoolEnv("N8N_ENABLED"),
    baseUrl: readUrlEnv("N8N_BASE_URL"),
  };
}

export function getChatwootServiceConfig(): ServiceConfig {
  return {
    enabled: readBoolEnv("CHATWOOT_ENABLED"),
    baseUrl: readUrlEnv("CHATWOOT_BASE_URL"),
  };
}

export function getEvolutionServiceConfig(): ServiceConfig {
  return {
    enabled: readBoolEnv("EVOLUTION_ENABLED"),
    baseUrl: readUrlEnv("EVOLUTION_API_BASE_URL"),
  };
}

export function getPlatformPublicUrl(): string {
  return (
    process.env.PLATFORM_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}
