import "@/lib/security/server-only";

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

function validateSegment(label: string, value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} inválido para storage seguro.`);
  }
}

function getLogoStoragePath(): string {
  const base = process.env.LOGO_STORAGE_PATH?.trim();
  if (base) return base;
  return "/app/.appsolux-secure/logos";
}

export function buildLogoStorageKey(tenantId: string, fileName: string): string {
  validateSegment("tenantId", tenantId);
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${tenantId}/logo-${sanitized}`;
}

export async function saveLogo(
  tenantId: string,
  fileName: string,
  buffer: Buffer,
): Promise<string> {
  const storagePath = getLogoStoragePath();
  const root = path.resolve(storagePath);
  validateSegment("tenantId", tenantId);

  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(root, tenantId);
  const filePath = path.join(dir, `logo-${sanitized}`);

  if (!filePath.startsWith(root + path.sep)) {
    throw new Error("Path traversal bloqueado.");
  }

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, buffer);

  return buildLogoStorageKey(tenantId, fileName);
}

export async function readLogo(storageKey: string): Promise<Buffer> {
  const storagePath = getLogoStoragePath();
  const root = path.resolve(storagePath);

  const normalizedKey = path.posix.normalize(storageKey).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("storageKey inválido.");
  }

  const fullPath = path.join(root, normalizedKey);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new Error("Path traversal bloqueado.");
  }

  return readFile(fullPath);
}

export async function deleteLogo(storageKey: string): Promise<void> {
  const storagePath = getLogoStoragePath();
  const root = path.resolve(storagePath);

  const normalizedKey = path.posix.normalize(storageKey).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("storageKey inválido.");
  }

  const fullPath = path.join(root, normalizedKey);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new Error("Path traversal bloqueado.");
  }

  try {
    await unlink(fullPath);
  } catch {
    // File may not exist
  }
}
