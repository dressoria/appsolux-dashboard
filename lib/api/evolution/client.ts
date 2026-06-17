import "@/lib/security/server-only";
import { getRequiredEnv } from "@/lib/security/env";
import { getEvolutionServiceConfig, ServiceDisabledError } from "@/config/services";

export function getEvolutionConfig() {
  return {
    baseUrl: getRequiredEnv("EVOLUTION_API_BASE_URL"),
    apiKey: getRequiredEnv("EVOLUTION_API_KEY"),
  };
}

export class EvolutionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: string
  ) {
    super(message);
  }
}

function sanitizeEvolutionBody(body: unknown): string | undefined {
  if (!body) {
    return undefined;
  }

  const value =
    typeof body === "string" ? body : JSON.stringify(body, (_key, entry) => {
      if (typeof entry === "string" && entry.length > 300) {
        return `${entry.slice(0, 300)}...`;
      }

      return entry;
    });

  return value
    .replace(/"apikey"\s*:\s*"[^"]+"/gi, '"apikey":"***"')
    .replace(/"apiKey"\s*:\s*"[^"]+"/gi, '"apiKey":"***"')
    .replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"***"');
}

function getEvolutionErrorMessage(status: number, body: unknown) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.response;

    if (typeof message === "string") {
      return message;
    }
  }

  return `Evolution API request failed: ${status}`;
}

async function parseEvolutionResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getMethod(options?: RequestInit) {
  return options?.method?.toUpperCase() ?? "GET";
}

function getInstanceNameFromPath(path: string) {
  const match =
    path.match(/\/instance\/connect\/([^/?]+)/) ??
    path.match(/\/instance\/connectionState\/([^/?]+)/) ??
    path.match(/\/webhook\/set\/([^/?]+)/) ??
    path.match(/\/chatwoot\/set\/([^/?]+)/);

  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function logEvolutionError(input: {
  path: string;
  method: string;
  status: number;
  responseBody: unknown;
}) {
  console.error("[Evolution] API request failed", {
    endpoint: input.path,
    method: input.method,
    instanceName: getInstanceNameFromPath(input.path),
    status: input.status,
    responseBody: sanitizeEvolutionBody(input.responseBody),
  });
}

export async function evolutionFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  if (!getEvolutionServiceConfig().enabled) {
    throw new ServiceDisabledError("Evolution API");
  }

  const { baseUrl, apiKey } = getEvolutionConfig();
  const method = getMethod(options);

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...options?.headers,
    },
    cache: "no-store",
  });

  const responseBody = await parseEvolutionResponse(response);

  if (!response.ok) {
    const detail = sanitizeEvolutionBody(responseBody);

    logEvolutionError({
      path,
      method,
      status: response.status,
      responseBody,
    });

    throw new EvolutionApiError(
      getEvolutionErrorMessage(response.status, responseBody),
      response.status,
      detail
    );
  }

  return responseBody as T;
}

export function getSafeEvolutionError(error: unknown) {
  if (error instanceof EvolutionApiError) {
    return {
      status: error.status,
      message:
        error.status === 400
          ? "Evolution rechazo la solicitud de QR para esta instancia."
          : error.message,
      detail: error.detail,
    };
  }

  return {
    status: 500,
    message:
      error instanceof Error ? error.message : "Unexpected Evolution API error",
    detail: undefined,
  };
}
