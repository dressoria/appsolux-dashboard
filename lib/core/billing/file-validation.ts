import "@/lib/security/server-only";

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const MAGIC_BYTES: Array<{ ext: string; mime: string; bytes: number[] }> = [
  { ext: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "jpeg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
];

export type FileValidationResult =
  | { ok: true; detectedType: string; detectedMime: string }
  | { ok: false; message: string };

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function validateReceiptFile(
  buffer: Buffer,
  fileName: string,
  declaredSize: number,
): FileValidationResult {
  if (declaredSize > MAX_FILE_SIZE_BYTES || buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: "El archivo excede el límite de 10 MB." };
  }

  if (buffer.length === 0) {
    return { ok: false, message: "El archivo está vacío." };
  }

  const ext = getExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, message: "Solo se permiten archivos PDF, JPG o PNG." };
  }

  const matched = MAGIC_BYTES.find(
    (entry) =>
      buffer.length >= entry.bytes.length &&
      entry.bytes.every((byte, i) => buffer[i] === byte),
  );

  if (!matched) {
    return {
      ok: false,
      message: "El contenido del archivo no corresponde a un PDF, JPG o PNG válido.",
    };
  }

  if (ext === "jpg" || ext === "jpeg") {
    if (matched.ext !== "jpg" && matched.ext !== "jpeg") {
      return { ok: false, message: "La extensión del archivo no coincide con su contenido real." };
    }
  } else if (matched.ext !== ext) {
    return { ok: false, message: "La extensión del archivo no coincide con su contenido real." };
  }

  return { ok: true, detectedType: matched.ext, detectedMime: matched.mime };
}

export function getMaxFileSizeBytes(): number {
  return MAX_FILE_SIZE_BYTES;
}
