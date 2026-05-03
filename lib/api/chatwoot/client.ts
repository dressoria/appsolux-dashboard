import "@/lib/security/server-only";
import {
  getChatwootBaseUrl,
  getChatwootBotToken,
  getMaskedToken,
} from "./config";

export function getChatwootConfig() {
  const botToken = getChatwootBotToken();

  return {
    baseUrl: getChatwootBaseUrl(),
    apiAccessToken: botToken.token,
    tokenSource: botToken.source,
  };
}

function getChatwootErrorMessage(status: number) {
  if (status === 401) {
    return "El token de Appsolux Bot no tiene acceso a esta cuenta. Verifica que el bot este asignado al account y que CHATWOOT_BOT_API_ACCESS_TOKEN sea correcto.";
  }

  return `Chatwoot request failed: ${status}`;
}

export async function chatwootFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { baseUrl, apiAccessToken } = getChatwootConfig();

  console.info(
    `[Chatwoot] Bot token loaded: yes (${getMaskedToken(apiAccessToken)})`
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
