import "@/lib/security/server-only";

import { readFile } from "fs/promises";
import path from "path";

function validateSegment(label: string, value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} inválido para storage seguro.`);
  }
}

export function getAuthorizedXmlStoragePath(): string {
  const explicit = process.env.SRI_AUTHORIZED_XML_STORAGE_PATH?.trim();
  if (explicit) return explicit;

  // Dedicated volume mounted in docker-compose.prod.yml.
  // Must match the host path used by the signing worker
  // (/home/ubuntu/appsolux-secure/sri-authorized-xml).
  return "/app/.appsolux-secure/sri-authorized-xml";
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

  try {
    return await readFile(fullPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "XML autorizado aún no disponible. " +
          "Verifica que el volumen sri-authorized-xml esté montado y el worker haya procesado este documento."
      );
    }
    throw err;
  }
}
