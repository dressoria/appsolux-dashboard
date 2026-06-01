import "@/lib/security/server-only";

import { createCipheriv, randomBytes } from "crypto";

const VERSION_PREFIX = "v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function parseKey(keyHex: string): Buffer {
  const stripped = keyHex.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(stripped)) {
    throw new Error(
      `SRI_CERT_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales. Longitud actual: ${stripped.length}.`
    );
  }

  const buffer = Buffer.from(stripped, "hex");
  if (buffer.length !== KEY_BYTES) {
    throw new Error(`SRI_CERT_ENCRYPTION_KEY debe ser exactamente ${KEY_BYTES} bytes.`);
  }

  return buffer;
}

function encodeEncrypted(iv: Buffer, authTag: Buffer, ciphertext: Buffer): string {
  if (iv.length !== IV_BYTES) {
    throw new Error(`IV invalido: se esperaban ${IV_BYTES} bytes.`);
  }
  if (authTag.length !== TAG_BYTES) {
    throw new Error(`Auth tag invalido: se esperaban ${TAG_BYTES} bytes.`);
  }
  return `${VERSION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function encryptBuffer(plain: Buffer, keyHex: string): string {
  const key = parseKey(keyHex);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return encodeEncrypted(iv, authTag, ciphertext);
}

export function encryptText(plain: string, keyHex: string): string {
  return encryptBuffer(Buffer.from(plain, "utf8"), keyHex);
}

export const SRI_ENCRYPTION_KEY_VERSION = "v1";
