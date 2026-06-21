import "@/lib/security/server-only";

import { readFile } from "fs/promises";
import path from "path";

function validateSegment(label: string, value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} inválido para storage seguro.`);
  }
}

export function getAuthorizedXmlStoragePath(): string {
  const base = process.env.SRI_AUTHORIZED_XML_STORAGE_PATH?.trim();
  if (base) return base;

  const certPath = process.env.SRI_CERT_STORAGE_PATH?.trim();
  if (certPath) return path.join(certPath, "authorized-xml");

  throw new Error("SRI_AUTHORIZED_XML_STORAGE_PATH no configurado.");
}

export function buildAuthorizedXmlStorageKey(
  tenantId: string,
  documentId: string
): string {
  validateSegment("tenantId", tenantId);
  validateSegment("documentId", documentId);
  return `${tenantId}/${documentId}/authorized.xml`;
}

export async function readAuthorizedXml(storageKey: string): Promise<string> {
  const storagePath = getAuthorizedXmlStoragePath();
  const root = path.resolve(storagePath);

  const normalizedKey = path.posix.normalize(storageKey).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("storageKey inválido.");
  }

  const fullPath = path.join(root, normalizedKey);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new Error("Path traversal bloqueado.");
  }

  return readFile(fullPath, "utf8");
}
