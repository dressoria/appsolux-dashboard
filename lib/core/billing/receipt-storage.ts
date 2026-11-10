import "@/lib/security/server-only";

import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const TENANT_ID_RE = /^[a-zA-Z0-9_-]+$/;

function validateTenantId(tenantId: string) {
  if (!TENANT_ID_RE.test(tenantId)) {
    throw new Error("tenantId inválido para storage seguro.");
  }
}

function getReceiptStoragePath(): string {
  const base = process.env.RECEIPT_STORAGE_PATH?.trim();
  if (base) return base;
  return "/app/.appsolux-secure/bank-transfer-receipts";
}

function resolveAndGuard(root: string, tenantId: string, relativePath: string): string {
  const tenantDir = path.join(root, tenantId);
  const fullPath = path.resolve(tenantDir, relativePath);
  if (!fullPath.startsWith(tenantDir + path.sep) && fullPath !== tenantDir) {
    throw new Error("Path traversal bloqueado.");
  }
  return fullPath;
}

function extractTenantPrefix(fileId: string): string {
  const slash = fileId.indexOf("/");
  if (slash <= 0) throw new Error("fileId formato inválido.");
  return fileId.substring(0, slash);
}

function assertFileBelongsToTenant(fileId: string, tenantId: string) {
  const fileTenant = extractTenantPrefix(fileId);
  if (fileTenant !== tenantId) {
    throw new Error("Acceso denegado al recurso.");
  }
}

export async function saveReceipt(
  tenantId: string,
  extension: string,
  buffer: Buffer,
): Promise<string> {
  validateTenantId(tenantId);
  const root = path.resolve(getReceiptStoragePath());
  const uuid = randomUUID();
  const fileName = `${uuid}.${extension}`;
  const fullPath = resolveAndGuard(root, tenantId, fileName);
  const dir = path.dirname(fullPath);

  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, buffer);

  return `${tenantId}/${fileName}`;
}

export async function readReceipt(fileId: string, tenantId: string): Promise<Buffer> {
  validateTenantId(tenantId);
  assertFileBelongsToTenant(fileId, tenantId);

  const root = path.resolve(getReceiptStoragePath());
  const normalizedId = path.posix.normalize(fileId).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedId || normalizedId.includes("..")) {
    throw new Error("fileId inválido.");
  }

  const fileSegment = normalizedId.substring(normalizedId.indexOf("/") + 1);
  const fullPath = resolveAndGuard(root, tenantId, fileSegment);

  return readFile(fullPath);
}

export async function readReceiptAsAdmin(fileId: string): Promise<Buffer> {
  const tenantId = extractTenantPrefix(fileId);
  validateTenantId(tenantId);

  const root = path.resolve(getReceiptStoragePath());
  const normalizedId = path.posix.normalize(fileId).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedId || normalizedId.includes("..")) {
    throw new Error("fileId inválido.");
  }

  const fileSegment = normalizedId.substring(normalizedId.indexOf("/") + 1);
  const fullPath = resolveAndGuard(root, tenantId, fileSegment);

  return readFile(fullPath);
}

export async function deleteReceipt(fileId: string, tenantId: string): Promise<void> {
  validateTenantId(tenantId);
  assertFileBelongsToTenant(fileId, tenantId);

  const root = path.resolve(getReceiptStoragePath());
  const normalizedId = path.posix.normalize(fileId).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedId || normalizedId.includes("..")) {
    throw new Error("fileId inválido.");
  }

  const fileSegment = normalizedId.substring(normalizedId.indexOf("/") + 1);
  const fullPath = resolveAndGuard(root, tenantId, fileSegment);

  try {
    await unlink(fullPath);
  } catch {
    // File may not exist
  }
}
