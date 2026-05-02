import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

export function getErpnextConfig() {
  return {
    baseUrl: getRequiredEnv("ERPNEXT_BASE_URL"),
    apiKey: getRequiredEnv("ERPNEXT_API_KEY"),
    apiSecret: getRequiredEnv("ERPNEXT_API_SECRET"),
  };
}

export async function erpnextFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { baseUrl, apiKey, apiSecret } = getErpnextConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${apiKey}:${apiSecret}`,
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ERPNext request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}