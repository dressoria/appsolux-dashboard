import "@/lib/security/server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { authenticateApiKey, requireScopes, type ApiActor } from "./auth";
import { ApiError, object, pagination, rejectAuthority } from "./errors";
import { matchRoute } from "./routes";
import { enforceOperationPolicy } from "./policy";
import { rateLimit, claimIdempotency, finishIdempotency, recordUsage, releaseUnexecutedClaim, type StoredResponse } from "./persistence";
import { publicPayload } from "./serialization";
import { validateReferences, primaryReference } from "./references";

async function writeLock<T>(tenantId: string, execute: () => Promise<T>): Promise<T> {
  return getPrismaClient().$transaction(async tx => {
    const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${`facturom-api:${tenantId}`}, 0)) AS locked`;
    if (!lock.locked) throw new ApiError(409, "TENANT_BUSY", "Hay otra operación API en curso para esta empresa. Reintenta con el mismo Idempotency-Key.");
    return execute();
  }, { timeout: 60000, maxWait: 5000 });
}
export const gatewayDependencies = {
  authenticate: authenticateApiKey, policy: enforceOperationPolicy, rateLimit,
  claim: claimIdempotency, finish: finishIdempotency, usage: recordUsage,
  references: validateReferences, writeLock, release: releaseUnexecutedClaim,
};
function errorResponse(error: unknown): StoredResponse {
  let e: ApiError;
  if (error instanceof ApiError) e = error;
  else if (error instanceof SyntaxError) e = new ApiError(400, "INVALID_JSON", "JSON inválido.");
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapping: Record<string, [number, string, string]> = {
      P2002: [409, "CONFLICT", "El recurso ya existe o la operación entra en conflicto."],
      P2003: [404, "NOT_FOUND", "Referencia no disponible en esta empresa."],
      P2025: [404, "NOT_FOUND", "Recurso no encontrado en esta empresa."],
      P2034: [409, "CONCURRENT_CHANGE", "La información cambió concurrentemente. Revisa el resultado antes de reintentar."],
      P2021: [503, "MIGRATION_REQUIRED", "La API requiere aplicar la migración preparada."],
      P2022: [503, "MIGRATION_REQUIRED", "La API requiere aplicar la migración preparada."],
    };
    e = new ApiError(...(mapping[error.code] ?? [500, "INTERNAL_ERROR", "No se pudo completar la operación."] as [number, string, string]));
  } else if (error instanceof Prisma.PrismaClientValidationError || error instanceof RangeError || error instanceof TypeError) e = new ApiError(400, "INVALID_INPUT", "Datos de solicitud inválidos.");
  else if (error instanceof Error && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500) e = new ApiError(error.status === 400 ? 422 : error.status, "BUSINESS_VALIDATION", error.message.slice(0, 500));
  else if (error instanceof Error && error.name === "Error" && !/prisma|postgres|database|ftm_|password|secret|token|\/Users\/|ECONN|ENOTFOUND|ENOENT/i.test(error.message)) e = new ApiError(422, "BUSINESS_VALIDATION", error.message.slice(0, 500));
  else e = new ApiError(500, "INTERNAL_ERROR", "No se pudo completar la operación.");
  return { body: { ok: false, error: { code: e.code, message: e.message } }, status: e.status };
}
export async function integrationApi(request: Request, path: string, overrides: Partial<typeof gatewayDependencies> = {}) {
  const deps = { ...gatewayDependencies, ...overrides }, start = Date.now(), requestId = randomUUID();
  let actor: ApiActor | undefined, endpoint = "unmatched", claimId: string | undefined;
  let output: Response | undefined;
  const headers = new Headers({ "Cache-Control": "private, no-store", "Pragma": "no-cache", "X-Request-Id": requestId, "X-Content-Type-Options": "nosniff", "Vary": "Authorization, X-API-Key" });
  try {
    const url = new URL(request.url);
    // Trust TLS termination only when the external application URL is configured
    // as HTTPS. Production must never accept an unconfigured HTTP public origin.
    if (process.env.NODE_ENV === "production") {
      const publicHttps = process.env.NEXT_PUBLIC_APP_URL && new URL(process.env.NEXT_PUBLIC_APP_URL).protocol === "https:";
      const secureTransport = url.protocol === "https:" || (publicHttps && request.headers.get("x-forwarded-proto") === "https");
      if (!secureTransport || (process.env.NEXT_PUBLIC_APP_URL && !publicHttps)) throw new ApiError(400, "HTTPS_REQUIRED", "Configura y utiliza el origen público HTTPS de Facturom.");
    }
    if (url.search.length > 4096 || path.length > 500) throw new ApiError(400, "REQUEST_TOO_LARGE", "Solicitud demasiado grande.");
    for (const key of url.searchParams.keys()) if (/^(api[_-]?key|token|authorization)$/i.test(key)) throw new ApiError(400, "HEADER_AUTH_REQUIRED", "Envía la clave únicamente en una cabecera de autenticación.");
    actor = await deps.authenticate(request);
    const rate = await deps.rateLimit(actor.key.id, "requests", 120);
    headers.set("X-RateLimit-Limit", String(rate.limit)); headers.set("X-RateLimit-Remaining", String(rate.remaining)); headers.set("X-RateLimit-Reset", String(rate.reset));
    const matched = matchRoute(request.method, path);
    if (!matched) throw new ApiError(404, "ENDPOINT_NOT_FOUND", "Endpoint o método no disponible en API v1.");
    const { route, params } = matched;
    endpoint = `/api/v1/${route.path}`;
    requireScopes(actor, route.scopes);
    await deps.policy(actor, request.method, route.scopes);
    const queryObject = Object.fromEntries(url.searchParams);
    rejectAuthority(queryObject);
    for (const header of ["x-tenant-id", "tenant-id", "x-company-id", "x-user-id"]) if (request.headers.has(header)) throw new ApiError(400, "AUTHORITY_OVERRIDE", "La empresa se obtiene exclusivamente de la clave.");
    pagination(url.searchParams);
    if (route.expensive) await deps.rateLimit(actor.key.id, "expensive", 20);
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      await deps.rateLimit(actor.key.id, "writes", 30);
      if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new ApiError(400, "JSON_REQUIRED", "Envía Content-Type: application/json y un objeto JSON (puede ser {}). ");
      // Bounded streaming read also protects chunked requests with no Content-Length.
      const reader = request.body?.getReader();
      if (reader) {
        let size = 0; const chunks: Uint8Array[] = [];
        while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 1048576) { await reader.cancel(); throw new ApiError(413, "REQUEST_TOO_LARGE", "El cuerpo admite hasta 1 MiB."); } chunks.push(chunk.value); }
        const raw = Buffer.concat(chunks); body = object(JSON.parse(raw.toString("utf8")));
      }
      rejectAuthority(body);
    }
    const key = request.headers.get("idempotency-key");
    if (request.method !== "GET" && !key) throw new ApiError(400, "IDEMPOTENCY_REQUIRED", "Envía Idempotency-Key en todas las operaciones de escritura.");
    if (key && request.method !== "GET") {
      const claim = await deps.claim(actor.key.id, key, `${route.method} ${path}`, { body, query: queryObject });
      if (claim.replay) { headers.set("Idempotency-Replayed", "true"); output = Response.json(claim.replay.body, { status: claim.replay.status, headers }); return output; }
      claimId = claim.id;
    }
    await deps.references(actor.tenant.id, primaryReference(route.path, params.id));
    await deps.references(actor.tenant.id, body);
    await deps.references(actor.tenant.id, queryObject);
    const execute = async () => route.handle({ actor: actor!, params, query: url.searchParams, body });
    const result = request.method === "GET" ? await execute() : await deps.writeLock(actor.tenant.id, execute);
    if (result instanceof Response) {
      if (claimId) throw new ApiError(500, "INVALID_HANDLER_RESPONSE", "Respuesta de escritura inválida.");
      headers.forEach((v, k) => result.headers.set(k, v)); output = result; return result;
    }
    const stored: StoredResponse = { body: JSON.parse(JSON.stringify({ ok: true, data: publicPayload(result.data), meta: { ...result.meta, requestId } })), status: result.status ?? (request.method === "POST" ? 201 : 200) };
    if (claimId) await deps.finish(claimId, stored);
    output = Response.json(stored.body, { status: stored.status, headers });
    return output;
  } catch (error) {
    const stored = errorResponse(error);
    // Preserve all ambiguous failures as PROCESSING. Never automatically rerun a
    // request that may already have committed business effects.
    if (claimId && error instanceof ApiError && error.code === "TENANT_BUSY") {
      try { await deps.release(claimId); } catch { /* keep the conservative claim */ }
    }
    if (claimId && stored.status < 500 && !(error instanceof ApiError && error.code === "TENANT_BUSY")) {
      try { await deps.finish(claimId, stored); } catch { /* persisted claim still prevents replay */ }
    }
    if (stored.status === 429) headers.set("Retry-After", "60");
    output = Response.json(stored.body, { status: stored.status, headers });
    return output;
  } finally {
    if (actor) {
      try { await deps.usage(actor, endpoint, request.method.slice(0, 10), output?.status ?? 500, Date.now() - start, requestId); }
      catch { console.error("[integration-api] usage persistence unavailable", { requestId }); }
    }
  }
}
