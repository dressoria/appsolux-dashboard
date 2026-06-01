import "@/lib/security/server-only";

import { mkdir, writeFile } from "fs/promises";
import path from "path";

function validateSegment(label: string, value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} invalido para storage seguro.`);
  }
}

function sanitizeBaseName(fileName: string) {
  const baseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!baseName) {
    throw new Error("Nombre de archivo invalido.");
  }
  return baseName;
}

export function buildSriCertificateStorageKey(params: {
  tenantId: string;
  originalFileName: string;
  timestamp?: number;
}) {
  validateSegment("tenantId", params.tenantId);
  const baseName = sanitizeBaseName(params.originalFileName);
  const stamp = params.timestamp ?? Date.now();
  return path.posix.join(params.tenantId, "certificates", `${stamp}-${baseName}.enc`);
}

export async function saveEncryptedSriCertificate(params: {
  storageRoot: string;
  storageKey: string;
  encryptedContent: string;
}) {
  if (!params.storageRoot.trim()) {
    throw new Error("SRI_CERT_STORAGE_PATH no esta configurada.");
  }

  const root = path.resolve(params.storageRoot.trim());
  const normalizedKey = path.posix.normalize(params.storageKey).replace(/^(\.\.\/|\.\/|\/)+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("storageKey invalido para certificado seguro.");
  }

  const destination = path.join(root, normalizedKey);
  if (!destination.startsWith(root + path.sep)) {
    throw new Error("El certificado intenta escribirse fuera del storage seguro.");
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, params.encryptedContent, "utf8");

  return { storageKey: normalizedKey };
}
