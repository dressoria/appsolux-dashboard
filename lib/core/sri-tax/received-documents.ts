import "@/lib/security/server-only";
import { Prisma, PurchaseDocumentType } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { TaxInputError } from "./tax-period";
import { money, sum } from "./money";

export function parseReceivedFilters(params: URLSearchParams) {
  const integer = (key: string, fallback: number, max: number) => {
    const raw = params.get(key) ?? String(fallback);
    if (!/^\d{1,5}$/.test(raw) || Number(raw) < 1 || Number(raw) > max)
      throw new TaxInputError(`Filtro inválido: ${key}.`);
    return Number(raw);
  };
  const date = (key: string, end = false) => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== raw ||
      raw < "2000-01-01" ||
      raw > "2100-12-31"
    )
      throw new TaxInputError("Fecha inválida.");
    return new Date(`${raw}T${end ? "23:59:59.999" : "00:00:00"}-05:00`);
  };
  const from = date("from"),
    to = date("to", true);
  if (from && to && from > to)
    throw new TaxInputError("Desde debe ser anterior a Hasta.");
  const status = params.get("status") ?? "";
  if (!["", "PENDING", "REGISTERED", "IGNORED", "PROBLEM"].includes(status))
    throw new TaxInputError("Estado inválido.");
  const type = params.get("type") ?? "";
  if (
    type &&
    ![...Object.values(PurchaseDocumentType), "WITHHOLDING"].includes(
      type as PurchaseDocumentType,
    )
  )
    throw new TaxInputError("Tipo no soportado.");
  const text = (key: string) => {
    const value = params.get(key)?.trim() ?? "";
    if (value.length > 150)
      throw new TaxInputError("Búsqueda demasiado larga.");
    return value;
  };
  return {
    page: integer("page", 1, 1000),
    pageSize: integer("pageSize", 25, 100),
    from,
    to,
    status,
    type,
    q: text("q"),
    ruc: text("ruc"),
    accessKey: text("accessKey"),
  };
}

export async function listReceivedDocuments(
  tenantId: string,
  filters: ReturnType<typeof parseReceivedFilters>,
) {
  const db = getPrismaClient();
  const period = {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
  const inboxWhere: Prisma.PurchaseInboxItemWhereInput = {
    tenantId,
    purchaseDocumentId: null,
  };
  const purchaseWhere: Prisma.PurchaseDocumentWhereInput = { tenantId };
  if (filters.from || filters.to) {
    inboxWhere.issueDate = period;
    purchaseWhere.issueDate = period;
  }
  if (filters.type) {
    inboxWhere.documentType = filters.type;
    purchaseWhere.documentType =
      filters.type === "WITHHOLDING"
        ? { in: [] }
        : (filters.type as PurchaseDocumentType);
  }
  if (filters.q) {
    inboxWhere.OR = [
      { supplierName: { contains: filters.q, mode: "insensitive" } },
      { documentNumber: { contains: filters.q } },
    ];
    purchaseWhere.OR = [
      { supplierName: { contains: filters.q, mode: "insensitive" } },
      { supplierDocumentNumber: { contains: filters.q } },
    ];
  }
  if (filters.ruc) {
    inboxWhere.supplierRuc = { contains: filters.ruc };
    purchaseWhere.supplierIdentification = { contains: filters.ruc };
  }
  if (filters.accessKey) {
    inboxWhere.accessKey = { contains: filters.accessKey };
    purchaseWhere.accessKey = { contains: filters.accessKey };
  }
  if (filters.status === "REGISTERED") {
    inboxWhere.status = { in: [] };
    purchaseWhere.status = { in: ["AUTHORIZED", "REGISTERED"] };
  }
  if (filters.status === "PENDING") {
    inboxWhere.status = { in: ["NEW", "CLASSIFIED"] };
    purchaseWhere.status = "DRAFT";
  }
  if (filters.status === "IGNORED") {
    inboxWhere.status = "IGNORED";
    purchaseWhere.status = "CANCELLED";
  }
  if (filters.status === "PROBLEM") {
    inboxWhere.status = "NEEDS_REVIEW";
    purchaseWhere.status = { in: ["NEEDS_REVIEW", "REJECTED"] };
  }
  const take = filters.page * filters.pageSize;
  const [
    inbox,
    purchases,
    inboxCount,
    purchaseCount,
    inboxTypes,
    purchaseTypes,
  ] = await Promise.all([
    db.purchaseInboxItem.findMany({
      where: inboxWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    }),
    db.purchaseDocument.findMany({
      where: purchaseWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      include: {
        supplier: {
          select: { tenantId: true, name: true, identification: true },
        },
        inboxItem: { select: { tenantId: true, subtotal: true } },
      },
    }),
    db.purchaseInboxItem.count({ where: inboxWhere }),
    db.purchaseDocument.count({ where: purchaseWhere }),
    db.purchaseInboxItem.findMany({
      where: { tenantId, purchaseDocumentId: null },
      distinct: ["documentType"],
      select: { documentType: true },
    }),
    db.purchaseDocument.findMany({
      where: { tenantId },
      distinct: ["documentType"],
      select: { documentType: true },
    }),
  ]);
  const items = [
    ...inbox.map((d) => ({
      id: d.id,
      source: "INBOX" as const,
      number: d.documentNumber,
      type: d.documentType,
      name: d.supplierName,
      ruc: d.supplierRuc,
      date: d.issueDate?.toISOString() ?? null,
      base: money(d.subtotal),
      iva: money(d.ivaTotal),
      total: money(d.total),
      status: d.status,
      origin: d.origin,
      purchaseId: null as string | null,
      createdAt: d.createdAt.toISOString(),
      accessKey: d.accessKey,
      canRegister:
        ["NEW", "CLASSIFIED", "NEEDS_REVIEW"].includes(d.status) &&
        Object.values(PurchaseDocumentType).includes(
          d.documentType as PurchaseDocumentType,
        ),
      canIgnore: ["NEW", "CLASSIFIED", "NEEDS_REVIEW"].includes(d.status),
    })),
    ...purchases.map((d) => ({
      id: d.id,
      source: "PURCHASE" as const,
      number: d.supplierDocumentNumber,
      type: d.documentType,
      name:
        d.supplierName ??
        (d.supplier?.tenantId === tenantId ? d.supplier.name : null),
      ruc:
        d.supplierIdentification ??
        (d.supplier?.tenantId === tenantId ? d.supplier.identification : null),
      date: d.issueDate?.toISOString() ?? null,
      base:
        d.status === "NEEDS_REVIEW" && d.inboxItem?.tenantId === tenantId
          ? money(d.inboxItem.subtotal)
          : money(
              sum([
                d.subtotal0,
                d.subtotal15,
                d.subtotalNoTax,
                d.subtotalExempt,
              ]),
            ),
      iva: money(d.ivaTotal),
      total: money(d.total),
      status: d.status,
      origin: d.origin,
      purchaseId: d.id,
      createdAt: d.createdAt.toISOString(),
      accessKey: d.accessKey,
      canRegister: false,
      canIgnore: false,
    })),
  ].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id) ||
      b.source.localeCompare(a.source),
  );
  const total = inboxCount + purchaseCount;
  return {
    items: items.slice(
      (filters.page - 1) * filters.pageSize,
      filters.page * filters.pageSize,
    ),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
    supportedTypes: [
      ...new Set(
        [...inboxTypes, ...purchaseTypes]
          .map((d) => d.documentType)
          .filter((d): d is string => !!d),
      ),
    ],
    xmlNotice:
      "Los importadores actuales no conservan el XML recibido en almacenamiento accesible. Consulte el XML original; no se reconstruye a partir de totales.",
  };
}

export async function receivedAction(
  tenantId: string,
  userId: string,
  id: string,
  action: string,
  classification?: { source: "INBOX" | "PURCHASE"; categoryId: string },
) {
  const db = getPrismaClient();
  if (action === "classify") {
    if (!classification) throw new TaxInputError("Clasificación requerida.");
    return db.$transaction(async (tx) => {
      const category = await tx.purchaseAccountingCategory.findFirst({
        where: { id: classification.categoryId, tenantId, isActive: true },
        select: { id: true, name: true },
      });
      if (!category)
        throw new TaxInputError("Categoría no disponible en esta empresa.");
      const result =
        classification.source === "PURCHASE"
          ? await tx.purchaseDocument.updateMany({
              where: {
                id,
                tenantId,
                status: { notIn: ["CANCELLED", "REJECTED"] },
              },
              data: { accountingCategoryId: category.id },
            })
          : await tx.purchaseInboxItem.updateMany({
              where: {
                id,
                tenantId,
                purchaseDocumentId: null,
                status: { in: ["NEW", "CLASSIFIED", "NEEDS_REVIEW"] },
              },
              data: { suggestedCategory: category.name, status: "CLASSIFIED" },
            });
      if (!result.count)
        throw new TaxInputError("Comprobante no disponible para clasificar.");
      return { ok: true };
    });
  }
  if (action === "ignore") {
    const result = await db.purchaseInboxItem.updateMany({
      where: {
        id,
        tenantId,
        purchaseDocumentId: null,
        status: { in: ["NEW", "CLASSIFIED", "NEEDS_REVIEW"] },
      },
      data: { status: "IGNORED" },
    });
    if (!result.count)
      throw new TaxInputError("Documento no disponible para ignorar.");
    return { ok: true };
  }
  if (action !== "register") throw new TaxInputError("Acción no soportada.");
  return db.$transaction(
    async (tx) => {
      const item = await tx.purchaseInboxItem.findFirst({
        where: {
          id,
          tenantId,
          purchaseDocumentId: null,
          status: { in: ["NEW", "CLASSIFIED", "NEEDS_REVIEW"] },
        },
      });
      if (
        !item ||
        !Object.values(PurchaseDocumentType).includes(
          item.documentType as PurchaseDocumentType,
        )
      )
        throw new TaxInputError("Documento no disponible para registrar.");
      if (
        !item.supplierRuc ||
        !item.supplierName ||
        !item.issueDate ||
        !item.documentNumber
      )
        throw new TaxInputError(
          "Complete emisor, identificación, fecha y número antes de registrar.",
        );
      // Inbox does not store the split of bases by rate. Do not invent it.
      // Preserve the known aggregate and keep the purchase under review.
      const purchase = await tx.purchaseDocument.create({
        data: {
          tenantId,
          createdByUserId: userId,
          documentType: item.documentType as PurchaseDocumentType,
          supplierName: item.supplierName,
          supplierIdentification: item.supplierRuc,
          supplierDocumentNumber: item.documentNumber,
          accessKey: item.accessKey,
          issueDate: item.issueDate,
          ivaTotal: item.ivaTotal,
          total: item.total,
          origin: item.origin,
          status: "NEEDS_REVIEW",
          notes: `Registrado desde comprobantes recibidos. Base agregada original: ${money(item.subtotal)}. Desglose por tarifa y autorización por completar; excluido de reportes definitivos.`,
        },
      });
      const linked = await tx.purchaseInboxItem.updateMany({
        where: { id, tenantId, purchaseDocumentId: null, status: item.status },
        data: {
          purchaseDocumentId: purchase.id,
          status: "REGISTERED",
          processedAt: new Date(),
        },
      });
      if (!linked.count)
        throw new TaxInputError(
          "El comprobante cambió durante el registro. Actualice la bandeja.",
        );
      return { ok: true, purchaseId: purchase.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function getReceivedSyncState(tenantId: string) {
  try {
    const { getSyncStatus } = await import("../purchase-sync-jobs");
    return { available: true, ...(await getSyncStatus(tenantId)) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2021", "P2022"].includes(error.code)
    )
      return {
        available: false,
        syncStatus: "PENDING_SETUP",
        credentialStatus: null,
        lastSyncAt: null,
        nextSyncAt: null,
        activeJob: null,
      };
    throw error;
  }
}
