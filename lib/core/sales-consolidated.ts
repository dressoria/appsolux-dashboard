import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

// ── Types ────────────────────────────────────────────────────────────────────

export type ConsolidatedSale = {
  id: string;
  source: "FACTUROM" | "MANUAL_IMPORT" | "API" | "TELEGRAM" | "SRI_FACTURADOR" | "OTHER" | "LEGACY_IMPORT";
  documentType: string;
  documentNumber: string | null;
  accessKey: string | null;
  issueDate: string | null;
  customerName: string | null;
  customerIdentification: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: string;
};

export type ConsolidatedSalesResult = {
  items: ConsolidatedSale[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type ConsolidatedSalesFilters = {
  page: number;
  perPage: number;
  source?: string;
  documentType?: string;
  from?: Date;
  to?: Date;
  q?: string;
};

export type ConsolidatedTotals = {
  totalSales: number;
  totalAmount: number;
  facturomCount: number;
  facturomAmount: number;
  externalCount: number;
  externalAmount: number;
};

// ── Source badge label ───────────────────────────────────────────────────────

export const SOURCE_LABELS: Record<string, string> = {
  FACTUROM: "Facturom",
  MANUAL_IMPORT: "Archivo",
  API: "API",
  TELEGRAM: "Telegram",
  SRI_FACTURADOR: "SRI",
  OTHER: "Otro",
  LEGACY_IMPORT: "Archivo",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeDisplayNumber(doc: {
  establishment?: { code: string } | null;
  issuePoint?: { code: string } | null;
  sequentialNumber?: number | null;
}): string | null {
  if (!doc.establishment?.code || !doc.issuePoint?.code || !doc.sequentialNumber) return null;
  return `${doc.establishment.code}-${doc.issuePoint.code}-${String(doc.sequentialNumber).padStart(9, "0")}`;
}

// ── Consolidated read layer ──────────────────────────────────────────────────

export async function listConsolidatedSales(
  tenantId: string,
  filters: ConsolidatedSalesFilters,
): Promise<ConsolidatedSalesResult> {
  const prisma = getPrismaClient();
  const { page, perPage, source, documentType, from, to, q } = filters;
  const skip = (page - 1) * perPage;

  // We'll query both sources and merge
  const results: ConsolidatedSale[] = [];

  const shouldIncludeFacturom = !source || source === "FACTUROM" || source === "all";
  const shouldIncludeLegacy = !source || source === "LEGACY_IMPORT" || source === "MANUAL_IMPORT" || source === "all";
  const shouldIncludeExternal = !source || !["FACTUROM", "LEGACY_IMPORT"].includes(source);

  // 1. Facturom native sales (from SriDocument — authorized invoices)
  if (shouldIncludeFacturom && (!documentType || documentType === "INVOICE")) {
    const sriWhere: Record<string, unknown> = {
      tenantId,
      documentType: "INVOICE",
    };
    if (from || to) {
      sriWhere.issuedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (q) {
      sriWhere.OR = [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerIdentification: { contains: q, mode: "insensitive" } },
        { accessKey: { contains: q } },
      ];
    }

    const sriDocs = await prisma.sriDocument.findMany({
      where: sriWhere,
      select: {
        id: true,
        accessKey: true,
        issuedAt: true,
        customerName: true,
        customerIdentification: true,
        subtotal: true,
        taxTotal: true,
        grandTotal: true,
        status: true,
        documentType: true,
        sequentialNumber: true,
        establishment: { select: { code: true } },
        issuePoint: { select: { code: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: perPage * 3,
    });

    for (const doc of sriDocs) {
      results.push({
        id: doc.id,
        source: "FACTUROM",
        documentType: doc.documentType,
        documentNumber: computeDisplayNumber(doc),
        accessKey: doc.accessKey,
        issueDate: doc.issuedAt?.toISOString() ?? null,
        customerName: doc.customerName,
        customerIdentification: doc.customerIdentification,
        subtotal: Number(doc.subtotal),
        taxTotal: Number(doc.taxTotal),
        total: Number(doc.grandTotal),
        status: doc.status,
      });
    }
  }

  // 2. Legacy LightweightSale IMPORT
  if (shouldIncludeLegacy && (!documentType || documentType === "INVOICE")) {
    const legacyWhere: Record<string, unknown> = {
      tenantId,
      origin: "IMPORT",
    };
    if (from || to) {
      legacyWhere.originalIssuedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (q) {
      legacyWhere.OR = [
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { identification: { contains: q, mode: "insensitive" } } },
        { externalReference: { contains: q, mode: "insensitive" } },
      ];
    }

    const legacySales = await prisma.lightweightSale.findMany({
      where: legacyWhere,
      select: {
        id: true,
        externalReference: true,
        originalIssuedAt: true,
        subtotal: true,
        taxTotal: true,
        total: true,
        status: true,
        customer: { select: { name: true, identification: true } },
      },
      orderBy: { originalIssuedAt: "desc" },
      take: perPage * 2,
    });

    for (const s of legacySales) {
      results.push({
        id: s.id,
        source: "LEGACY_IMPORT",
        documentType: "INVOICE",
        documentNumber: s.externalReference,
        accessKey: null,
        issueDate: s.originalIssuedAt?.toISOString() ?? null,
        customerName: s.customer?.name ?? "Consumidor Final",
        customerIdentification: s.customer?.identification ?? null,
        subtotal: Number(s.subtotal),
        taxTotal: Number(s.taxTotal),
        total: Number(s.total),
        status: s.status,
      });
    }
  }

  // 3. ExternalSalesDocument
  if (shouldIncludeExternal) {
    const extWhere: Record<string, unknown> = { tenantId };
    if (source && source !== "all") {
      extWhere.source = source;
    }
    if (documentType) {
      extWhere.documentType = documentType;
    }
    if (from || to) {
      extWhere.issueDate = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (q) {
      extWhere.OR = [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerIdentification: { contains: q, mode: "insensitive" } },
        { documentNumber: { contains: q, mode: "insensitive" } },
        { accessKey: { contains: q } },
      ];
    }

    const extDocs = await prisma.externalSalesDocument.findMany({
      where: extWhere,
      orderBy: { issueDate: "desc" },
      take: perPage * 3,
    });

    for (const d of extDocs) {
      results.push({
        id: d.id,
        source: d.source as ConsolidatedSale["source"],
        documentType: d.documentType,
        documentNumber: d.documentNumber,
        accessKey: d.accessKey,
        issueDate: d.issueDate.toISOString(),
        customerName: d.customerName,
        customerIdentification: d.customerIdentification,
        subtotal: Number(d.subtotal),
        taxTotal: Number(d.taxTotal),
        total: Number(d.total),
        status: d.status,
      });
    }
  }

  // Sort by date desc
  results.sort((a, b) => {
    const da = a.issueDate ? new Date(a.issueDate).getTime() : 0;
    const db = b.issueDate ? new Date(b.issueDate).getTime() : 0;
    return db - da;
  });

  // Deduplicate by accessKey (Facturom wins)
  const seen = new Set<string>();
  const deduped: ConsolidatedSale[] = [];
  for (const item of results) {
    if (item.accessKey) {
      if (seen.has(item.accessKey)) continue;
      seen.add(item.accessKey);
    }
    deduped.push(item);
  }

  const total = deduped.length;
  const paged = deduped.slice(skip, skip + perPage);

  return {
    items: paged,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ── Totals ───────────────────────────────────────────────────────────────────

export async function getConsolidatedSalesTotals(
  tenantId: string,
  filters: { from?: Date; to?: Date },
): Promise<ConsolidatedTotals> {
  const prisma = getPrismaClient();
  const { from, to } = filters;

  const dateFilter = from || to
    ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
    : undefined;

  // Facturom SriDocument totals
  const sriAgg = await prisma.sriDocument.aggregate({
    where: {
      tenantId,
      documentType: "INVOICE",
      ...(dateFilter ? { issuedAt: dateFilter } : {}),
    },
    _count: true,
    _sum: { grandTotal: true },
  });

  // External totals
  const extAgg = await prisma.externalSalesDocument.aggregate({
    where: {
      tenantId,
      status: { not: "DUPLICATE" },
      ...(dateFilter ? { issueDate: dateFilter } : {}),
    },
    _count: true,
    _sum: { total: true },
  });

  // Legacy import totals
  const legacyAgg = await prisma.lightweightSale.aggregate({
    where: {
      tenantId,
      origin: "IMPORT",
      ...(dateFilter ? { originalIssuedAt: dateFilter } : {}),
    },
    _count: true,
    _sum: { total: true },
  });

  const facturomCount = sriAgg._count;
  const facturomAmount = Number(sriAgg._sum.grandTotal ?? 0);
  const externalCount = extAgg._count + legacyAgg._count;
  const externalAmount = Number(extAgg._sum.total ?? 0) + Number(legacyAgg._sum.total ?? 0);

  return {
    totalSales: facturomCount + externalCount,
    totalAmount: facturomAmount + externalAmount,
    facturomCount,
    facturomAmount,
    externalCount,
    externalAmount,
  };
}
