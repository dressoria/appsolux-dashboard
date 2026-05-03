import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

export function getMaskedToken(token: string) {
  return token.length > 4 ? `***${token.slice(-4)}` : "***";
}

export function getChatwootBaseUrl() {
  return getRequiredEnv("CHATWOOT_BASE_URL");
}

export function getChatwootPlatformToken() {
  return getRequiredEnv("CHATWOOT_PLATFORM_API_TOKEN");
}

export function getChatwootBotToken() {
  const botToken = process.env.CHATWOOT_BOT_API_ACCESS_TOKEN?.trim();

  if (botToken) {
    return {
      token: botToken,
      source: "CHATWOOT_BOT_API_ACCESS_TOKEN",
      isDeprecatedFallback: false,
    };
  }

  const deprecatedToken = process.env.CHATWOOT_API_ACCESS_TOKEN?.trim();

  if (deprecatedToken) {
    console.warn(
      "[Chatwoot] CHATWOOT_API_ACCESS_TOKEN is deprecated. Use CHATWOOT_BOT_API_ACCESS_TOKEN."
    );

    return {
      token: deprecatedToken,
      source: "CHATWOOT_API_ACCESS_TOKEN",
      isDeprecatedFallback: true,
    };
  }

  throw new Error(
    "Falta configurar CHATWOOT_BOT_API_ACCESS_TOKEN para leer conversaciones."
  );
}

export function getChatwootAdminToken() {
  return process.env.CHATWOOT_ADMIN_API_ACCESS_TOKEN?.trim() || null;
}
