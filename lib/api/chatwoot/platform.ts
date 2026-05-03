import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

type ChatwootPlatformAccountResponse = {
  id: number;
  name: string;
};

type CreateChatwootAccountInput = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string;
  ownerName: string;
};

function getChatwootPlatformConfig() {
  return {
    baseUrl: getRequiredEnv("CHATWOOT_BASE_URL"),
    platformApiToken: getRequiredEnv("CHATWOOT_PLATFORM_API_TOKEN"),
  };
}

function getMaskedToken(token: string) {
  return token.length > 4 ? `***${token.slice(-4)}` : "***";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getResponseMessage(value: unknown) {
  if (!isObject(value)) {
    return undefined;
  }

  const message = value.message ?? value.error;
  return typeof message === "string" ? message : undefined;
}

function parseChatwootPlatformAccount(
  value: unknown
): ChatwootPlatformAccountResponse {
  if (!isObject(value)) {
    throw new Error("Chatwoot no devolvio una respuesta valida.");
  }

  const id = value.id;
  const name = value.name;

  if (typeof id !== "number" || typeof name !== "string") {
    throw new Error("Chatwoot no devolvio el account_id creado.");
  }

  return { id, name };
}

async function chatwootPlatformFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { baseUrl, platformApiToken } = getChatwootPlatformConfig();

  console.info(
    `[Chatwoot] Platform API token loaded: ${getMaskedToken(platformApiToken)}`
  );

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      api_access_token: platformApiToken,
      ...options?.headers,
    },
    cache: "no-store",
  });
  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const detail = getResponseMessage(responseBody);

    if (response.status === 401) {
      throw new Error(
        "Token Platform de Chatwoot invalido o sin permisos para provisioning."
      );
    }

    throw new Error(
      detail
        ? `Chatwoot no pudo crear la cuenta: ${detail}`
        : `Chatwoot Platform API fallo con estado ${response.status}.`
    );
  }

  return responseBody as T;
}

export async function createChatwootAccountForTenant(
  input: CreateChatwootAccountInput
) {
  const response = await chatwootPlatformFetch<unknown>(
    "/platform/api/v1/accounts",
    {
      method: "POST",
      body: JSON.stringify({
        name: input.tenantName,
        locale: "es",
        support_email: input.ownerEmail,
        status: "active",
        limits: {},
        custom_attributes: {
          appsolux_tenant_id: input.tenantId,
          appsolux_tenant_slug: input.tenantSlug,
          appsolux_owner_email: input.ownerEmail,
          appsolux_owner_name: input.ownerName,
        },
      }),
    }
  );

  return parseChatwootPlatformAccount(response);
}
