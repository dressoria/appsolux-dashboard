import "@/lib/security/server-only";
import { Prisma, LightweightPaymentMethod } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import type { ApiActor } from "./auth";
import { requireScopes } from "./auth";
import { ApiError, required, string, number, date, rows, pagination } from "./errors";
import { validateReferences } from "./references";
import type { ApiResult } from "./persistence";

export type Invocation = { actor: ApiActor; params: Record<string, string>; query: URLSearchParams; body: Record<string, unknown> };
export type Operation = (input: Invocation) => Promise<ApiResult | Response>;
export function pick(body: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
}
export const data = (value: unknown, status = 200): ApiResult => ({ data: value, status });
function pageResult(value: unknown, query: URLSearchParams): ApiResult {
  const p = pagination(query);
  return { data: value, meta: { page: p.page, pageSize: p.pageSize } };
}
export const me: Operation = async ({ actor }) => data({ user: { id: actor.user.id, name: actor.user.name, role: actor.user.role }, tenant: actor.tenant, key: { id: actor.key.id, name: actor.key.name, keyPrefix: actor.key.keyPrefix, fullAccess: actor.key.fullAccess, catalogVersion: actor.key.catalogVersion }, scopes: actor.scopes });

export const productsList: Operation = async ({ actor, query }) => {
  const { getProducts } = await import("@/lib/core/inventory-products");
  return pageResult(await getProducts(actor.tenant.id, { q: query.get("q") ?? undefined, type: query.get("type") ?? undefined, categoryId: query.get("categoryId") ?? undefined, brandId: query.get("brandId") ?? undefined, isActive: query.has("isActive") ? query.get("isActive") === "true" : undefined, ...pagination(query) }), query);
};
export const productsDetail: Operation = async ({ actor, params }) => data(required(await (await import("@/lib/core/inventory-products")).getProductById(actor.tenant.id, params.id)));
export const productsSave = (update = false): Operation => async ({ actor, params, body }) => {
  const service = await import("@/lib/core/inventory-products");
  if (Object.keys(body).some(k => ["stock", "stockBalances", "comboItems"].includes(k))) throw new ApiError(400, "STOCK_FLOW_REQUIRED", "Usa ajustes para modificar stock; la composición de combos requiere el editor web.");
  if (update && body.isActive === false) requireScopes(actor, ["products:deactivate"]);
  if (update && ["price", "price2", "price3", "price4"].some(k => body[k] !== undefined)) requireScopes(actor, ["prices:manage"]);
  if (!update) {
    const { getLimit } = await import("@/lib/core/plans");
    const limit = await getLimit(actor.tenant.id, "products");
    if (await getPrismaClient().lightweightProduct.count({ where: { tenantId: actor.tenant.id } }) >= limit) throw new ApiError(403, "PLAN_LIMIT", "Alcanzaste el límite de productos del plan.");
  }
  return data(update ? await service.updateProduct(actor.tenant.id, params.id, body) : await service.createProduct(actor.tenant.id, body), update ? 200 : 201);
};
export const productsDeactivate: Operation = async ({ actor, params }) => data(await getPrismaClient().lightweightProduct.update({ where: { id: params.id, tenantId: actor.tenant.id }, data: { isActive: false } }));

const customerFields = ["name", "tradeName", "phone", "phoneNumbers", "email", "additionalEmails", "address", "country", "province", "city", "parish", "sector", "zone", "customerType", "customerOrigin", "groupName", "assignedSellerId", "isRelated", "isForeign", "invoiceThirdParty", "identificationType", "identification", "notes", "gender", "relatedCustomerId", "invoiceThirdPartyCustomerId"];
export const customersSave = (update = false): Operation => async ({ actor, params, body }) => {
  const { createCustomer, updateCustomer } = await import("@/lib/core/lightweight-pos");
  const payload = { ...pick(body, customerFields), tenantId: actor.tenant.id, name: update && body.name === undefined ? undefined : string(body.name, "Nombre") } as Parameters<typeof createCustomer>[0];
  return data(update ? await updateCustomer({ ...payload, customerId: params.id }) : await createCustomer(payload), update ? 200 : 201);
};
export const customersList: Operation = async ({ actor, query }) => {
  const db = getPrismaClient(), p = pagination(query), q = query.get("q");
  const where: Prisma.LightweightCustomerWhereInput = { tenantId: actor.tenant.id, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { identification: { contains: q } }] } : {}) };
  const [items, total] = await Promise.all([db.lightweightCustomer.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: p.skip, take: p.take }), db.lightweightCustomer.count({ where })]);
  return pageResult({ items, total }, query);
};
export const customersDetail: Operation = async ({ actor, params }) => data(required(await (await import("@/lib/core/lightweight-pos")).getCustomerDetail(actor.tenant.id, params.id)));
export const customersDeactivate: Operation = async ({ actor, params }) => data(await (await import("@/lib/core/lightweight-pos")).updateCustomer({ tenantId: actor.tenant.id, customerId: params.id, isActive: false }));

export const suppliersList: Operation = async ({ actor, query }) => {
  const db = getPrismaClient(), p = pagination(query), q = query.get("q");
  const where: Prisma.LightweightSupplierWhereInput = { tenantId: actor.tenant.id, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { identification: { contains: q } }] } : {}) };
  const [items, total] = await Promise.all([db.lightweightSupplier.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: p.skip, take: p.take }), db.lightweightSupplier.count({ where })]);
  return pageResult({ items, total }, query);
};
export const suppliersSave = (update = false): Operation => async ({ actor, body, params }) => {
  const { createSupplier, updateSupplier } = await import("@/lib/core/lightweight-suppliers");
  const payload = { ...pick(body, [...customerFields.filter(k => !["assignedSellerId", "relatedCustomerId", "invoiceThirdPartyCustomerId", "customerType", "customerOrigin", "invoiceThirdParty"].includes(k)), "supplierType", "supplierOrigin", "assignedBuyerId", "relatedSupplierId"]), tenantId: actor.tenant.id, name: update && body.name === undefined ? undefined : string(body.name, "Nombre") } as Parameters<typeof createSupplier>[0];
  return data(update ? await updateSupplier({ ...payload, supplierId: params.id }) : await createSupplier(payload), update ? 200 : 201);
};
export const suppliersDeactivate: Operation = async ({ actor, params }) => data(await (await import("@/lib/core/lightweight-suppliers")).updateSupplier({ tenantId: actor.tenant.id, supplierId: params.id, isActive: false }));

export const proformasList: Operation = async ({ actor, query }) => {
  const db = getPrismaClient(), p = pagination(query), q = query.get("q");
  const where: Prisma.LightweightProformaWhereInput = { tenantId: actor.tenant.id, ...(q ? { number: { contains: q, mode: "insensitive" } } : {}), ...(query.has("from") || query.has("to") ? { issueDate: { gte: query.has("from") ? date(query.get("from")) : undefined, lte: query.has("to") ? date(query.get("to")) : undefined } } : {}) };
  const [items, total] = await Promise.all([db.lightweightProforma.findMany({ where, include: { items: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: p.skip, take: p.take }), db.lightweightProforma.count({ where })]);
  return pageResult({ items, total }, query);
};
export const proformasDetail: Operation = async ({ actor, params }) => data(required(await (await import("@/lib/core/lightweight-proformas")).getProforma(actor.tenant.id, params.id)));
export const proformasSave = (update = false): Operation => async ({ actor, body, params }) => {
  const lines = rows(body.items), db = getPrismaClient();
  const products = await db.lightweightProduct.findMany({ where: { tenantId: actor.tenant.id, isActive: true, id: { in: lines.map(i => string(i.productId, "Producto")) } } });
  const items = lines.map(line => {
    const product = required(products.find(p => p.id === line.productId));
    return { productId: product.id, quantity: number(line.quantity, "Cantidad", 0.000001), unitPrice: line.unitPrice == null ? Number(product.price) : number(line.unitPrice, "Precio"), taxRate: Number(product.taxRate), discount: number(line.discount ?? 0, "Descuento"), observation: string(line.observation, "Observación", true) || undefined };
  });
  const input = { tenantId: actor.tenant.id, userId: actor.user.id, userName: actor.user.name, customerId: string(body.customerId, "Cliente", true) || undefined, establishmentId: string(body.establishmentId, "Establecimiento", true) || undefined, issueDate: date(body.issueDate, new Date()), validUntil: body.validUntil ? date(body.validUntil) : undefined, observation: string(body.observation, "Observación", true) || undefined, items };
  const service = await import("@/lib/core/lightweight-proformas");
  if (update) {
    const current = required(await service.getProforma(actor.tenant.id, params.id));
    if (current.status !== "ACTIVE") throw new ApiError(409, "INVALID_STATE", "Solo se pueden editar proformas activas.");
  }
  return data(update ? await service.updateProforma(params.id, input) : await service.createProforma(input), update ? 200 : 201);
};

function paymentMethod(value: unknown) {
  const method = string(value, "Método de pago");
  if (!Object.values(LightweightPaymentMethod).includes(method as LightweightPaymentMethod)) throw new ApiError(400, "INVALID_PAYMENT_METHOD", "Método de pago inválido.");
  return method as LightweightPaymentMethod;
}
export const salesList: Operation = async ({ actor, query }) => {
  const p = pagination(query), db = getPrismaClient();
  const status = query.get("status");
  if (status && !["open", "paid", "canceled"].includes(status)) throw new ApiError(400, "INVALID_STATUS", "Estado de venta inválido.");
  const where: Prisma.LightweightSaleWhereInput = { tenantId: actor.tenant.id, ...(status ? { status: status as "open" | "paid" | "canceled" } : {}) };
  const [items, total] = await Promise.all([db.lightweightSale.findMany({ where, include: { customer: true, payments: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: p.skip, take: p.take }), db.lightweightSale.count({ where })]);
  return pageResult({ items, total }, query);
};
export const salesDetail: Operation = async ({ actor, params }) => data(required(await (await import("@/lib/core/lightweight-pos")).getSaleById(actor.tenant.id, params.id)));
export const salesCreate: Operation = async ({ actor, body }) => {
  const service = await import("@/lib/core/lightweight-pos");
  if (body.outputMode && body.outputMode !== "internal_receipt") throw new ApiError(400, "USE_INVOICES_ENDPOINT", "Para facturar usa POST /api/v1/invoices con saleId.");
  const items = rows(body.items).map(i => ({ productId: string(i.productId, "Producto"), quantity: number(i.quantity, "Cantidad", 0.000001), discountAmount: number(i.discountAmount ?? 0, "Descuento"), unitPrice: i.unitPrice === undefined ? undefined : number(i.unitPrice, "Precio"), description: string(i.description, "Descripción", true) || undefined }));
  const payload = { ...pick(body, ["customerId", "warehouseId", "treasuryAccountId", "invoiceKind", "dueDate", "shipmentGuideId", "exportData", "reimbursementData", "establishmentId", "issuePointId", "sriPaymentCode", "notes"]), tenantId: actor.tenant.id, createdByUserId: actor.user.id, paymentMethod: paymentMethod(body.paymentMethod), paidAmount: number(body.paidAmount ?? 0, "Monto pagado"), items } as Parameters<typeof service.createSale>[0];
  if (body.payments !== undefined) payload.payments = rows(body.payments).map(p => ({ ...pick(p, ["treasuryAccountId", "referenceNumber", "batchNumber", "voucherNumber", "dueDate"]), method: paymentMethod(p.method), amount: number(p.amount, "Monto", 0.01) }));
  return data(await service.createSale(payload), 201);
};
export const salesCancel: Operation = async ({ actor, params }) => {
  const document = await getPrismaClient().sriDocument.findFirst({ where: { tenantId: actor.tenant.id, sourceType: "BASIC_SALE", sourceId: params.id, status: { not: "CANCELLED" } }, select: { id: true } });
  if (document) throw new ApiError(422, "SRI_CANCELLATION_REQUIRED", "La venta tiene un comprobante SRI. Usa el flujo autorizado de anulación del comprobante.");
  return data(await (await import("@/lib/core/lightweight-pos")).cancelSale(actor.tenant.id, params.id, actor.user.id));
};
export const salesPayment: Operation = async ({ actor, params, body }) => data(await (await import("@/lib/core/lightweight-pos")).addSalePayment({ tenantId: actor.tenant.id, createdByUserId: actor.user.id, saleId: params.id, method: paymentMethod(body.method), amount: number(body.amount, "Monto", 0.01), treasuryAccountId: string(body.treasuryAccountId, "Cuenta", true) || undefined }), 201);
export const invoicesCreate: Operation = async ({ actor, body }) => data(await (await import("@/lib/core/basic-sales-sri")).startSriFlowFromBasicSale({ tenantId: actor.tenant.id, saleId: string(body.saleId, "Venta"), requestedByUserId: actor.user.id, establishmentId: string(body.establishmentId, "Establecimiento", true) || undefined, issuePointId: string(body.issuePointId, "Punto de emisión", true) || undefined }), 201);

export const stockList: Operation = async ({ actor, query }) => {
  const db = getPrismaClient(), p = pagination(query);
  const where: Prisma.InventoryStockBalanceWhereInput = { tenantId: actor.tenant.id, ...(query.has("warehouseId") ? { warehouseId: query.get("warehouseId")! } : {}), ...(query.has("productId") ? { productId: query.get("productId")! } : {}) };
  const [items, total] = await Promise.all([db.inventoryStockBalance.findMany({ where, include: { product: { select: { id: true, name: true, primaryCode: true } }, warehouse: { select: { id: true, name: true } } }, orderBy: { id: "asc" }, skip: p.skip, take: p.take }), db.inventoryStockBalance.count({ where })]);
  return pageResult({ items, total }, query);
};
export const warehousesList: Operation = async ({ actor, query }) => {
  const p = pagination(query);
  return pageResult(await getPrismaClient().inventoryWarehouse.findMany({ where: { tenantId: actor.tenant.id }, orderBy: { id: "asc" }, skip: p.skip, take: p.take }), query);
};
export const warehousesSave = (update = false): Operation => async ({ actor, body, params }) => {
  const service = await import("@/lib/core/inventory-warehouses");
  if (!update) {
    const { getLimit } = await import("@/lib/core/plans");
    const limit = await getLimit(actor.tenant.id, "warehouses");
    if (await getPrismaClient().inventoryWarehouse.count({ where: { tenantId: actor.tenant.id } }) >= limit) throw new ApiError(403, "PLAN_LIMIT", "Alcanzaste el límite de bodegas del plan.");
  }
  const payload = pick(body, ["name", "address", "city", "phone", "isDefault", ...(update ? ["active"] : ["code"])]);
  return data(update ? await service.updateWarehouse(actor.tenant.id, params.id, payload) : await service.createWarehouse(actor.tenant.id, { ...payload, code: string(body.code, "Código"), name: string(body.name, "Nombre") }), update ? 200 : 201);
};
export const movementsList: Operation = async ({ actor, query }) => data(await (await import("@/lib/core/inventory-movements")).getMovements(actor.tenant.id, { ...pagination(query), productId: query.get("productId") ?? undefined, warehouseId: query.get("warehouseId") ?? undefined, dateFrom: query.has("from") ? date(query.get("from")) : undefined, dateTo: query.has("to") ? date(query.get("to")) : undefined }));
export const adjustmentCreate: Operation = async ({ actor, body }) => {
  if (body.type !== "ADJUSTMENT_IN" && body.type !== "ADJUSTMENT_OUT") throw new ApiError(400, "INVALID_TYPE", "Usa ADJUSTMENT_IN o ADJUSTMENT_OUT.");
  const allowNegative = await (await import("@/lib/core/inventory-settings")).getAllowNegativeStock(actor.tenant.id);
  return data(await (await import("@/lib/core/inventory-movements")).createAdjustment(actor.tenant.id, { productId: string(body.productId, "Producto"), warehouseId: string(body.warehouseId, "Bodega"), quantity: new Prisma.Decimal(number(body.quantity, "Cantidad", 0.000001)), type: body.type, reason: string(body.reason, "Motivo", true) || undefined, reference: string(body.reference, "Referencia", true) || undefined, userId: actor.user.id }, allowNegative), 201);
};
export const transfersList: Operation = async ({ actor, query }) => pageResult(await (await import("@/lib/core/inventory-transfers")).getTransfers(actor.tenant.id, { ...pagination(query), status: query.get("status") ?? undefined }), query);
export const transfersCreate: Operation = async ({ actor, body }) => data(await (await import("@/lib/core/inventory-transfers")).createTransfer(actor.tenant.id, { sourceWarehouseId: string(body.sourceWarehouseId, "Bodega origen"), destinationWarehouseId: string(body.destinationWarehouseId, "Bodega destino"), items: rows(body.items).map(i => ({ productId: string(i.productId, "Producto"), quantity: number(i.quantity, "Cantidad", 0.000001) })), userId: actor.user.id, notes: string(body.notes, "Notas", true) || undefined }), 201);
export const transfersComplete: Operation = async ({ actor, params }) => {
  const svc = await import("@/lib/core/inventory-transfers"), existing = required(await svc.getTransferById(actor.tenant.id, params.id));
  await validateReferences(actor.tenant.id, existing);
  return data(await svc.completeTransfer(actor.tenant.id, params.id, actor.user.id, await (await import("@/lib/core/inventory-settings")).getAllowNegativeStock(actor.tenant.id)));
};
export const countsList: Operation = async ({ actor, query }) => pageResult(await (await import("@/lib/core/inventory-physical-counts")).getPhysicalCounts(actor.tenant.id, { ...pagination(query), warehouseId: query.get("warehouseId") ?? undefined }), query);
export const countsCreate: Operation = async ({ actor, body }) => data(await (await import("@/lib/core/inventory-physical-counts")).createPhysicalCount(actor.tenant.id, string(body.warehouseId, "Bodega"), actor.user.id, string(body.notes, "Notas", true) || undefined), 201);
export const countsDetail: Operation = async ({ actor, params }) => data(required(await (await import("@/lib/core/inventory-physical-counts")).getPhysicalCountById(actor.tenant.id, params.id)));
export const countsUpdate: Operation = async ({ actor, body, params }) => data(await (await import("@/lib/core/inventory-physical-counts")).updateCountItem(actor.tenant.id, params.id, string(body.productId, "Producto"), number(body.countedQuantity, "Cantidad contada")));
export const countsComplete: Operation = async ({ actor, params }) => {
  const svc = await import("@/lib/core/inventory-physical-counts");
  await validateReferences(actor.tenant.id, required(await svc.getPhysicalCountById(actor.tenant.id, params.id)));
  return data(await svc.completePhysicalCount(actor.tenant.id, params.id, actor.user.id, await (await import("@/lib/core/inventory-settings")).getAllowNegativeStock(actor.tenant.id)));
};
export const kardexRead: Operation = async ({ actor, query }) => {
  const result = await (await import("@/lib/core/inventory-kardex")).getKardex(actor.tenant.id, string(query.get("productId"), "Producto"), { warehouseId: query.get("warehouseId") ?? undefined, dateFrom: query.has("from") ? date(query.get("from")) : undefined, dateTo: query.has("to") ? date(query.get("to")) : undefined });
  return data(result);
};
export const valuationRead: Operation = async ({ actor, query }) => data(await (await import("@/lib/core/inventory-valuation")).getValuation(actor.tenant.id, { warehouseId: query.get("warehouseId") ?? undefined }));
export const catalogList = (kind: "categories" | "brands" | "units"): Operation => async ({ actor, query }) => {
  const p = pagination(query), db = getPrismaClient();
  const args = { where: { tenantId: actor.tenant.id }, orderBy: { name: "asc" as const }, skip: p.skip, take: p.take };
  return pageResult(kind === "categories" ? await db.lightweightProductCategory.findMany(args) : kind === "brands" ? await db.inventoryBrand.findMany(args) : await db.inventoryUnit.findMany(args), query);
};
export const catalogSave = (kind: "categories" | "brands" | "units", update = false): Operation => async ({ actor, body, params }) => {
  const name = string(body.name, "Nombre"), tenantId = actor.tenant.id;
  if (kind === "categories") return data(update ? await getPrismaClient().lightweightProductCategory.update({ where: { id: params.id, tenantId }, data: { name } }) : await getPrismaClient().lightweightProductCategory.create({ data: { tenantId, name } }), update ? 200 : 201);
  if (kind === "brands") {
    const svc = await import("@/lib/core/inventory-brands");
    return data(update ? await svc.updateBrand(tenantId, params.id, { name }) : await svc.createBrand(tenantId, { name }), update ? 200 : 201);
  }
  const svc = await import("@/lib/core/inventory-units");
  return data(update ? await svc.updateUnit(tenantId, params.id, { name, abbreviation: string(body.abbreviation, "Abreviatura", true) || undefined }) : await svc.createUnit(tenantId, { name, code: string(body.code, "Código"), abbreviation: string(body.abbreviation, "Abreviatura", true) || undefined }), update ? 200 : 201);
};
export const pricesUpdate: Operation = async ({ actor, body }) => {
  const svc = await import("@/lib/core/inventory-prices");
  const validate: typeof svc.validatePriceChannel = svc.validatePriceChannel;
  validate(body.channel);
  const changes = rows(body.changes).map(i => ({ productId: string(i.productId, "Producto"), oldPrice: String(number(i.oldPrice, "Precio anterior")), newPrice: String(number(i.newPrice, "Precio nuevo")) }));
  await svc.confirmBulkPriceUpdate(actor.tenant.id, changes, body.channel, string(body.reason, "Motivo", true) || undefined, actor.user.id);
  return data({ updated: changes.length });
};

const documentSelect = {
  id: true, tenantId: true, sourceType: true, sourceId: true, documentType: true, status: true,
  environment: true, sequentialNumber: true, accessKey: true, customerName: true, customerIdentification: true,
  subtotal: true, taxTotal: true, discountTotal: true, grandTotal: true, currency: true, issuedAt: true, createdAt: true,
  establishment: { select: { id: true, code: true, name: true } }, issuePoint: { select: { id: true, code: true, name: true } },
} satisfies Prisma.SriDocumentSelect;
export const sriList = (invoicesOnly = false): Operation => async ({ actor, query }) => {
  const db = getPrismaClient(), p = pagination(query), status = query.get("status");
  const where: Prisma.SriDocumentWhereInput = { tenantId: actor.tenant.id, ...(invoicesOnly ? { documentType: "INVOICE" } : {}) };
  if (status) {
    const { SriDocumentStatus } = await import("@prisma/client");
    if (!Object.values(SriDocumentStatus).includes(status as never)) throw new ApiError(400, "INVALID_STATUS", "Estado SRI inválido.");
    where.status = status as keyof typeof SriDocumentStatus;
  }
  const [items, total] = await Promise.all([db.sriDocument.findMany({ where, select: documentSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: p.skip, take: p.take }), db.sriDocument.count({ where })]);
  return pageResult({ items, total }, query);
};
export const sriDetail = (invoicesOnly = false): Operation => async ({ actor, params }) => data(required(await getPrismaClient().sriDocument.findFirst({ where: { id: params.id, tenantId: actor.tenant.id, ...(invoicesOnly ? { documentType: "INVOICE" } : {}) }, select: { ...documentSelect, lines: true } })));
export const sriJobs: Operation = async ({ actor, params }) => {
  const db = getPrismaClient(), tenantId = actor.tenant.id;
  required(await db.sriDocument.findFirst({ where: { id: params.id, tenantId }, select: { id: true } }));
  const [signing, submission] = await Promise.all([
    db.sriSigningJob.findMany({ where: { tenantId, documentId: params.id }, select: { id: true, status: true, errorCode: true, createdAt: true, finishedAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.sriSubmissionJob.findMany({ where: { tenantId, documentId: params.id }, select: { id: true, status: true, errorCode: true, createdAt: true, finishedAt: true, sriAuthorizationNumber: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return data({ signing, submission });
};
export const sriAction = (action: "sign" | "submit"): Operation => async ({ actor, params }) => {
  const result = action === "sign" ? await (await import("@/lib/core/sri-signing-jobs")).createSriSigningJobForDocument({ tenantId: actor.tenant.id, documentId: params.id, requestedByUserId: actor.user.id }) : await (await import("@/lib/core/sri-submission-jobs")).createSriSubmissionJobForDocument({ tenantId: actor.tenant.id, documentId: params.id });
  if (!result.ok) throw new ApiError(result.code === "NOT_FOUND" ? 404 : 422, result.code, "El documento no cumple las condiciones para esta operación. Revisa su estado en Facturom.");
  return data({ jobId: "jobId" in result ? result.jobId : result.job.id, alreadyExists: result.alreadyExists }, 201);
};
export const invoiceFile = (format: "xml" | "ride"): Operation => async ({ actor, params }) => {
  const db = getPrismaClient(), tenantId = actor.tenant.id;
  const doc = required(await db.sriDocument.findFirst({ where: { id: params.id, tenantId, documentType: "INVOICE" }, select: { id: true, status: true } }));
  if (doc.status !== "AUTHORIZED") throw new ApiError(422, "DOCUMENT_NOT_AUTHORIZED", "El comprobante aún no está autorizado.");
  const job = required(await db.sriSubmissionJob.findFirst({ where: { tenantId, documentId: doc.id, status: "AUTHORIZED", authorizedXmlStorageKey: { not: null } }, orderBy: { createdAt: "desc" }, select: { authorizedXmlStorageKey: true } }));
  const xml = await (await import("@/lib/core/sri-authorized-xml-storage")).readAuthorizedXml(required(job.authorizedXmlStorageKey));
  if (format === "xml") return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": 'attachment; filename="autorizado.xml"' } });
  const parsed = (await import("@/lib/core/sri-authorized-xml-parser")).parseAuthorizedSriInvoiceXml(xml);
  const pdf = await (await import("@/lib/core/sri-ride-generator")).generateRidePdfFromAuthorizedXml(parsed, null);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="ride.pdf"' } });
};
export const documentList = (kind: "orders" | "credit-notes" | "debit-notes"): Operation => async ({ actor, query }) => {
  const db = getPrismaClient(), p = pagination(query), args = { where: { tenantId: actor.tenant.id }, orderBy: { createdAt: "desc" as const }, skip: p.skip, take: p.take };
  // Deliberate projection: storage paths and internal authorization passwords are never serialized.
  if (kind === "orders") return pageResult(await db.salesOrder.findMany({ ...args, select: { id: true, number: true, status: true, customerId: true, total: true, createdAt: true } }), query);
  if (kind === "credit-notes") return pageResult(await db.salesCreditNote.findMany({ ...args, select: { id: true, number: true, status: true, total: true, createdAt: true } }), query);
  return pageResult(await db.salesDebitNote.findMany({ ...args, select: { id: true, number: true, status: true, total: true, createdAt: true } }), query);
};

export const purchasesList: Operation = async ({ actor, query }) => {
  const result = await (await import("@/lib/core/purchase-documents")).listPurchaseDocuments(actor.tenant.id, { ...pagination(query), q: query.get("q") ?? undefined, from: query.get("from") ?? undefined, to: query.get("to") ?? undefined, documentType: query.get("documentType") ?? undefined, status: query.get("status") ?? undefined });
  // The original list includes imported XML/storage paths; expose only commercial fields.
  return pageResult({ items: result.items.map(d => ({ id: d.id, documentType: d.documentType, supplierDocumentNumber: d.supplierDocumentNumber, supplierName: d.supplierName, supplierIdentification: d.supplierIdentification, issueDate: d.issueDate, status: d.status, origin: d.origin, total: d.total, createdAt: d.createdAt })), total: result.total }, query);
};
export const purchasesCreate: Operation = async ({ actor, body }) => {
  const svc = await import("@/lib/core/purchase-documents");
  const { isValidTaxSupportCombination } = await import("@/lib/core/tax-support-catalog");
  if (body.taxSupportCode && !isValidTaxSupportCombination(String(body.taxSupportCode), String(body.documentType ?? "INVOICE"))) throw new ApiError(422, "INVALID_TAX_SUPPORT", "Sustento tributario incompatible.");
  // An integration may register a purchase; it cannot forge an SRI authorization/import.
  if (body.origin !== undefined || body.status !== undefined || body.authorizationNumber !== undefined || body.authorizationDate !== undefined) throw new ApiError(400, "RESERVED_FIELDS", "El origen, estado y autorización se resuelven por los flujos del sistema.");
  const input = { ...pick(body, ["supplierId", "documentType", "supplierDocumentNumber", "accessKey", "treasuryAccountId", "paymentMethod", "paymentTermDays", "accountingCategoryId", "taxSupportCode", "purchaseType", "sriPaymentCode", "accountingCostCenterId", "supplierName", "supplierIdentification", "notes"]), tenantId: actor.tenant.id, createdByUserId: actor.user.id, issueDate: date(body.issueDate, new Date()), dueDate: body.dueDate ? date(body.dueDate) : undefined } as Parameters<typeof svc.createPurchaseDocument>[0];
  for (const field of ["subtotal0", "subtotal15", "subtotalNoTax", "subtotalExempt", "discountTotal", "iceTotal", "ivaTotal", "total", "tipAmount"] as const) if (body[field] !== undefined) input[field] = number(body[field], field);
  if (body.items !== undefined) input.items = rows(body.items).map(i => ({ productId: string(i.productId, "Producto", true) || undefined, description: string(i.description, "Descripción"), quantity: number(i.quantity, "Cantidad", 0.000001), unitPrice: number(i.unitPrice, "Precio"), discountAmount: number(i.discountAmount ?? 0, "Descuento"), taxRate: number(i.taxRate ?? 0, "IVA") }));
  if (body.payments !== undefined) { requireScopes(actor, ["payments:create"]); input.payments = rows(body.payments).map(p => ({ method: paymentMethod(p.method), amount: number(p.amount, "Monto", 0.01) })); }
  const result = await svc.createPurchaseDocument(input);
  return data({ id: result.id, status: result.status, total: result.total }, 201);
};
export const purchasesUpdate: Operation = async ({ actor, params, body }) => {
  const svc = await import("@/lib/core/purchase-documents"), tenantId = actor.tenant.id;
  required(await svc.getPurchaseDocumentById(tenantId, params.id));
  if (typeof body.accountingCategoryId !== "string") throw new ApiError(400, "INVALID_FIELD", "accountingCategoryId requerido.");
  return data(await svc.updatePurchaseDocumentCategory(tenantId, params.id, body.accountingCategoryId));
};
export const purchasesCancel: Operation = async ({ actor, params }) => data(await (await import("@/lib/core/purchase-documents")).cancelPurchaseDocument(actor.tenant.id, params.id, actor.user.id));
export const receiptsList: Operation = async ({ actor, query }) => {
  const p = pagination(query);
  return pageResult(await getPrismaClient().purchaseReceipt.findMany({ where: { tenantId: actor.tenant.id }, include: { items: true }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }), query);
};
export const receiptsCreate: Operation = async ({ actor, body }) => {
  const defaultWarehouse = await (await import("@/lib/core/inventory-warehouses")).getDefaultWarehouse(actor.tenant.id);
  if (body.warehouseId && body.warehouseId !== defaultWarehouse?.id) throw new ApiError(422, "DEFAULT_WAREHOUSE_REQUIRED", "El flujo actual de recepción usa la bodega predeterminada. Selecciona esa bodega.");
  const items = rows(body.items).map(i => ({ productId: string(i.productId, "Producto"), quantityExpected: number(i.quantityExpected ?? 0, "Cantidad esperada"), quantityReceived: number(i.quantityReceived, "Cantidad recibida", 0.000001) }));
  return data(await getPrismaClient().purchaseReceipt.create({ data: { tenantId: actor.tenant.id, createdByUserId: actor.user.id, supplierId: string(body.supplierId, "Proveedor", true) || undefined, purchaseDocumentId: string(body.purchaseDocumentId, "Compra", true) || undefined, warehouseId: string(body.warehouseId, "Bodega", true) || undefined, notes: string(body.notes, "Notas", true) || undefined, items: { create: items } }, include: { items: true } }), 201);
};
export const receiptsConfirm: Operation = async ({ actor, params }) => {
  const receipt = required(await getPrismaClient().purchaseReceipt.findFirst({ where: { tenantId: actor.tenant.id, id: params.id }, include: { items: true } }));
  await validateReferences(actor.tenant.id, receipt);
  await (await import("@/lib/core/purchase-documents")).confirmPurchaseReceipt(actor.tenant.id, params.id);
  return data({ id: params.id, confirmed: true });
};

export const treasuryRead = (kind: "cash" | "banks" | "movements" | "receivables" | "payables" | "summary"): Operation => async ({ actor, query }) => {
  pagination(query);
  const svc = await import("@/lib/core/treasury/reads");
  const tenantId = actor.tenant.id;
  if (kind === "summary") return data(await svc.treasurySummary(tenantId));
  if (kind === "cash" || kind === "banks") return data(await svc.listAccounts(tenantId, kind === "cash" ? "CASH" : "BANK", query));
  if (kind === "receivables" || kind === "payables") return data(await svc.listObligations(tenantId, kind === "receivables" ? "RECEIVABLE" : "PAYABLE", query));
  return data(await svc.listMovements(tenantId, query.get("type") === "BANK" ? "BANK" : "CASH", query));
};
export const treasuryCollect = (type: "RECEIVABLE" | "PAYABLE"): Operation => async ({ actor, params, body }) => data(await (await import("@/lib/core/treasury/obligations")).collectOrPay({ tenantId: actor.tenant.id, userId: actor.user.id }, params.id, type, body), 201);
export const treasuryTransfer: Operation = async ({ actor, body }) => data(await (await import("@/lib/core/treasury/accounts")).transfer({ tenantId: actor.tenant.id, userId: actor.user.id }, body), 201);
export const treasuryAccount = (type: "CASH" | "BANK"): Operation => async ({ actor, body }) => data(await (await import("@/lib/core/treasury/accounts")).saveAccount({ tenantId: actor.tenant.id, userId: actor.user.id }, type, body), 201);
export const treasurySession: Operation = async ({ actor, body }) => data(await (await import("@/lib/core/treasury/accounts")).cashSession({ tenantId: actor.tenant.id, userId: actor.user.id }, body), 201);

export const accountsRead: Operation = async ({ actor }) => {
  const plan = required(await (await import("@/lib/core/accounting-plan")).getActivePlan(actor.tenant.id));
  return data({ planId: plan.id, accounts: await (await import("@/lib/core/accounting-accounts")).getAccountTree(actor.tenant.id, plan.id) });
};
export const journalList: Operation = async ({ actor, query }) => pageResult(await (await import("@/lib/core/accounting-journal")).getJournalEntries(actor.tenant.id, { ...pagination(query), search: query.get("q") ?? undefined, dateFrom: query.has("from") ? date(query.get("from")) : undefined, dateTo: query.has("to") ? date(query.get("to")) : undefined }), query);
export const journalDetail: Operation = async ({ actor, params }) => data(required(await (await import("@/lib/core/accounting-journal")).getJournalEntryById(actor.tenant.id, params.id)));
export const journalCreate: Operation = async ({ actor, body }) => {
  const tenantId = actor.tenant.id, db = getPrismaClient(), entryDate = date(body.date);
  await (await import("@/lib/core/accounting-periods")).ensurePeriodOpen(tenantId, entryDate);
  const lines = rows(body.lines);
  for (const line of lines) required(await db.accountingAccount.findFirst({ where: { id: string(line.accountId, "Cuenta"), tenantId, active: true, allowsPosting: true }, select: { id: true } }));
  return data(await (await import("@/lib/core/accounting-journal")).createJournalEntry(tenantId, { date: entryDate, description: string(body.description, "Descripción"), sourceType: "MANUAL", lines: lines.map(l => ({ accountId: string(l.accountId, "Cuenta"), debit: String(number(l.debit ?? 0, "Débito")), credit: String(number(l.credit ?? 0, "Crédito")), description: string(l.description, "Descripción", true) || undefined, costCenterId: string(l.costCenterId, "Centro de costo", true) || undefined, reference: string(l.reference, "Referencia", true) || undefined })) }, actor.user.id), 201);
};
export const journalAction = (reverse = false): Operation => async ({ actor, params, body }) => {
  const svc = await import("@/lib/core/accounting-journal"), tenantId = actor.tenant.id;
  const entry = required(await svc.getJournalEntryById(tenantId, params.id)), entryDate = reverse ? date(body.date) : entry.date;
  await (await import("@/lib/core/accounting-periods")).ensurePeriodOpen(tenantId, entryDate);
  return data(reverse ? await svc.reverseJournalEntry(tenantId, params.id, actor.user.id, entryDate) : await svc.postJournalEntry(tenantId, params.id, actor.user.id));
};
export const periodsRead: Operation = async ({ actor }) => data(await (await import("@/lib/core/accounting-periods")).getPeriods(actor.tenant.id));
export const accountingReport = (kind: "trial-balance" | "balance-sheet" | "income-statement" | "ledger"): Operation => async ({ actor, query }) => {
  const tenantId = actor.tenant.id, svc = await import("@/lib/core/accounting-reports");
  const plan = required(await (await import("@/lib/core/accounting-plan")).getActivePlan(tenantId));
  const filter = { planId: plan.id, dateFrom: date(query.get("from")), dateTo: date(query.get("to")) };
  if (filter.dateFrom > filter.dateTo) throw new ApiError(400, "INVALID_DATE_RANGE", "El inicio debe ser anterior al fin.");
  if (kind === "ledger") return data(await svc.getGeneralLedger(tenantId, { ...filter, accountId: string(query.get("accountId"), "Cuenta") }));
  return data(kind === "trial-balance" ? await svc.getTrialBalance(tenantId, filter) : kind === "balance-sheet" ? await svc.getBalanceSheet(tenantId, filter) : await svc.getIncomeStatement(tenantId, filter));
};
export const salesReport: Operation = async ({ actor }) => {
  const report = await (await import("@/lib/core/lightweight-pos")).getBasicReports(actor.tenant.id);
  return data({ salesToday: report.salesToday, salesMonth: report.salesMonth, collectedMonth: report.collectedMonth, pendingMonth: report.pendingMonth, paymentsByMethod: report.paymentsByMethod, topProducts: report.topProducts, pendingCustomers: report.pendingCustomers, counts: report.counts });
};
export const purchasesReport: Operation = async ({ actor, query }) => data(await (await import("@/lib/core/purchase-documents")).getPurchaseConsolidatedTotals(actor.tenant.id, { from: query.get("from") ?? undefined, to: query.get("to") ?? undefined }));
export const settingsRead: Operation = async ({ actor }) => data(await getPrismaClient().tenant.findUnique({ where: { id: actor.tenant.id }, select: { id: true, name: true, legalName: true, taxIdentificationType: true, taxIdentificationValue: true, currency: true, country: true, city: true, province: true, address: true, contactEmail: true, phone: true } }));
export const usersRead: Operation = async ({ actor, query }) => {
  const p = pagination(query);
  return pageResult(await getPrismaClient().membership.findMany({ where: { tenantId: actor.tenant.id }, select: { role: true, status: true, user: { select: { id: true, name: true, email: true, status: true } } }, orderBy: { createdAt: "asc" }, skip: p.skip, take: p.take }), query);
};

// Reuse the same extracted business writes as the existing web routes.
export const salesDocumentCreate = (kind: "orders" | "credit-notes" | "debit-notes"): Operation => async ({ actor, body }) => {
  const svc = await import("@/lib/core/sales-documents");
  if (kind === "orders" && body.status !== undefined && body.status !== "DRAFT") throw new ApiError(400, "CONFIRM_ORDER_SEPARATELY", "Crea la orden en borrador y usa su endpoint de confirmación.");
  const sanitized = pick(body, ["sourceSriDocumentId", "type", "reason", "customerName", "customerIdentification", "customerEmail", "customerAddress", "customerId", "warehouseId", "issueDate", "expectedDate", "observation", "status"]);
  if (body.issueDate) sanitized.issueDate = date(body.issueDate).toISOString();
  if (body.expectedDate) sanitized.expectedDate = date(body.expectedDate).toISOString();
  for (const field of ["subtotal", "discount", "tax", "total"]) if (body[field] !== undefined) sanitized[field] = number(body[field], field);
  if (kind !== "debit-notes") sanitized.items = rows(body.items).map(i => ({ ...pick(i, ["productId", "code", "description", "taxCategory"]), productName: string(i.productName, "Nombre de producto"), quantity: number(i.quantity, "Cantidad", 0.000001), unitPrice: number(i.unitPrice, "Precio"), discount: number(i.discount ?? 0, "Descuento"), taxRate: number(i.taxRate ?? 0, "IVA"), tax: number(i.tax ?? 0, "IVA calculado"), subtotal: number(i.subtotal, "Subtotal"), total: number(i.total, "Total") }));
  if (kind === "debit-notes") sanitized.reasons = rows(body.reasons).map(i => ({ description: string(i.description, "Motivo"), amount: number(i.amount, "Monto", 0.01), taxRate: number(i.taxRate ?? 0, "IVA"), tax: number(i.tax ?? 0, "IVA calculado"), total: number(i.total, "Total") }));
  if (kind !== "orders") {
    const id = string(body.sourceSriDocumentId, "Factura origen");
    const source = required(await getPrismaClient().sriDocument.findFirst({ where: { id, tenantId: actor.tenant.id, documentType: "INVOICE", status: "AUTHORIZED" } }));
    sanitized.customerName = source.customerName; sanitized.customerIdentification = source.customerIdentification ?? undefined; sanitized.customerEmail = source.customerEmail ?? undefined;
    if (kind === "credit-notes" && body.type && !["RETURN", "DISCOUNT", "BONUS", "ADJUSTMENT"].includes(String(body.type))) throw new ApiError(400, "INVALID_TYPE", "Tipo de nota de crédito inválido.");
  }
  // Same draft workflow as the UI; this does not claim SRI authorization.
  const create = kind === "orders" ? svc.createSalesOrder : kind === "credit-notes" ? svc.createSalesCreditNote : svc.createSalesDebitNote;
  return data(await create(actor.tenant.id, actor.user.id, sanitized), 201);
};
export const purchaseOrdersList: Operation = async ({ actor, query }) => pageResult(await (await import("@/lib/core/inventory-orders")).getOrders(actor.tenant.id, { ...pagination(query) }), query);
export const purchaseOrdersCreate: Operation = async ({ actor, body }) => data(await (await import("@/lib/core/inventory-orders")).createOrder(actor.tenant.id, { warehouseId: string(body.warehouseId, "Bodega"), supplierId: string(body.supplierId, "Proveedor", true) || undefined, expectedAt: body.expectedAt ? date(body.expectedAt) : undefined, notes: string(body.notes, "Notas", true) || undefined, userId: actor.user.id, items: rows(body.items).map(i => ({ productId: string(i.productId, "Producto"), requestedQuantity: number(i.requestedQuantity, "Cantidad", 0.000001), unitCostEstimate: i.unitCostEstimate == null ? undefined : number(i.unitCostEstimate, "Costo estimado") })) }), 201);

export const guidesList: Operation = async ({ actor, query }) => pageResult(await (await import("@/lib/core/inventory-guides")).getShipmentGuides(actor.tenant.id, { ...pagination(query), dateFrom: query.has("from") ? date(query.get("from")) : undefined, dateTo: query.has("to") ? date(query.get("to")) : undefined }), query);
export const guidesDetail: Operation = async ({ actor, params }) => data(required(await (await import("@/lib/core/inventory-guides")).getShipmentGuideById(actor.tenant.id, params.id)));
export const guidesCreate: Operation = async ({ actor, body }) => {
  const issueDate = date(body.issueDate, new Date()), startTransportDate = date(body.startTransportDate), endTransportDate = body.endTransportDate ? date(body.endTransportDate) : undefined;
  if (endTransportDate && endTransportDate < startTransportDate) throw new ApiError(400, "INVALID_DATE_RANGE", "El transporte debe terminar después de su inicio.");
  return data(await (await import("@/lib/core/inventory-guides")).createShipmentGuide(actor.tenant.id, { ...pick(body, ["route", "carrierIdentification", "carrierName", "vehicleId", "sourceWarehouseId", "saleId", "transferId", "notes"]), issueDate, startTransportDate, endTransportDate, originAddress: string(body.originAddress, "Dirección de origen"), destinationAddress: string(body.destinationAddress, "Dirección de destino"), reason: string(body.reason, "Motivo"), userId: actor.user.id, items: rows(body.items).map(i => ({ productId: string(i.productId, "Producto", true) || undefined, code: string(i.code, "Código"), description: string(i.description, "Descripción"), quantity: number(i.quantity, "Cantidad", 0.000001) })) }), 201);
};
export const guidesUpdate: Operation = async ({ actor, params, body }) => {
  if (body.status !== "ISSUED" && body.status !== "CANCELLED") throw new ApiError(400, "INVALID_STATUS", "Usa ISSUED o CANCELLED para una guía en borrador.");
  return data(await (await import("@/lib/core/inventory-guides")).updateShipmentGuideStatus(actor.tenant.id, params.id, body.status));
};
export const vehiclesList: Operation = async ({ actor, query }) => {
  const p = pagination(query);
  return pageResult(await getPrismaClient().inventoryVehicle.findMany({ where: { tenantId: actor.tenant.id }, orderBy: { plate: "asc" }, skip: p.skip, take: p.take }), query);
};
export const vehiclesSave = (update = false): Operation => async ({ actor, body, params }) => {
  const service = await import("@/lib/core/inventory-guides");
  const input = { ...pick(body, ["brand", "model", "color", "notes", ...(update ? ["active"] : [])]), plate: string(body.plate, "Placa"), ...(body.year === undefined ? {} : { year: number(body.year, "Año", 1900) }) };
  return data(update ? await service.updateVehicle(actor.tenant.id, params.id, input) : await service.createVehicle(actor.tenant.id, input), update ? 200 : 201);
};
export const syncJobsList: Operation = async ({ actor, query }) => {
  const db = getPrismaClient(), p = pagination(query), tenantId = actor.tenant.id;
  const select = { id: true, type: true, status: true, dateFrom: true, dateTo: true, startedAt: true, finishedAt: true, documentsFound: true, documentsImported: true, documentsFailed: true, errorCode: true };
  const args = { where: { tenantId }, select, orderBy: { createdAt: "desc" as const }, skip: p.skip, take: p.take };
  const [purchases, sales] = await Promise.all([db.purchaseSriSyncJob.findMany(args), db.salesSriSyncJob.findMany(args)]);
  return pageResult({ purchases, sales }, query);
};
export const syncPurchases: Operation = async ({ actor, body }) => {
  const credential = await (await import("@/lib/core/purchase-sri-credentials")).getCredential(actor.tenant.id);
  if (!credential || credential.status !== "VERIFIED") throw new ApiError(422, "SRI_CREDENTIALS_NOT_VERIFIED", "Verifica las credenciales SRI en Facturom antes de sincronizar.");
  const dateFrom = date(body.from), dateTo = date(body.to);
  if (dateFrom > dateTo || dateTo.getTime() - dateFrom.getTime() > 366 * 86400000) throw new ApiError(400, "INVALID_DATE_RANGE", "Selecciona un rango de hasta 366 días.");
  const result = await (await import("@/lib/core/purchase-sync-jobs")).createSyncJob(actor.tenant.id, "SYNC_RECEIVED_DOCUMENTS", { trigger: "MANUAL", requestedByUserId: actor.user.id, dateFrom, dateTo });
  return data({ jobId: result.job.id, status: result.job.status, created: result.created }, 201);
};
export const sriIssued: Operation = async ({ actor, query }) => {
  const p = pagination(query);
  return pageResult(await (await import("@/lib/core/sales-consolidated")).listConsolidatedSales(actor.tenant.id, { page: p.page, perPage: p.pageSize, q: query.get("q") ?? undefined, from: query.has("from") ? date(query.get("from")) : undefined, to: query.has("to") ? date(query.get("to")) : undefined }), query);
};

export const sriCancel: Operation = async ({ actor, body, params }) => {
  const { SriCancellationReason } = await import("@prisma/client");
  const reasonCode = string(body.reasonCode, "Motivo");
  if (!Object.values(SriCancellationReason).includes(reasonCode as never)) throw new ApiError(400, "INVALID_REASON", "Usa EMISSION_ERROR u OPERATION_NOT_OCCURRED.");
  const result = await (await import("@/lib/core/sri-cancellation")).requestSriInvoiceCancellation({ tenantId: actor.tenant.id, sriDocumentId: params.id, reasonCode: reasonCode as keyof typeof SriCancellationReason, reasonText: string(body.reasonText, "Detalle", true) || undefined, requestedByUserId: actor.user.id });
  return data({ id: result.id, status: result.status, sriDocumentId: result.sriDocumentId }, 201);
};

export const ordersDetail: Operation = async ({ actor, params }) => data(required(await getPrismaClient().salesOrder.findFirst({ where: { id: params.id, tenantId: actor.tenant.id }, include: { items: true } })));
export const ordersAction = (action: "confirm" | "cancel"): Operation => async ({ actor, params }) => data(await (await import("@/lib/core/sales-documents")).transitionSalesOrder(actor.tenant.id, params.id, action));
