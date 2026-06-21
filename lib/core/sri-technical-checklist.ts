import "@/lib/security/server-only";
import {
  buildSriAccessKey,
  buildSriDisplayNumber,
  createStableNumericCode,
} from "./sri-access-key";
import type { SriSigningJobStatus } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";

export type SriChecklistItemStatus = "PASS" | "WARN" | "FAIL";

export type SriChecklistItem = {
  key: string;
  label: string;
  status: SriChecklistItemStatus;
};

export type SriTechnicalChecklistResult = {
  status: "BLOCKED" | "WARNING" | "READY";
  blockingIssues: string[];
  warnings: string[];
  passedChecks: string[];
  displayNumber: string | null;
  accessKey: string | null;
  numberingPersisted: boolean;
  items: SriChecklistItem[];
};

export type SriTechnicalChecklistInput = {
  documentId: string;
  document: {
    documentType: string;
    status: string;
    sequenceId: string | null;
    grandTotal: string | number;
    sequentialNumber: number | null;
    accessKey: string | null;
    customerName: string;
    customerIdentification: string | null;
    customerEmail: string | null;
    issuedAt: Date | null;
    createdAt: Date;
  };
  lines: Array<{
    itemName: string;
    quantity: string | number;
    unitPrice: string | number;
  }>;
  profile: {
    ruc: string;
    legalName: string;
    environment: "TEST" | "PRODUCTION";
  } | null;
  establishment: {
    code: string;
    name: string;
  } | null;
  issuePoint: {
    code: string;
  } | null;
  sequence: {
    isActive: boolean;
    currentNumber: number;
  } | null;
};

export type SriSigningReadiness = {
  document: NonNullable<Awaited<ReturnType<typeof loadSriDocumentReadinessContext>>["document"]>;
  latestChecklist: SriTechnicalChecklistResult;
  blockingErrors: string[];
  warnings: string[];
  canRequestSigning: boolean;
  missingSignatureReasons: string[];
  displayNumber: string | null;
  accessKey: string | null;
  hasActiveSigningJob: boolean;
  activeSigningJobStatus: SriSigningJobStatus | null;
};

export function runSriTechnicalChecklist(
  input: SriTechnicalChecklistInput
): SriTechnicalChecklistResult {
  const items: SriChecklistItem[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const passedChecks: string[] = [];

  function pass(key: string, label: string) {
    items.push({ key, label, status: "PASS" });
    passedChecks.push(label);
  }
  function fail(key: string, label: string) {
    items.push({ key, label, status: "FAIL" });
    blockingIssues.push(label);
  }
  function warn(key: string, label: string) {
    items.push({ key, label, status: "WARN" });
    warnings.push(label);
  }

  // ── Emisor ───────────────────────────────────────────────────────────────────
  if (input.profile) {
    pass("profile_exists", "Perfil tributario configurado");
    if (/^\d{13}$/.test(input.profile.ruc)) {
      pass("ruc_valid", `RUC del emisor válido (${input.profile.ruc})`);
    } else {
      fail(
        "ruc_valid",
        `RUC inválido: debe tener 13 dígitos (actual: ${input.profile.ruc.length})`
      );
    }
    if (input.profile.legalName.trim()) {
      pass("legal_name", "Razón social del emisor configurada");
    } else {
      fail("legal_name", "Razón social del emisor es requerida");
    }
    pass(
      "environment",
      `Ambiente: ${input.profile.environment === "TEST" ? "Pruebas" : "Producción"}`
    );
  } else {
    fail("profile_exists", "Perfil tributario no configurado — ve a SRI → Configuración");
    fail("ruc_valid", "RUC no disponible — configura el perfil tributario");
    fail("legal_name", "Razón social no disponible — configura el perfil tributario");
  }

  if (input.establishment) {
    if (/^\d{3}$/.test(input.establishment.code)) {
      pass(
        "establishment",
        `Establecimiento ${input.establishment.code} — ${input.establishment.name}`
      );
    } else {
      fail(
        "establishment",
        `Código de establecimiento debe ser 3 dígitos (actual: "${input.establishment.code}")`
      );
    }
  } else {
    fail("establishment", "Establecimiento no encontrado");
  }

  if (input.issuePoint) {
    if (/^\d{3}$/.test(input.issuePoint.code)) {
      pass("issue_point", `Punto de emisión ${input.issuePoint.code}`);
    } else {
      fail(
        "issue_point",
        `Código de punto de emisión debe ser 3 dígitos (actual: "${input.issuePoint.code}")`
      );
    }
  } else {
    fail("issue_point", "Punto de emisión no encontrado");
  }

  if (input.document.sequenceId && input.document.sequentialNumber != null) {
    pass("sequence", "Secuencia persistida en el comprobante");
  } else if (input.sequence) {
    if (input.sequence.isActive) {
      pass("sequence", "Secuencia de factura activa y disponible para reservar");
    } else {
      fail("sequence", "La secuencia de factura está inactiva");
    }
  } else {
    fail("sequence", "No hay secuencia de factura para este punto de emisión");
  }

  // ── Comprador ────────────────────────────────────────────────────────────────
  if (input.document.customerName.trim()) {
    pass("customer_name", "Nombre del cliente presente");
  } else {
    fail("customer_name", "Nombre del cliente es requerido");
  }

  if (input.document.customerIdentification) {
    pass("customer_id", "Identificación del cliente presente");
  } else {
    warn("customer_id", "Sin identificación — se usará Consumidor Final (9999999999999)");
  }

  if (input.document.customerEmail) {
    pass("customer_email", "Email del cliente presente");
  } else {
    warn("customer_email", "Sin email del cliente (opcional para envío de comprobante)");
  }

  // ── Documento ────────────────────────────────────────────────────────────────
  if (input.document.documentType === "INVOICE") {
    pass("doc_type", "Tipo de documento: Factura (soportado en esta fase)");
  } else {
    fail(
      "doc_type",
      `Tipo '${input.document.documentType}' no está soportado en esta fase`
    );
  }

  const total = Number(input.document.grandTotal);
  if (total > 0) {
    pass("total_positive", `Total mayor a $0 ($${total.toFixed(2)})`);
  } else {
    fail("total_positive", "El total del comprobante debe ser mayor a $0");
  }

  if (input.lines.length > 0) {
    pass("has_lines", `${input.lines.length} línea(s) de detalle`);

    const badNames = input.lines.filter((l) => !l.itemName.trim()).length;
    if (badNames === 0) {
      pass("line_names", "Todas las líneas tienen nombre de item");
    } else {
      fail("line_names", `${badNames} línea(s) sin nombre de item`);
    }

    const badQty = input.lines.filter((l) => Number(l.quantity) <= 0).length;
    if (badQty === 0) {
      pass("line_qty", "Todas las líneas tienen cantidad mayor a 0");
    } else {
      fail("line_qty", `${badQty} línea(s) con cantidad <= 0`);
    }
  } else {
    fail("has_lines", "El comprobante debe tener al menos una línea");
  }

  // ── Numeración y clave de acceso ─────────────────────────────────────────────
  let displayNumber: string | null = null;
  let accessKey: string | null = null;
  const numberingPersisted = Boolean(
    input.document.sequenceId && input.document.sequentialNumber != null && input.document.accessKey
  );

  if (input.establishment && input.issuePoint && (input.document.sequentialNumber != null || input.sequence)) {
    const sequential = input.document.sequentialNumber ?? input.sequence!.currentNumber;
    displayNumber = buildSriDisplayNumber(
      input.establishment.code,
      input.issuePoint.code,
      sequential
    );
    pass(
      "display_number",
      numberingPersisted
        ? `Número de comprobante reservado: ${displayNumber}`
        : `Número de comprobante candidato: ${displayNumber}`
    );
  } else {
    fail(
      "display_number",
      "No se puede calcular el número — faltan establecimiento, punto o secuencia"
    );
  }

  if (input.document.accessKey) {
    accessKey = input.document.accessKey;
    pass("access_key", `Clave de acceso persistida (${accessKey.length} dígitos)`);
  } else if (input.profile && input.establishment && input.issuePoint && input.sequence) {
    const sequential = input.document.sequentialNumber ?? input.sequence.currentNumber;
    try {
      const numericCode = createStableNumericCode(input.documentId);
      const keyResult = buildSriAccessKey({
        issuedAt: input.document.issuedAt ?? input.document.createdAt,
        documentType: input.document.documentType,
        ruc: input.profile.ruc,
        environment: input.profile.environment,
        establishmentCode: input.establishment.code,
        issuePointCode: input.issuePoint.code,
        sequentialNumber: sequential,
        numericCode,
      });
      accessKey = keyResult.accessKey;
      pass("access_key", `Clave de acceso candidata (${accessKey.length} dígitos)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      fail("access_key", `Error al generar clave de acceso: ${msg}`);
    }
  } else {
    fail("access_key", "No se puede generar clave de acceso — faltan datos del emisor");
  }

  if (input.document.status === "READY_FOR_TESTING" && !numberingPersisted) {
    fail(
      "numbering_persisted",
      "El comprobante listo para pruebas debe tener secuencia y clave persistidas antes de firmarse."
    );
  }

  // ── Estado final ──────────────────────────────────────────────────────────────
  const status: "BLOCKED" | "WARNING" | "READY" =
    blockingIssues.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "READY";

  return {
    status,
    blockingIssues,
    warnings,
    passedChecks,
    displayNumber,
    accessKey,
    numberingPersisted,
    items,
  };
}

function getSignatureReadinessReasons(params: {
  signatureConfig: {
    certificateFileName: string | null;
    status: "NOT_UPLOADED" | "UPLOADED_METADATA_ONLY" | "READY_FOR_TESTING" | "EXPIRED";
    encryptedCertificateStorageKey: string | null;
    encryptedCertificatePassword: string | null;
  } | null;
}): string[] {
  const sigConfig = params.signatureConfig;
  const reasons: string[] = [];

  if (!sigConfig?.certificateFileName || !sigConfig?.encryptedCertificateStorageKey) {
    reasons.push("Falta cargar certificado .p12/.pfx");
  }

  if (!sigConfig?.encryptedCertificatePassword) {
    reasons.push("Falta contraseña cifrada");
  }

  if (sigConfig?.status === "EXPIRED") {
    reasons.push("El certificado de firma está vencido");
  }

  return Array.from(new Set(reasons));
}

async function loadSriDocumentReadinessContext(tenantId: string, documentId: string) {
  const prisma = getPrismaClient();

  const document = await prisma.sriDocument.findFirst({
    where: { id: documentId, tenantId },
    include: {
      establishment: true,
      issuePoint: true,
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!document) {
    return {
      document: null,
      profile: null,
      sequence: null,
      signatureConfig: null,
      activeSigningJob: null,
    };
  }

  const [profile, sequence, signatureConfig, activeSigningJob] = await Promise.all([
    prisma.sriTaxpayerProfile.findUnique({
      where: { tenantId },
    }),
    prisma.sriDocumentSequence.findFirst({
      where: {
        tenantId,
        establishmentId: document.establishmentId,
        issuePointId: document.issuePointId,
        documentType: document.documentType,
        isActive: true,
      },
    }),
    prisma.sriSignatureConfig.findUnique({
      where: { tenantId },
      select: {
        certificateFileName: true,
        status: true,
        encryptedCertificateStorageKey: true,
        encryptedCertificatePassword: true,
      },
    }),
    prisma.sriSigningJob.findFirst({
      where: {
        tenantId,
        documentId,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
  ]);

  return {
    document,
    profile,
    sequence,
    signatureConfig,
    activeSigningJob,
  };
}

export async function getSriDocumentTechnicalChecklist(
  tenantId: string,
  documentId: string
): Promise<SriTechnicalChecklistResult | null> {
  const context = await loadSriDocumentReadinessContext(tenantId, documentId);

  if (!context.document) {
    return null;
  }

  return runSriTechnicalChecklist({
    documentId: context.document.id,
    document: {
      documentType: context.document.documentType,
      status: context.document.status,
      sequenceId: context.document.sequenceId,
      grandTotal: context.document.grandTotal.toString(),
      sequentialNumber: context.document.sequentialNumber,
      accessKey: context.document.accessKey,
      customerName: context.document.customerName,
      customerIdentification: context.document.customerIdentification,
      customerEmail: context.document.customerEmail,
      issuedAt: context.document.issuedAt,
      createdAt: context.document.createdAt,
    },
    lines: context.document.lines.map((line) => ({
      itemName: line.itemName,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
    })),
    profile: context.profile
      ? {
          ruc: context.profile.ruc,
          legalName: context.profile.legalName,
          environment: context.profile.environment,
        }
      : null,
    establishment: context.document.establishment
      ? {
          code: context.document.establishment.code,
          name: context.document.establishment.name,
        }
      : null,
    issuePoint: context.document.issuePoint
      ? {
          code: context.document.issuePoint.code,
        }
      : null,
    sequence: context.sequence
      ? {
          isActive: context.sequence.isActive,
          currentNumber: context.sequence.currentNumber,
        }
      : null,
  });
}

export async function getSriDocumentReadinessForSigning(
  tenantId: string,
  documentId: string
): Promise<SriSigningReadiness | null> {
  const context = await loadSriDocumentReadinessContext(tenantId, documentId);

  if (!context.document) {
    return null;
  }

  const latestChecklist = await getSriDocumentTechnicalChecklist(tenantId, documentId);
  if (!latestChecklist) {
    return null;
  }

  const missingSignatureReasons = getSignatureReadinessReasons({
    signatureConfig: context.signatureConfig,
  });

  if (context.activeSigningJob) {
    missingSignatureReasons.push("Ya existe un job en cola/proceso");
  }

  return {
    document: context.document,
    latestChecklist,
    blockingErrors: latestChecklist.blockingIssues,
    warnings: latestChecklist.warnings,
    canRequestSigning:
      context.document.status === "READY_FOR_TESTING" &&
      latestChecklist.blockingIssues.length === 0 &&
      missingSignatureReasons.length === 0,
    missingSignatureReasons: Array.from(new Set(missingSignatureReasons)),
    displayNumber: latestChecklist.displayNumber,
    accessKey: latestChecklist.accessKey,
    hasActiveSigningJob: Boolean(context.activeSigningJob),
    activeSigningJobStatus: context.activeSigningJob?.status ?? null,
  };
}
