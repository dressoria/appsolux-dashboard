import "@/lib/security/server-only";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const STORAGE_DIR =
  process.env.PRODUCT_IMAGE_STORAGE_PATH ??
  "/app/.appsolux-secure/product-images";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SIZE = 5 * 1024 * 1024;

function getStoragePath(tenantId: string) {
  return path.join(STORAGE_DIR, tenantId);
}

export function validateImageUpload(
  file: { name: string; type: string; size: number },
) {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Extensión no permitida: ${ext}` };
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return { valid: false, error: `Tipo MIME no permitido: ${file.type}` };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: "Imagen excede 5 MB" };
  }
  return { valid: true, error: null };
}

export async function saveProductImage(
  tenantId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
  const key = `${randomUUID()}${safeExt}`;

  const dir = getStoragePath(tenantId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, key);
  await fs.writeFile(filePath, buffer);

  return `${tenantId}/${key}`;
}

export async function deleteProductImage(storageKey: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, storageKey);
  try {
    await fs.unlink(filePath);
  } catch {
    // file may not exist
  }
}

export async function getImagePath(storageKey: string): Promise<string | null> {
  const filePath = path.join(STORAGE_DIR, storageKey);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

export function getImageMime(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}
