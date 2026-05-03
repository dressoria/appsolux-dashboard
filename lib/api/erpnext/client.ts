import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";

export function getErpnextConfig() {
  return {
    baseUrl: getRequiredEnv("ERPNEXT_BASE_URL").replace(/\/$/, ""),
    apiKey: getRequiredEnv("ERPNEXT_API_KEY"),
    apiSecret: getRequiredEnv("ERPNEXT_API_SECRET"),
  };
}

function getSafeErpnextMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    try {
      return getSafeErpnextMessage(JSON.parse(payload));
    } catch {
      return payload;
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
        return directMessage;
      }
    }

    return directMessage;
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

    throw new Error(message);
  }

  const text = await response.text();

  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}
