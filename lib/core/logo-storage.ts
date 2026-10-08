import "@/lib/security/server-only";

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const TENANT_ID_RE = /^[a-zA-Z0-9_-]+$/;
const FILENAME_SANITIZE_RE = /[^a-zA-Z0-9._-]/g;

function validateTenantId(tenantId: string) {
  if (!TENANT_ID_RE.test(tenantId)) {
    throw new Error("tenantId inválido para storage seguro.");
  }
}

function getLogoStoragePath(): string {
  const base = process.env.LOGO_STORAGE_PATH?.trim();
  if (base) return base;
  return "/app/.appsolux-secure/logos";
}

export function buildLogoStorageKey(tenantId: string, fileName: string): string {
  validateTenantId(tenantId);
  const sanitized = fileName.replace(FILENAME_SANITIZE_RE, "_");
  return `${tenantId}/logo-${sanitized}`;
}

function resolveAndGuard(root: string, tenantId: string, relativePath: string): string {
  const tenantDir = path.join(root, tenantId);
  const fullPath = path.resolve(tenantDir, relativePath);
  if (!fullPath.startsWith(tenantDir + path.sep) && fullPath !== tenantDir) {
    throw new Error("Path traversal bloqueado.");
  }
  return fullPath;
}

function extractTenantPrefix(storageKey: string): string {
  const slash = storageKey.indexOf("/");
  if (slash <= 0) throw new Error("storageKey formato inválido.");
  return storageKey.substring(0, slash);
}

function assertKeyBelongsToTenant(storageKey: string, tenantId: string) {
  const keyTenant = extractTenantPrefix(storageKey);
  if (keyTenant !== tenantId) {
    console.warn(
      `[logo-storage] cross-tenant access blocked: key tenant=${keyTenant}, request tenant=${tenantId}`,
    );
    throw new Error("Acceso denegado al recurso.");
  }
}

export async function saveLogo(
  tenantId: string,
  fileName: string,
  buffer: Buffer,
): Promise<string> {
  validateTenantId(tenantId);
  const root = path.resolve(getLogoStoragePath());
  const sanitized = fileName.replace(FILENAME_SANITIZE_RE, "_");
  const fullPath = resolveAndGuard(root, tenantId, `logo-${sanitized}`);
  const dir = path.dirname(fullPath);

  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, buffer);

  return buildLogoStorageKey(tenantId, fileName);
}

export async function readLogo(storageKey: string, tenantId: string): Promise<Buffer> {
  validateTenantId(tenantId);
  assertKeyBelongsToTenant(storageKey, tenantId);

  const root = path.resolve(getLogoStoragePath());
  const normalizedKey = path.posix.normalize(storageKey).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("storageKey inválido.");
  }

  const fileSegment = normalizedKey.substring(normalizedKey.indexOf("/") + 1);
  const fullPath = resolveAndGuard(root, tenantId, fileSegment);

  return readFile(fullPath);
}

export async function deleteLogo(storageKey: string, tenantId: string): Promise<void> {
  validateTenantId(tenantId);
  assertKeyBelongsToTenant(storageKey, tenantId);

  const root = path.resolve(getLogoStoragePath());
  const normalizedKey = path.posix.normalize(storageKey).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("storageKey inválido.");
  }

  const fileSegment = normalizedKey.substring(normalizedKey.indexOf("/") + 1);
  const fullPath = resolveAndGuard(root, tenantId, fileSegment);

  try {
    await unlink(fullPath);
  } catch {
    // File may not exist
  }
}
