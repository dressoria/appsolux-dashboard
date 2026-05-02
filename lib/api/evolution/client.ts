import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

export function getEvolutionConfig() {
  return {
    baseUrl: getRequiredEnv("EVOLUTION_API_BASE_URL"),
    apiKey: getRequiredEnv("EVOLUTION_API_KEY"),
  };
}

export async function evolutionFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { baseUrl, apiKey } = getEvolutionConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Evolution API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}