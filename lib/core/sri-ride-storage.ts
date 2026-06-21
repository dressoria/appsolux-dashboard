import "@/lib/security/server-only";

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

function validateSegment(label: string, value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} inválido para storage seguro.`);
  }
}

export function getRideStoragePath(): string {
  const base = process.env.SRI_RIDE_STORAGE_PATH?.trim();
  if (base) return base;

  const certPath = process.env.SRI_CERT_STORAGE_PATH?.trim();
  if (certPath) return path.join(certPath, "rides");

  throw new Error("SRI_RIDE_STORAGE_PATH no configurado.");
}

export function buildRideStorageKey(tenantId: string, documentId: string): string {
  validateSegment("tenantId", tenantId);
  validateSegment("documentId", documentId);
  return `${tenantId}/${documentId}/ride.pdf`;
}

export async function saveRidePdf(
  tenantId: string,
  documentId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const storagePath = getRideStoragePath();
  const root = path.resolve(storagePath);
  validateSegment("tenantId", tenantId);
  validateSegment("documentId", documentId);

  const dir = path.join(root, tenantId, documentId);
  const filePath = path.join(dir, "ride.pdf");

  if (!filePath.startsWith(root + path.sep)) {
    throw new Error("Path traversal bloqueado.");
  }

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, pdfBuffer);

  return buildRideStorageKey(tenantId, documentId);
}

export async function readRidePdf(storageKey: string): Promise<Buffer> {
  const storagePath = getRideStoragePath();
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
