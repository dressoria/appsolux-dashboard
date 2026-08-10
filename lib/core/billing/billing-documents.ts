import "@/lib/security/server-only";
import type { LightweightPaymentStatus, LightweightSaleStatus, Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";

export type BillingDocumentListItem = {
  id: string;
  type: "BASIC_SALE" | "SRI_DOCUMENT";
  displayNumber: string | null;
  customerName: string | null;
  customerIdentification: string | null;
  total: string | null;
  issuedAt: string | null;
  source: "CORE" | "SHARED_ERP" | "SRI" | "BASIC_HISTORY";
  sourceLabel: string;
  internalStatus: string | null;
  internalStatusLabel: string | null;
  sriStatus: string | null;
  sriStatusLabel: string | null;
  sriDocumentId: string | null;
  accessKey: string | null;
  authorizationNumber: string | null;
  authorizationDate: string | null;
  environment: string | null;
  rejectionMessage: string | null;
  saleDetailHref: string | null;
  sriDetailHref: string | null;
  itemsSummary: string | null;
  itemsUnavailable?: boolean;
};

const INTERNAL_STATUS_LABELS: Record<string, string> = {
  paid: "Pagado",
  partial: "Parcial",
  pending: "Pendiente",
  canceled: "Cancelado",
};

const SRI_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  READY_FOR_TESTING: "Listo para firma",
  VALIDATION_ERROR: "Error de validación",
  SIGNED: "Firmado",
  SENT: "Recibido por SRI",
  AUTHORIZED: "Autorizado",
  REJECTED: "Rechazado",
  CANCELLED: "Anulado",
};

function sriLabel(status: string): string {
  return SRI_STATUS_LABELS[status] ?? status;
}

function formatDisplayNumber(
  estCode: string,
  ipCode: string,
  seq: number | null
): string {
  if (seq == null) return `${estCode}-${ipCode} · pendiente`;
  return `${estCode}-${ipCode}-${String(seq).padStart(9, "0")}`;
}

const VALID_SRI_STATUSES = [
  "DRAFT",
  "READY_FOR_TESTING",
  "SIGNED",
  "SENT",
  "AUTHORIZED",
  "REJECTED",
  "CANCELLED",
] as const;

// ── Basic history for SHARED_ERP (ventas internas históricas) ─────────────────

async function loadBasicHistoryItems(
  tenantId: string,
  limit = 30
): Promise<BillingDocumentListItem[]> {
  const prisma = getPrismaClient();
  const sales = await prisma.lightweightSale.findMany({
    where: { tenantId, status: { not: "canceled" } },
    include: {
      customer: { select: { name: true, identification: true } },
      items: { include: { product: { select: { name: true } } }, take: 4 },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (sales.length === 0) return [];

  const saleIds = sales.map((s) => s.id);
  const sriDocs = await prisma.sriDocument.findMany({
    where: { tenantId, sourceType: "BASIC_SALE", sourceId: { in: saleIds } },
    select: {
      id: true,
      sourceId: true,
      status: true,
      environment: true,
      accessKey: true,
      customerIdentification: true,
      establishment: { select: { code: true } },
      issuePoint: { select: { code: true } },
      sequentialNumber: true,
      submissionJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          sriAuthorizationNumber: true,
          authorizedAt: true,
          errorMessage: true,
          sriReceiptStatus: true,
          sriAuthorizationStatus: true,
        },
      },
    },
  });

  const sriBySourceId = Object.fromEntries(
    sriDocs.filter((d) => d.sourceId).map((d) => [d.sourceId!, d])
  );

  return sales.map((sale) => {
    const sri = sriBySourceId[sale.id] ?? null;
    const job = sri?.submissionJobs[0] ?? null;
    const rejectionMessage =
      sri?.status === "REJECTED"
        ? job?.errorMessage ?? job?.sriAuthorizationStatus ?? job?.sriReceiptStatus ?? null
        : null;
    const displayNumber = sri
      ? formatDisplayNumber(
          sri.establishment?.code ?? "???",
          sri.issuePoint?.code ?? "???",
          sri.sequentialNumber
        )
      : null;

    return {
      id: sale.id,
      type: "BASIC_SALE" as const,
      displayNumber,
      customerName: sale.customer?.name ?? null,
      customerIdentification: sri?.customerIdentification ?? sale.customer?.identification ?? null,
      total: sale.total.toString(),
      issuedAt: sale.createdAt.toISOString(),
      source: "BASIC_HISTORY" as const,
      sourceLabel: "Historial Básico",
      internalStatus: sale.status,
      internalStatusLabel: INTERNAL_STATUS_LABELS[sale.status] ?? sale.status,
      sriStatus: sri?.status ?? null,
      sriStatusLabel: sri ? sriLabel(sri.status) : null,
      sriDocumentId: sri?.id ?? null,
      accessKey: sri?.accessKey ?? null,
      authorizationNumber: job?.sriAuthorizationNumber ?? null,
      authorizationDate: job?.authorizedAt ? job.authorizedAt.toISOString() : null,
      environment: sri?.environment ?? null,
      rejectionMessage,
      saleDetailHref: `/basic/sales/${sale.id}`,
      sriDetailHref: sri ? `/sri/documents/${sri.id}` : null,
      itemsSummary:
        sale.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ") || null,
    };
  });
}

export async function loadCoreDocuments(
  tenantId: string,
  options: {
    status?: string;
    type?: "all" | "receipt" | "sri" | "authorized" | "pending" | "rejected" | "canceled";
    search?: string;
    from?: Date;
    to?: Date;
    page?: number;
    perPage?: number;
    sort?: "date" | "total";
  } = {}
): Promise<{ items: BillingDocumentListItem[]; total: number }> {
  const prisma = getPrismaClient();
  const perPage = Math.min(options.perPage ?? 20, 50);
  const page = Math.max(options.page ?? 1, 1);

  // Mirror buildSalesWhere logic: "paid" → paymentStatus, "pending" → not-canceled + paymentStatus, "canceled" → status
  async function buildWhere(): Promise<Prisma.LightweightSaleWhereInput> {
    const s = options.status;
    const search = options.search?.trim();
    const sequentialCandidate = search?.split("-").at(-1)?.replace(/^0+/, "");
    const sequentialNumber = sequentialCandidate && /^\d{1,9}$/.test(sequentialCandidate) ? Number(sequentialCandidate) : undefined;
    const sriFilter = options.type;
    const sriStatuses = sriFilter === "authorized" ? ["AUTHORIZED"] : sriFilter === "rejected" ? ["REJECTED"] : sriFilter === "pending" ? ["DRAFT", "READY_FOR_TESTING", "SIGNED", "SENT"] : undefined;
    const needsSriLookup = Boolean(search || sriFilter === "receipt" || sriFilter === "sri" || sriStatuses);
    const matchingSri = needsSriLookup ? await prisma.sriDocument.findMany({
      where: {
        tenantId,
        sourceType: "BASIC_SALE",
        ...(sriStatuses ? { status: { in: sriStatuses as never[] } } : {}),
        ...(search ? { OR: [
          { customerName: { contains: search, mode: "insensitive" } },
          { customerIdentification: { contains: search, mode: "insensitive" } },
          { accessKey: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
          ...(sequentialNumber !== undefined ? [{ sequentialNumber }] : []),
          { submissionJobs: { some: { sriAuthorizationNumber: { contains: search, mode: "insensitive" } } } },
        ] } : {}),
      },
      select: { sourceId: true },
    }) : [];
    const sriSaleIds = matchingSri.flatMap((document) => document.sourceId ? [document.sourceId] : []);
    const base: Prisma.LightweightSaleWhereInput = {
      tenantId,
      ...(options.from || options.to ? { createdAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } } : {}),
      ...(search ? { OR: [
        { id: { contains: search, mode: "insensitive" } },
        { customer: { is: { OR: [
          { name: { contains: search, mode: "insensitive" } },
          { identification: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ] } } },
        ...(sriSaleIds.length ? [{ id: { in: sriSaleIds } }] : []),
      ] } : {}),
      ...(sriFilter === "receipt" ? { id: { notIn: sriSaleIds } } : {}),
      ...(sriFilter === "sri" || (sriStatuses && sriFilter !== "pending") ? { id: { in: sriSaleIds } } : {}),
      ...(sriFilter === "pending" ? { AND: [{ OR: [
        { id: { in: sriSaleIds } },
        { status: { not: "canceled" as LightweightSaleStatus }, paymentStatus: { in: ["pending", "partial"] as LightweightPaymentStatus[] } },
      ] }] } : {}),
      ...(sriFilter === "canceled" ? { status: "canceled" as LightweightSaleStatus } : {}),
    };
    if (s === "paid") return { ...base, paymentStatus: "paid" as LightweightPaymentStatus };
    if (s === "pending") return {
      ...base,
      status: { not: "canceled" as LightweightSaleStatus },
      paymentStatus: { in: ["pending", "partial"] as LightweightPaymentStatus[] },
    };
    if (s === "canceled") return { ...base, status: "canceled" as LightweightSaleStatus };
    return base;
  }

  const where = await buildWhere();

  const [sales, total] = await Promise.all([
    prisma.lightweightSale.findMany({
      where,
      include: {
        customer: { select: { name: true, identification: true } },
        items: { include: { product: { select: { name: true } } }, take: 4 },
      },
      orderBy: options.sort === "total" ? { total: "desc" } : { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.lightweightSale.count({ where }),
  ]);

  if (sales.length === 0) return { items: [], total: 0 };

  const saleIds = sales.map((s) => s.id);
  const sriDocs = await prisma.sriDocument.findMany({
    where: { tenantId, sourceType: "BASIC_SALE", sourceId: { in: saleIds } },
    select: {
      id: true,
      sourceId: true,
      status: true,
      environment: true,
      accessKey: true,
      customerIdentification: true,
      establishment: { select: { code: true } },
      issuePoint: { select: { code: true } },
      sequentialNumber: true,
      submissionJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          sriAuthorizationNumber: true,
          authorizedAt: true,
          errorMessage: true,
          sriReceiptStatus: true,
          sriAuthorizationStatus: true,
        },
      },
    },
  });

  const sriBySourceId = Object.fromEntries(
    sriDocs.filter((d) => d.sourceId).map((d) => [d.sourceId!, d])
  );

  return {
    items: sales.map((sale) => {
      const sri = sriBySourceId[sale.id] ?? null;
      const job = sri?.submissionJobs[0] ?? null;
      const rejectionMessage =
        sri?.status === "REJECTED"
          ? job?.errorMessage ??
            job?.sriAuthorizationStatus ??
            job?.sriReceiptStatus ??
            null
          : null;

      const displayNumber = sri
        ? formatDisplayNumber(
            sri.establishment?.code ?? "???",
            sri.issuePoint?.code ?? "???",
            sri.sequentialNumber
          )
        : null;

      return {
        id: sale.id,
        type: "BASIC_SALE" as const,
        displayNumber,
        customerName: sale.customer?.name ?? null,
        customerIdentification: sri?.customerIdentification ?? sale.customer?.identification ?? null,
        total: sale.total.toString(),
        issuedAt: sale.createdAt.toISOString(),
        source: "CORE" as const,
        sourceLabel: "Venta básica",
        internalStatus: sale.status === "canceled" ? "canceled" : sale.paymentStatus,
        internalStatusLabel: INTERNAL_STATUS_LABELS[sale.status === "canceled" ? "canceled" : sale.paymentStatus] ?? sale.paymentStatus,
        sriStatus: sri?.status ?? null,
        sriStatusLabel: sri ? sriLabel(sri.status) : null,
        sriDocumentId: sri?.id ?? null,
        accessKey: sri?.accessKey ?? null,
        authorizationNumber: job?.sriAuthorizationNumber ?? null,
        authorizationDate: job?.authorizedAt ? job.authorizedAt.toISOString() : null,
        environment: sri?.environment ?? null,
        rejectionMessage,
        saleDetailHref: `/basic/sales/${sale.id}`,
        sriDetailHref: sri ? `/sri/documents/${sri.id}` : null,
        itemsSummary:
          sale.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ") ||
          null,
      };
    }),
    total,
  };
}

export async function loadErpDocuments(
  tenantId: string,
  options: {
    status?: string;
    page?: number;
    perPage?: number;
    includeBasicHistory?: boolean;
  } = {}
): Promise<{ items: BillingDocumentListItem[]; total: number; basicHistoryCount: number }> {
  const prisma = getPrismaClient();
  const perPage = Math.min(options.perPage ?? 20, 50);
  const page = Math.max(options.page ?? 1, 1);

  const statusValue =
    options.status && (VALID_SRI_STATUSES as readonly string[]).includes(options.status)
      ? options.status
      : undefined;

  const where = { tenantId, ...(statusValue ? { status: statusValue as never } : {}) };

  const [docs, total, basicHistory] = await Promise.all([
    prisma.sriDocument.findMany({
      where,
      include: {
        establishment: { select: { code: true } },
        issuePoint: { select: { code: true } },
        submissionJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            sriAuthorizationNumber: true,
            authorizedAt: true,
            errorMessage: true,
            sriReceiptStatus: true,
            sriAuthorizationStatus: true,
          },
        },
        signingJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.sriDocument.count({ where }),
    options.includeBasicHistory
      ? loadBasicHistoryItems(tenantId, 20).catch((error) => {
          console.warn("[billing-documents] Basic history could not be loaded; continuing", {
            tenantId,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return [];
        })
      : Promise.resolve([]),
  ]);

  const sriItems: BillingDocumentListItem[] = docs.map((doc) => {
    const job = doc.submissionJobs[0] ?? null;
    const rejectionMessage =
      doc.status === "REJECTED"
        ? job?.errorMessage ?? job?.sriAuthorizationStatus ?? job?.sriReceiptStatus ?? null
        : null;

    return {
      id: doc.id,
      type: "SRI_DOCUMENT" as const,
      displayNumber: formatDisplayNumber(
        doc.establishment?.code ?? "???",
        doc.issuePoint?.code ?? "???",
        doc.sequentialNumber
      ),
      customerName: doc.customerName ?? null,
      customerIdentification: doc.customerIdentification ?? null,
      total: doc.grandTotal.toString(),
      issuedAt: doc.createdAt.toISOString(),
      source: "SRI" as const,
      sourceLabel: "Documento SRI",
      internalStatus: doc.status,
      internalStatusLabel: sriLabel(doc.status),
      sriStatus: doc.status,
      sriStatusLabel: sriLabel(doc.status),
      sriDocumentId: doc.id,
      accessKey: doc.accessKey ?? null,
      authorizationNumber: job?.sriAuthorizationNumber ?? null,
      authorizationDate: job?.authorizedAt ? job.authorizedAt.toISOString() : null,
      environment: doc.environment,
      rejectionMessage,
      saleDetailHref: null,
      sriDetailHref: `/sri/documents/${doc.id}`,
      itemsSummary: null,
      itemsUnavailable: false,
    };
  });

  // Merge SRI docs + basic history, sorted by date desc
  const merged = [...sriItems, ...basicHistory].sort((a, b) => {
    const dateA = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
    const dateB = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
    return dateB - dateA;
  });

  return {
    items: merged,
    total,
    basicHistoryCount: basicHistory.length,
  };
}
