import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

export function getChatwootConfig() {
  return {
    baseUrl: getRequiredEnv("CHATWOOT_BASE_URL"),
    platformApiToken: getRequiredEnv("CHATWOOT_PLATFORM_API_TOKEN"),
  };
}

export async function chatwootFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { baseUrl, platformApiToken } = getChatwootConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      api_access_token: platformApiToken,
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Chatwoot request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}