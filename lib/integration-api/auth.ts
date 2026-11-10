import "@/lib/security/server-only";
import type { UserApiKey, Membership, Tenant, User } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { API_SCOPES, authorizedScopes, type ApiScope } from "./catalog";
import { matchesHash, digest, validApiKey } from "./crypto";
import { ApiError } from "./errors";
import type { AppsoluxUser } from "@/types/user";

export type ApiActor = { key: UserApiKey; user: AppsoluxUser; tenant: Pick<Tenant, "id" | "name" | "slug">; scopes: ApiScope[] };
export type KeyWithOwner = UserApiKey & { user: Pick<User, "id" | "name" | "email" | "status">; tenant: Pick<Tenant, "id" | "name" | "slug" | "status"> };
export type AuthStore = {
  findKey: (hash: string) => Promise<KeyWithOwner | null>;
  findMembership: (userId: string, tenantId: string) => Promise<Pick<Membership, "role" | "status"> | null>;
};
const store: AuthStore = {
  findKey: hash => getPrismaClient().userApiKey.findUnique({ where: { keyHash: hash }, include: { user: { select: { id: true, name: true, email: true, status: true } }, tenant: { select: { id: true, name: true, slug: true, status: true } } } }),
  findMembership: (userId, tenantId) => getPrismaClient().membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } }),
};
export function extractApiKey(request: Request) {
  const authorization = request.headers.get("authorization"), alternate = request.headers.get("x-api-key");
  const bearer = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if ((authorization && !bearer) || (bearer && alternate && bearer !== alternate)) throw new ApiError(401, "INVALID_API_KEY", "Clave inválida o ausente.");
  const key = bearer ?? alternate ?? "";
  if (!validApiKey(key)) throw new ApiError(401, "INVALID_API_KEY", "Clave inválida o ausente.");
  return key;
}
export async function authenticateApiKey(request: Request, db: AuthStore = store, now = new Date()): Promise<ApiActor> {
  const secret = extractApiKey(request);
  const key = await db.findKey(digest(secret));
  if (!key || !matchesHash(secret, key.keyHash) || key.status !== "ACTIVE" || key.revokedAt || (key.expiresAt && key.expiresAt <= now) || key.user.status !== "active" || key.tenant.status !== "active") throw new ApiError(401, "INVALID_API_KEY", "Clave inválida, revocada o vencida.");
  const membership = await db.findMembership(key.userId, key.tenantId);
  if (!membership || membership.status !== "active") throw new ApiError(401, "INVALID_API_KEY", "Clave inválida, revocada o vencida.");
  const tenant = key.tenant;
  const user: AppsoluxUser = { id: key.userId, name: key.user.name, email: key.user.email, role: membership.role, tenant: null };
  const current = new Set(authorizedScopes(user, hasPermission).map(s => s.id));
  return { key, user, tenant, scopes: key.scopes.filter((s): s is ApiScope => current.has(s as ApiScope)) };
}
export function requireScopes(actor: ApiActor, scopes: readonly ApiScope[]) {
  // fullAccess is descriptive. It is NEVER a wildcard, including after catalog updates.
  if (scopes.some(s => !API_SCOPES.some(d => d.id === s) || !actor.scopes.includes(s))) throw new ApiError(403, "FORBIDDEN_SCOPE", "La clave no tiene permiso para esta operación.");
}
