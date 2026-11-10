import "@/lib/security/server-only";
import { Prisma } from "@prisma/client";
async function getCurrentUser() { return (await import("@/lib/auth/current-user")).getCurrentUser(); }
import { getPrismaClient } from "@/lib/db/prisma";
import { hasPermission, isTenantAdmin } from "@/lib/auth/permissions";
import { API_CATALOG_VERSION, authorizedScopes, selectScopes } from "./catalog";
import { generateApiKey } from "./crypto";
import { ApiError, date, object, string } from "./errors";
import { apiKeyPlanPolicy } from "./policy";
import type { AppsoluxUser } from "@/types/user";

export const publicKeySelect = {
  id: true, tenantId: true, userId: true, name: true, keyPrefix: true, scopes: true,
  fullAccess: true, catalogVersion: true, status: true, createdAt: true, updatedAt: true,
  expiresAt: true, lastUsedAt: true, revokedAt: true, replacesKeyId: true,
  user: { select: { id: true, name: true, email: true } },
  tenant: { select: { id: true, name: true } },
} satisfies Prisma.UserApiKeySelect;
export async function managementActor(tenantId: string, currentUser = getCurrentUser) {
  const session = await currentUser();
  if (!session) throw new ApiError(401, "SESSION_REQUIRED", "Inicia sesión para administrar claves.");
  const membership = await getPrismaClient().membership.findUnique({
    where: { userId_tenantId: { userId: session.id, tenantId } },
    include: { user: { select: { status: true } }, tenant: { select: { id: true, name: true, slug: true, status: true } } },
  });
  if (!membership || membership.status !== "active" || membership.user.status !== "active" || membership.tenant.status !== "active") throw new ApiError(403, "FORBIDDEN", "Empresa no disponible para este usuario.");
  const user: AppsoluxUser = { ...session, role: membership.role, permissions: undefined, tenant: null };
  const available = authorizedScopes(user, hasPermission);
  return { user, tenant: membership.tenant, available, admin: isTenantAdmin(user) };
}
export async function listManagement(tenantId?: string, currentUser = getCurrentUser) {
  const session = await currentUser();
  if (!session) throw new ApiError(401, "SESSION_REQUIRED", "Sesión requerida.");
  const memberships = await getPrismaClient().membership.findMany({
    where: { userId: session.id, status: "active", user: { status: "active" }, tenant: { status: "active" } },
    select: { tenant: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" },
  });
  const selected = tenantId ?? session.tenant?.id;
  if (!selected) throw new ApiError(400, "SELECT_TENANT", "Selecciona explícitamente una empresa.");
  const actor = await managementActor(selected, currentUser);
  const keys = await getPrismaClient().userApiKey.findMany({
    where: { tenantId: selected, ...(actor.admin ? {} : { userId: actor.user.id }) },
    select: publicKeySelect, orderBy: { createdAt: "desc" }, take: 500,
  });
  return { keys, tenant: actor.tenant, tenants: memberships.map(m => m.tenant), availableScopes: actor.available, userId: actor.user.id, admin: actor.admin, catalogVersion: API_CATALOG_VERSION };
}
function expiration(value: unknown) {
  if (value == null || value === "") return null;
  const expires = date(value);
  if (expires <= new Date()) throw new ApiError(400, "INVALID_EXPIRATION", "La expiración debe ser futura.");
  return expires;
}
export async function createManagedKey(input: Record<string, unknown>, currentUser = getCurrentUser) {
  // tenant is explicitly selected AND verified against the web user's membership.
  const tenantId = string(input.tenantId, "Empresa"), actor = await managementActor(tenantId, currentUser);
  if (!actor.available.length || !(await apiKeyPlanPolicy(tenantId)).enabled) throw new ApiError(403, "FORBIDDEN", "No tienes permiso para crear claves API.");
  const name = string(input.name, "Nombre");
  if (name.length > 100) throw new ApiError(400, "INVALID_NAME", "El nombre admite hasta 100 caracteres.");
  let selection;
  try { selection = selectScopes(input, actor.available); } catch { throw new ApiError(403, "FORBIDDEN_SCOPE", "Los permisos solicitados no están autorizados."); }
  const generated = generateApiKey();
  const key = await getPrismaClient().$transaction(async tx => {
    const key = await tx.userApiKey.create({ data: { tenantId, userId: actor.user.id, name, ...selection, keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, expiresAt: expiration(input.expiresAt) }, select: publicKeySelect });
    await tx.auditLog.create({ data: { tenantId, userId: actor.user.id, action: "api_key.created", entityType: "UserApiKey", entityId: key.id, metadata: { scopes: selection.scopes, catalogVersion: API_CATALOG_VERSION } } });
    return key;
  });
  return { key, secret: generated.secret };
}
export async function changeManagedKey(id: string, input: Record<string, unknown>, currentUser = getCurrentUser) {
  const tenantId = string(input.tenantId, "Empresa"), actor = await managementActor(tenantId, currentUser), db = getPrismaClient();
  const key = await db.userApiKey.findFirst({ where: { id, tenantId, ...(actor.admin ? {} : { userId: actor.user.id }) } });
  if (!key) throw new ApiError(404, "NOT_FOUND", "Clave no encontrada.");
  if (input.action === "revoke") {
    await db.$transaction(async tx => {
      await tx.userApiKey.updateMany({ where: { id, tenantId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date(), revokedById: actor.user.id } });
      await tx.auditLog.create({ data: { tenantId, userId: actor.user.id, action: "api_key.revoked", entityType: "UserApiKey", entityId: id } });
    });
    return { revoked: true };
  }
  if (!(await apiKeyPlanPolicy(tenantId)).enabled) throw new ApiError(403, "API_PLAN_DISABLED", "No se pueden rotar claves en este plan.");
  if (input.action !== "rotate" || !["overlap", "replace"].includes(String(input.mode))) throw new ApiError(400, "INVALID_ACTION", "Selecciona rotación con convivencia o reemplazo inmediato.");
  if (key.userId !== actor.user.id) throw new ApiError(403, "OWNER_REQUIRED", "Solo el propietario puede obtener el secreto de una clave de reemplazo.");
  if (key.status !== "ACTIVE" || key.revokedAt) throw new ApiError(409, "KEY_REVOKED", "Crea una nueva clave para reemplazar una clave revocada.");
  let selection;
  try { selection = selectScopes({ scopes: key.scopes.filter(s => actor.available.some(a => a.id === s)) }, actor.available); }
  catch { throw new ApiError(403, "FORBIDDEN_SCOPE", "Los permisos de esta clave ya no están autorizados. Crea una nueva con los permisos actuales."); }
  const generated = generateApiKey();
  const replacement = await db.$transaction(async tx => {
    // Row lock serializes concurrent rotations and revocations.
    await tx.$queryRaw`SELECT id FROM "UserApiKey" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    const current = await tx.userApiKey.findFirst({ where: { id, tenantId, status: "ACTIVE", revokedAt: null } });
    if (!current) throw new ApiError(409, "KEY_REVOKED", "La clave fue revocada.");
    const replacement = await tx.userApiKey.create({ data: { tenantId, userId: actor.user.id, name: key.name, keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, ...selection, expiresAt: input.expiresAt === undefined ? key.expiresAt : expiration(input.expiresAt), replacesKeyId: id }, select: publicKeySelect });
    if (input.mode === "replace") await tx.userApiKey.update({ where: { id, tenantId }, data: { status: "REVOKED", revokedAt: new Date(), revokedById: actor.user.id } });
    await tx.auditLog.create({ data: { tenantId, userId: actor.user.id, action: "api_key.rotated", entityType: "UserApiKey", entityId: id, metadata: { replacementId: replacement.id, mode: String(input.mode) } } });
    return replacement;
  });
  return { key: replacement, secret: generated.secret, previousKeyActive: input.mode === "overlap" };
}
export async function managementHttp(request: Request, action: (input: Record<string, unknown>) => Promise<unknown>) {
  try {
    if (request.headers.has("authorization") || request.headers.has("x-api-key")) throw new ApiError(403, "WEB_SESSION_REQUIRED", "Las claves API no pueden administrar claves.");
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      const target = new URL(request.url);
      const protocol = request.headers.get("x-forwarded-proto") === "https" && process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ? "https:" : target.protocol;
      const sameHostOrigin = origin && origin === `${protocol}//${request.headers.get("host")}`;
      // Next may construct an internal localhost URL behind a reverse proxy.
      // Host is browser-controlled by the destination, not by client JS.
      if (!origin || (origin !== target.origin && !sameHostOrigin) || request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "INVALID_ORIGIN", "Origen no autorizado.");
    }
    const input = request.method === "GET" ? {} : object(await request.json());
    return Response.json({ ok: true, data: await action(input) }, { headers: { "Cache-Control": "private, no-store", "Pragma": "no-cache" } });
  } catch (error) {
    const pendingMigration = error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code);
    const e = pendingMigration ? new ApiError(503, "MIGRATION_REQUIRED", "Aplica la migración de API keys preparada antes de administrar claves.") : error instanceof ApiError ? error : new ApiError(error instanceof SyntaxError ? 400 : 500, "REQUEST_FAILED", "No se pudo completar la administración de claves.");
    return Response.json({ ok: false, error: { code: e.code, message: e.message } }, { status: e.status, headers: { "Cache-Control": "no-store" } });
  }
}
