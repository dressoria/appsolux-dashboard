import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

export function getErpnextConfig() {
  return {
    baseUrl: getRequiredEnv("ERPNEXT_BASE_URL").replace(/\/$/, ""),
    apiKey: getRequiredEnv("ERPNEXT_API_KEY"),
    apiSecret: getRequiredEnv("ERPNEXT_API_SECRET"),
  };
}

function cleanSafeErpnextMessage(message: string) {
  const cleanMessage = message
    .replace(/<strong[^>]*>/gi, "\"")
    .replace(/<\/strong>/gi, "\"")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  const warehouseExistsMatch = cleanMessage.match(
    /Almac\S*n\s+"?([^"]+)"?\s+ya existe/i
  );

  if (warehouseExistsMatch?.[1]) {
    return `La bodega "${warehouseExistsMatch[1].trim()}" ya existe.`;
  }

  return cleanMessage;
}

function getSafeErpnextMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    try {
      return getSafeErpnextMessage(JSON.parse(payload));
    } catch {
      return cleanSafeErpnextMessage(payload);
    }
  }

  if (Array.isArray(payload)) {
    const messages = payload
      .map((item) => getSafeErpnextMessage(item))
      .filter((item): item is string => Boolean(item));

    return messages.length > 0 ? messages.join(" ") : null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const directMessage =
    record.message ??
    record._server_messages ??
    record.exception ??
    record.exc ??
    record.error;

  if (typeof directMessage === "string" && directMessage.trim()) {
    if (
      directMessage.trim().startsWith("[") ||
      directMessage.trim().startsWith("{")
    ) {
      try {
        return getSafeErpnextMessage(JSON.parse(directMessage));
      } catch {
        return cleanSafeErpnextMessage(directMessage);
      }
    }

    return cleanSafeErpnextMessage(directMessage);
  }

  if (Array.isArray(directMessage)) {
    const messages = directMessage
      .map((item) => getSafeErpnextMessage(item))
      .filter((item): item is string => Boolean(item));

    return messages.length > 0 ? messages.join(" ") : null;
  }

  if (directMessage && typeof directMessage === "object") {
    return getSafeErpnextMessage(directMessage);
  }

  return null;
}

function getSafeBaseOrigin(baseUrl: string) {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl;
  }
}

export async function erpnextFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { baseUrl, apiKey, apiSecret } = getErpnextConfig();
  const requestUrl = `${baseUrl}${path}`;
  const safeOrigin = getSafeBaseOrigin(baseUrl);
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${apiKey}:${apiSecret}`,
        ...options?.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[erpnext] Network request failed", {
      origin: safeOrigin,
      path,
      method: options?.method ?? "GET",
      message: error instanceof Error ? error.message : "Unknown fetch error",
    });
    throw new Error(
      "No se pudo conectar con ERPNext. Revisa la conectividad de la app, la red Docker y ERPNEXT_BASE_URL."
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    const text = await response.text();

    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    const message =
      getSafeErpnextMessage(payload) ??
      (typeof payload === "string" && payload.trim()
        ? payload
        : `ERPNext request failed: ${response.status}`);

    console.error("[erpnext] Request returned error response", {
      origin: safeOrigin,
      path,
      method: options?.method ?? "GET",
      status: response.status,
      message: cleanSafeErpnextMessage(message),
    });

    throw new Error(cleanSafeErpnextMessage(message));
  }

  const text = await response.text();

  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}
