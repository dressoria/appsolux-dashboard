import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { notFound, string } from "./errors";

// Every supplied foreign key is resolved with tenantId, even if the original
// service only relies on database foreign keys. No request data becomes context.
export async function validateReferences(tenantId: string, value: unknown) {
  const db = getPrismaClient();
  const checks: Record<string, (id: string) => Promise<unknown>> = {
    salesOrderId: id => db.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true } }),
    proformaId: id => db.lightweightProforma.findFirst({ where: { id, tenantId }, select: { id: true } }),
    receiptId: id => db.purchaseReceipt.findFirst({ where: { id, tenantId }, select: { id: true } }),
    countId: id => db.inventoryPhysicalCount.findFirst({ where: { id, tenantId }, select: { id: true } }),
    journalEntryId: id => db.accountingJournalEntry.findFirst({ where: { id, tenantId }, select: { id: true } }),
    receivableId: id => db.treasuryObligation.findFirst({ where: { id, tenantId, type: "RECEIVABLE" }, select: { id: true } }),
    payableId: id => db.treasuryObligation.findFirst({ where: { id, tenantId, type: "PAYABLE" }, select: { id: true } }),
    productId: id => db.lightweightProduct.findFirst({ where: { id, tenantId }, select: { id: true } }),
    componentProductId: id => db.lightweightProduct.findFirst({ where: { id, tenantId }, select: { id: true } }),
    customerId: id => db.lightweightCustomer.findFirst({ where: { id, tenantId }, select: { id: true } }),
    relatedCustomerId: id => db.lightweightCustomer.findFirst({ where: { id, tenantId }, select: { id: true } }),
    invoiceThirdPartyCustomerId: id => db.lightweightCustomer.findFirst({ where: { id, tenantId }, select: { id: true } }),
    supplierId: id => db.lightweightSupplier.findFirst({ where: { id, tenantId }, select: { id: true } }),
    relatedSupplierId: id => db.lightweightSupplier.findFirst({ where: { id, tenantId }, select: { id: true } }),
    warehouseId: id => db.inventoryWarehouse.findFirst({ where: { id, tenantId }, select: { id: true } }),
    defaultWarehouseId: id => db.inventoryWarehouse.findFirst({ where: { id, tenantId }, select: { id: true } }),
    sourceWarehouseId: id => db.inventoryWarehouse.findFirst({ where: { id, tenantId }, select: { id: true } }),
    destinationWarehouseId: id => db.inventoryWarehouse.findFirst({ where: { id, tenantId }, select: { id: true } }),
    categoryId: id => db.lightweightProductCategory.findFirst({ where: { id, tenantId }, select: { id: true } }),
    brandId: id => db.inventoryBrand.findFirst({ where: { id, tenantId }, select: { id: true } }),
    unitId: id => db.inventoryUnit.findFirst({ where: { id, tenantId }, select: { id: true } }),
    establishmentId: id => db.sriEstablishment.findFirst({ where: { id, tenantId }, select: { id: true } }),
    issuePointId: id => db.sriIssuePoint.findFirst({ where: { id, tenantId }, select: { id: true } }),
    sourceSriDocumentId: id => db.sriDocument.findFirst({ where: { id, tenantId }, select: { id: true } }),
    vehicleId: id => db.inventoryVehicle.findFirst({ where: { id, tenantId }, select: { id: true } }),
    transferId: id => db.inventoryTransfer.findFirst({ where: { id, tenantId }, select: { id: true } }),
    saleId: id => db.lightweightSale.findFirst({ where: { id, tenantId }, select: { id: true } }),
    purchaseDocumentId: id => db.purchaseDocument.findFirst({ where: { id, tenantId }, select: { id: true } }),
    treasuryAccountId: id => db.treasuryAccount.findFirst({ where: { id, tenantId }, select: { id: true } }),
    accountingCategoryId: id => db.purchaseAccountingCategory.findFirst({ where: { id, tenantId }, select: { id: true } }),
    accountingCostCenterId: id => db.accountingCostCenter.findFirst({ where: { id, tenantId }, select: { id: true } }),
    costCenterId: id => db.accountingCostCenter.findFirst({ where: { id, tenantId }, select: { id: true } }),
    salesAccountId: id => db.accountingAccount.findFirst({ where: { id, tenantId }, select: { id: true } }),
    inventoryAccountId: id => db.accountingAccount.findFirst({ where: { id, tenantId }, select: { id: true } }),
    cogsAccountId: id => db.accountingAccount.findFirst({ where: { id, tenantId }, select: { id: true } }),
    purchaseAccountId: id => db.accountingAccount.findFirst({ where: { id, tenantId }, select: { id: true } }),
    shipmentGuideId: id => db.shipmentGuide.findFirst({ where: { id, tenantId }, select: { id: true } }),
    assignedSellerId: id => db.membership.findFirst({ where: { userId: id, tenantId, status: "active", user: { status: "active" } }, select: { id: true } }),
    assignedBuyerId: id => db.membership.findFirst({ where: { userId: id, tenantId, status: "active", user: { status: "active" } }, select: { id: true } }),
  };
  const visited = new Set<string>();
  async function visit(input: unknown): Promise<void> {
    if (Array.isArray(input)) { for (const row of input) await visit(row); return; }
    if (!input || typeof input !== "object") return;
    for (const [key, entry] of Object.entries(input)) {
      if (Object.hasOwn(checks, key) && entry != null && entry !== "") {
        const id = string(entry, "Referencia"), cache = `${key}:${id}`;
        if (!visited.has(cache)) { if (!await checks[key](id)) throw notFound(); visited.add(cache); }
      }
      await visit(entry);
    }
  }
  await visit(value);
}

const primaryReferences: Record<string, string> = {
  customers: "customerId", suppliers: "supplierId", products: "productId", proformas: "proformaId", sales: "saleId", invoices: "sourceSriDocumentId",
  "sales/orders": "salesOrderId", "sri/documents": "sourceSriDocumentId", "inventory/warehouses": "warehouseId", "inventory/transfers": "transferId", "inventory/physical-counts": "countId",
  "inventory/categories": "categoryId", "inventory/brands": "brandId", "inventory/units": "unitId", "inventory/shipping-guides": "shipmentGuideId", "inventory/vehicles": "vehicleId",
  purchases: "purchaseDocumentId", "purchases/receipts": "receiptId", "accounting/journal": "journalEntryId", "treasury/receivables": "receivableId", "treasury/payables": "payableId",
};
export function primaryReference(path: string, id: string | undefined) {
  if (!id) return {};
  const resource = path.split("/{id}")[0], key = primaryReferences[resource];
  return key ? { [key]: id } : {};
}
