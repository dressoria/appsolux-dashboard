import "@/lib/security/server-only";
import {
  getChatwootBaseUrl,
  getChatwootPlatformToken,
  getMaskedToken,
} from "./config";

type ChatwootPlatformAccountResponse = {
  id: number;
  name: string;
};

type ChatwootPlatformAccountUser = {
  account_id: number;
  user_id: number;
  role: string;
};

type CreateChatwootAccountInput = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string;
  ownerName: string;
};

type EnsureChatwootOperationalAccessInput = {
  chatwootAccountId: number;
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  ownerName: string;
};

type ChatwootOperationalAccessResult =
  | {
      status: "ready";
      operationalUserId: number;
      role: "administrator";
      message: string;
    }
  | {
      status: "missing";
      message: string;
    };

function getChatwootPlatformConfig() {
  return {
    baseUrl: getChatwootBaseUrl(),
    platformApiToken: getChatwootPlatformToken(),
  };
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

function parseChatwootAccountUsers(
  value: unknown
): ChatwootPlatformAccountUser[] {
  if (!Array.isArray(value)) {
    throw new Error("Chatwoot no devolvio usuarios de cuenta validos.");
  }

  return value
    .map((item) => {
      if (!isObject(item)) {
        return null;
      }

      const accountId = item.account_id;
      const userId = item.user_id;
      const role = item.role;

      if (
        typeof accountId !== "number" ||
        typeof userId !== "number" ||
        typeof role !== "string"
      ) {
        return null;
      }

      return {
        account_id: accountId,
        user_id: userId,
        role,
      };
    })
    .filter((item): item is ChatwootPlatformAccountUser => Boolean(item));
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

async function getChatwootAccountUsers(chatwootAccountId: number) {
  const response = await chatwootPlatformFetch<unknown>(
    `/platform/api/v1/accounts/${chatwootAccountId}/account_users`
  );

  return parseChatwootAccountUsers(response);
}

async function addChatwootUserToAccount(input: {
  chatwootAccountId: number;
  userId: number;
  role: "administrator";
}) {
  await chatwootPlatformFetch<unknown>(
    `/platform/api/v1/accounts/${input.chatwootAccountId}/account_users`,
    {
      method: "POST",
      body: JSON.stringify({
        user_id: input.userId,
        role: input.role,
      }),
    }
  );
}

function getOperationalUserId() {
  const rawUserId = process.env.CHATWOOT_OPERATIONAL_USER_ID?.trim();

  if (!rawUserId) {
    return null;
  }

  const userId = Number(rawUserId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(
      "CHATWOOT_OPERATIONAL_USER_ID debe ser un ID numerico valido."
    );
  }

  return userId;
}

export async function ensureChatwootOperationalAccessForTenant(
  input: EnsureChatwootOperationalAccessInput
): Promise<ChatwootOperationalAccessResult> {
  const operationalUserId = getOperationalUserId();
  const operationalEmail = process.env.CHATWOOT_OPERATIONAL_USER_EMAIL?.trim();

  if (!operationalUserId) {
    return {
      status: "missing",
      message: operationalEmail
        ? "La cuenta Chatwoot fue creada, pero falta configurar CHATWOOT_OPERATIONAL_USER_ID. El email operativo esta documentado, pero Appsolux necesita el ID del usuario para asociarlo sin guardar secretos."
        : "La cuenta Chatwoot fue creada, pero falta configurar el usuario operativo.",
    };
  }

  const existingUsers = await getChatwootAccountUsers(input.chatwootAccountId);
  const existingUser = existingUsers.find(
    (accountUser) => accountUser.user_id === operationalUserId
  );

  if (existingUser) {
    return {
      status: "ready",
      operationalUserId,
      role: "administrator",
      message: "La bandeja de atencion ya tiene acceso operativo.",
    };
  }

  await addChatwootUserToAccount({
    chatwootAccountId: input.chatwootAccountId,
    userId: operationalUserId,
    role: "administrator",
  });

  return {
    status: "ready",
    operationalUserId,
    role: "administrator",
    message: "Acceso operativo configurado correctamente.",
  };
}
