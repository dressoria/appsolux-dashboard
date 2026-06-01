import "@/lib/security/server-only";

export type SriSigningResult =
  | { ok: true; signedXml: string }
  | { ok: false; reason: string };

/**
 * Lanza un error controlado indicando que la firma real no está habilitada.
 * Usar en rutas que deben verificar disponibilidad antes de intentar firmar.
 */
export function assertSriSigningAvailable(): never {
  throw new Error(
    "Firma electrónica real no habilitada en este entorno. " +
      "Configura un certificado seguro (XAdES-BES) en una fase posterior."
  );
}

/**
 * Intento controlado de firma XAdES-BES.
 * En esta fase siempre devuelve { ok: false } — no firma, no miente.
 * Preparado para recibir la implementación real cuando esté lista.
 */
// params: { unsignedXml, tenantId, documentId } — se agregarán con la implementación XAdES real
export async function signSriXmlDraft(): Promise<SriSigningResult> {
  return {
    ok: false,
    reason:
      "Firma electrónica XAdES-BES real no habilitada en este entorno. " +
      "La implementación completa requiere configuración de certificado .p12 " +
      "y almacenamiento seguro del certificado. Se habilitará en una fase posterior.",
  };
}

/**
 * Valida metadata básica de un certificado antes de registrarla.
 * No valida el certificado real — solo los campos ingresados manualmente.
 */
export function validateCertificateMetadata(params: {
  certificateFileName: string;
  expiresAt: Date;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const lower = params.certificateFileName.trim().toLowerCase();
  if (!lower.endsWith(".p12") && !lower.endsWith(".pfx")) {
    errors.push("El nombre del certificado debe terminar en .p12 o .pfx.");
  }

  if (params.expiresAt <= new Date()) {
    errors.push("La fecha de vencimiento debe ser futura.");
  }

  return { valid: errors.length === 0, errors };
}

export function validateCertificateUpload(params: {
  fileName: string;
  fileSize: number;
  password: string;
}) {
  const errors: string[] = [];
  const lower = params.fileName.trim().toLowerCase();

  if (!lower.endsWith(".p12") && !lower.endsWith(".pfx")) {
    errors.push("Solo se permiten archivos .p12 o .pfx.");
  }

  if (!params.password.trim()) {
    errors.push("La contrasena del certificado es obligatoria.");
  }

  const maxBytes = 5 * 1024 * 1024;
  if (!Number.isFinite(params.fileSize) || params.fileSize <= 0) {
    errors.push("El archivo del certificado esta vacio.");
  } else if (params.fileSize > maxBytes) {
    errors.push("El certificado supera el maximo permitido de 5 MB.");
  }

  return { valid: errors.length === 0, errors };
}
