import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

export function getChatwootConfig() {
  return {
    baseUrl: getRequiredEnv("CHATWOOT_BASE_URL"),
    apiAccessToken: getRequiredEnv("CHATWOOT_API_ACCESS_TOKEN"),
  };
}

function getMaskedToken(token: string) {
  return token.length > 4 ? `***${token.slice(-4)}` : "***";
}

function getChatwootErrorMessage(status: number) {
  if (status === 401) {
    return "Token de Chatwoot invalido o sin acceso a esta cuenta. Revisa CHATWOOT_API_ACCESS_TOKEN.";
  }

  return `Chatwoot request failed: ${status}`;
}

export async function chatwootFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { baseUrl, apiAccessToken } = getChatwootConfig();

  console.info(
    `[Chatwoot] Application API token loaded: ${getMaskedToken(apiAccessToken)}`
  );

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      api_access_token: apiAccessToken,
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(getChatwootErrorMessage(response.status));
  }

  return response.json() as Promise<T>;
}
