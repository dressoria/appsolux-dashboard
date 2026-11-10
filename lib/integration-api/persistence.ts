import "@/lib/security/server-only";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/lib/db/prisma";
import { canonical, digest } from "./crypto";
import type { ApiActor } from "./auth";
import { ApiError } from "./errors";
export type ApiResult = { data: unknown; meta?: Record<string, unknown>; status?: number };
export type StoredResponse = { body: Prisma.InputJsonValue; status: number };

export async function rateLimit(apiKeyId: string, bucket: string, limit: number, now = new Date()) {
  const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000);
  const row = await getPrismaClient().apiRateWindow.upsert({
    where: { apiKeyId_bucket_windowStart: { apiKeyId, bucket, windowStart } },
    create: { apiKeyId, bucket, windowStart }, update: { count: { increment: 1 } }, select: { count: true },
  });
  if (row.count > limit) throw new ApiError(429, "RATE_LIMITED", "Límite de solicitudes por minuto alcanzado. Reintenta en 60 segundos.");
  return { limit, remaining: Math.max(0, limit - row.count), reset: Math.floor(windowStart.getTime() / 1000) + 60 };
}
export async function claimIdempotency(apiKeyId: string, key: string, operation: string, input: unknown) {
  if (!/^[\x21-\x7e]{1,128}$/.test(key)) throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key debe tener entre 1 y 128 caracteres ASCII sin espacios.");
  const db = getPrismaClient(), keyDigest = digest(key), requestHash = digest(canonical({ operation, input }));
  const id = randomUUID();
  const inserted = await db.apiIdempotencyRecord.createMany({ data: { id, apiKeyId, keyDigest, requestHash, operation }, skipDuplicates: true });
  if (inserted.count === 1) return { id, replay: null };
  const record = await db.apiIdempotencyRecord.findUniqueOrThrow({ where: { apiKeyId_keyDigest: { apiKeyId, keyDigest } } });
  if (record.requestHash !== requestHash || record.operation !== operation) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Este identificador ya se usó con otra solicitud.");
  if (record.status === "RETRYABLE") {
    const acquired = await db.apiIdempotencyRecord.updateMany({ where: { id: record.id, status: "RETRYABLE" }, data: { status: "PROCESSING" } });
    if (acquired.count === 1) return { id: record.id, replay: null };
  }
  if (record.status !== "COMPLETED" || !record.response || !record.responseStatus) throw new ApiError(409, "IDEMPOTENCY_IN_PROGRESS", "Operación en proceso o pendiente de conciliación. No la repitas con otro identificador; consulta el resultado o contacta al administrador.");
  return { id: record.id, replay: { body: record.response as Prisma.InputJsonValue, status: record.responseStatus } };
}
export async function finishIdempotency(id: string, result: StoredResponse) {
  await getPrismaClient().apiIdempotencyRecord.update({ where: { id }, data: { status: "COMPLETED", response: result.body, responseStatus: result.status } });
}
export async function recordUsage(actor: ApiActor, endpoint: string, method: string, status: number, durationMs: number, requestId: string) {
  const db = getPrismaClient(), now = new Date();
  await db.$transaction([
    db.apiRequestLog.create({ data: { apiKeyId: actor.key.id, tenantId: actor.tenant.id, userId: actor.user.id, endpoint, method, status, durationMs, requestId } }),
    db.userApiKey.updateMany({ where: { id: actor.key.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - 60000) } }] }, data: { lastUsedAt: now } }),
  ]);
}

export async function releaseUnexecutedClaim(id: string) {
  await getPrismaClient().apiIdempotencyRecord.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "RETRYABLE" } });
}
