import "@/lib/security/server-only";

import { readFile } from "fs/promises";
import path from "path";

function validateSegment(label: string, value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} invalido para storage seguro.`);
  }
}

export function getSignedXmlStoragePath(): string {
  const base = process.env.SRI_SIGNED_XML_STORAGE_PATH?.trim();
  if (base) return base;

  const certPath = process.env.SRI_CERT_STORAGE_PATH?.trim();
  if (certPath) return path.join(certPath, "signed-xml");

  throw new Error("SRI_SIGNED_XML_STORAGE_PATH no configurado.");
}

export function buildSignedXmlStorageKey(tenantId: string, documentId: string): string {
  validateSegment("tenantId", tenantId);
  validateSegment("documentId", documentId);
  return `${tenantId}/${documentId}/signed.xml`;
}

export async function readSignedXml(storageKey: string): Promise<string> {
  const storagePath = getSignedXmlStoragePath();
  const root = path.resolve(storagePath);

  const normalizedKey = path.posix.normalize(storageKey).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("storageKey invalido.");
  }

  const fullPath = path.join(root, normalizedKey);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new Error("Path traversal bloqueado.");
  }

  return readFile(fullPath, "utf8");
}
