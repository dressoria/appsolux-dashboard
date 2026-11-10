// OpenAPI contracts describe the actual adapters. The route registry is the
// only endpoint inventory; these shapes document its request DTOs.
type Schema = Record<string, unknown>;
const text: Schema = { type: "string" }, numeric: Schema = { type: "number", minimum: 0 }, flag: Schema = { type: "boolean" }, iso: Schema = { type: "string", format: "date-time" };
const fields = (names: string[], schema: Schema = text) => Object.fromEntries(names.map(name => [name, schema]));
const shape = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false });
const array = (items: Schema): Schema => ({ type: "array", items, minItems: 1, maxItems: 200 });
const line = shape({ ...fields(["productId", "description", "observation"]), ...fields(["quantity", "unitPrice", "discount", "discountAmount", "taxRate"], numeric) }, ["productId", "quantity"]);
const customer = { ...fields(["name", "tradeName", "phone", "email", "address", "country", "province", "city", "parish", "sector", "zone", "groupName", "customerType", "customerOrigin", "assignedSellerId", "identification", "notes", "gender", "relatedCustomerId", "invoiceThirdPartyCustomerId"]), identificationType: { type: "string", enum: ["RUC", "CEDULA", "PASSPORT", "FOREIGN_ID"] }, phoneNumbers: { type: "array", items: text }, additionalEmails: { type: "array", items: text }, ...fields(["isRelated", "isForeign", "invoiceThirdParty"], flag) };
const product = { ...fields(["name", "description", "primaryCode", "barcode", "auxiliaryCode", "auxiliaryTransportCode", "categoryId", "unitId", "brandId", "defaultWarehouseId", "salesAccountId", "inventoryAccountId", "cogsAccountId", "purchaseAccountId", "color", "additionalComment", "warrantyUnit"]), ...fields(["price", "price2", "price3", "price4", "cost", "taxRate", "minStock", "warrantyDuration"], numeric), ...fields(["isActive", "trackInventory", "isProcessed"], flag), type: { type: "string", enum: ["PRODUCT", "SERVICE", "COMBO"] }, taxCategory: { type: "string", enum: ["TAXABLE", "ZERO", "NON_OBJECT", "EXEMPT"] } };
const docLine = shape({ ...fields(["productId", "code", "productName", "description", "taxCategory"]), ...fields(["quantity", "unitPrice", "discount", "taxRate", "tax", "subtotal", "total"], numeric) }, ["productName", "quantity", "unitPrice", "subtotal", "total"]);
const document = { ...fields(["sourceSriDocumentId", "type", "reason", "customerName", "customerIdentification", "customerEmail", "customerAddress", "customerId", "warehouseId", "observation", "status"]), issueDate: iso, expectedDate: iso, ...fields(["subtotal", "discount", "tax", "total"], numeric), items: array(docLine), reasons: array(shape({ description: text, ...fields(["amount", "taxRate", "tax", "total"], numeric) }, ["description", "amount", "total"])) };
const payment = shape({ method: { type: "string", enum: ["cash", "check", "deposit", "transfer", "debit_card", "credit_card", "card", "credit"] }, amount: numeric, ...fields(["treasuryAccountId", "referenceNumber", "batchNumber", "voucherNumber", "dueDate"]) }, ["method", "amount"]);
export function requestSchema(method: string, path: string): Schema {
  if (path === "sri/documents/{id}/cancel") return shape({ reasonCode: { type: "string", enum: ["EMISSION_ERROR", "OPERATION_NOT_OCCURRED"] }, reasonText: text }, ["reasonCode"]);
  if (method === "DELETE" || /\/(complete|confirm|cancel|sign|submit|post)$/.test(path)) return shape({});
  if (path === "customers" || path === "customers/{id}") return shape(customer, method === "POST" ? ["name"] : []);
  if (path === "suppliers" || path === "suppliers/{id}") {
    const supplier = { ...customer, ...fields(["supplierType", "supplierOrigin", "assignedBuyerId", "relatedSupplierId"]) };
    for (const k of ["customerType", "customerOrigin", "assignedSellerId", "relatedCustomerId", "invoiceThirdPartyCustomerId", "invoiceThirdParty", "gender", "notes"]) delete supplier[k as keyof typeof supplier];
    return shape(supplier, method === "POST" ? ["name", "identificationType", "identification"] : []);
  }
  if (path === "products" || path === "products/{id}") return shape(product, method === "POST" ? ["name"] : []);
  if (path === "products/prices") return shape({ channel: { type: "string", enum: ["price", "price2", "price3", "price4"] }, reason: text, changes: array(shape({ productId: text, oldPrice: numeric, newPrice: numeric }, ["productId", "oldPrice", "newPrice"])) }, ["channel", "changes"]);
  if (/^inventory\/(categories|brands|units)(\/\{id\})?$/.test(path)) return shape({ name: text, ...(path.includes("units") ? { code: text, abbreviation: text } : {}) }, ["name", ...(path.endsWith("units") && method === "POST" ? ["code"] : [])]);
  if (path.startsWith("inventory/warehouses")) return shape({ ...fields(["code", "name", "address", "city", "phone"]), isDefault: flag, active: flag }, method === "POST" ? ["code", "name"] : []);
  if (path === "inventory/vehicles" || path === "inventory/vehicles/{id}") return shape({ ...fields(["plate", "brand", "model", "color", "notes"]), year: numeric, active: flag }, ["plate"]);
  if (path === "inventory/shipping-guides/{id}") return shape({ status: { type: "string", enum: ["ISSUED", "CANCELLED"] } }, ["status"]);
  if (path === "inventory/shipping-guides") return shape({ ...fields(["originAddress", "destinationAddress", "reason", "route", "carrierIdentification", "carrierName", "vehicleId", "sourceWarehouseId", "saleId", "transferId", "notes"]), issueDate: iso, startTransportDate: iso, endTransportDate: iso, items: array(shape({ ...fields(["productId", "code", "description"]), quantity: numeric }, ["code", "description", "quantity"])) }, ["startTransportDate", "originAddress", "destinationAddress", "reason", "items"]);
  if (path === "sri/received/sync") return shape({ from: iso, to: iso }, ["from", "to"]);
  if (path === "inventory/adjustments") return shape({ productId: text, warehouseId: text, quantity: { type: "number", exclusiveMinimum: true, minimum: 0 }, type: { type: "string", enum: ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] }, reason: text, reference: text }, ["productId", "warehouseId", "quantity", "type"]);
  if (path === "inventory/transfers") return shape({ sourceWarehouseId: text, destinationWarehouseId: text, notes: text, items: array(shape({ productId: text, quantity: numeric }, ["productId", "quantity"])) }, ["sourceWarehouseId", "destinationWarehouseId", "items"]);
  if (path === "inventory/physical-counts") return shape({ warehouseId: text, notes: text }, ["warehouseId"]);
  if (path === "inventory/physical-counts/{id}") return shape({ productId: text, countedQuantity: numeric }, ["productId", "countedQuantity"]);
  if (path.startsWith("proformas")) return shape({ customerId: text, establishmentId: text, issueDate: iso, validUntil: iso, observation: text, items: array(line) }, ["items"]);
  if (path === "sales") return shape({ ...fields(["customerId", "warehouseId", "treasuryAccountId", "invoiceKind", "dueDate", "shipmentGuideId", "establishmentId", "issuePointId", "sriPaymentCode", "notes", "paymentMethod"]), paidAmount: numeric, items: array(line), payments: array(payment), exportData: { type: "object" }, reimbursementData: { type: "object" } }, ["paymentMethod", "items"]);
  if (path === "sales/{id}/payments") return shape({ method: text, amount: numeric, treasuryAccountId: text }, ["method", "amount"]);
  if (["sales/orders", "credit-notes", "debit-notes"].includes(path)) return shape(document, path === "debit-notes" ? ["sourceSriDocumentId", "reasons"] : ["items", ...(path === "credit-notes" ? ["sourceSriDocumentId"] : [])]);
  if (path === "invoices") return shape({ saleId: text, establishmentId: text, issuePointId: text }, ["saleId"]);
  if (path === "purchases/{id}") return shape({ accountingCategoryId: text }, ["accountingCategoryId"]);
  if (path === "purchases") return shape({ ...fields(["supplierId", "documentType", "supplierDocumentNumber", "accessKey", "treasuryAccountId", "paymentMethod", "accountingCategoryId", "taxSupportCode", "purchaseType", "sriPaymentCode", "accountingCostCenterId", "supplierName", "supplierIdentification", "notes"]), ...fields(["subtotal0", "subtotal15", "subtotalNoTax", "subtotalExempt", "discountTotal", "iceTotal", "ivaTotal", "total", "tipAmount", "paymentTermDays"], numeric), issueDate: iso, dueDate: iso, items: array(shape({ ...fields(["productId", "description"]), ...fields(["quantity", "unitPrice", "discountAmount", "taxRate"], numeric) }, ["description", "quantity", "unitPrice"])), payments: array(payment) });
  if (path === "purchases/receipts") return shape({ supplierId: text, purchaseDocumentId: text, warehouseId: text, notes: text, items: array(shape({ productId: text, quantityExpected: numeric, quantityReceived: numeric }, ["productId", "quantityReceived"])) }, ["items"]);
  if (path === "purchases/orders") return shape({ supplierId: text, warehouseId: text, expectedAt: iso, notes: text, items: array(shape({ productId: text, requestedQuantity: numeric, unitCostEstimate: numeric }, ["productId", "requestedQuantity"])) }, ["warehouseId", "items"]);
  if (path === "treasury/cash" || path === "treasury/banks") return shape({ ...fields(["id", "name", "code", "responsibleName", "bankName", "accountName", "bankAccountType", "accountNumber", "currency", "openingBalance"]), openingDate: iso, active: flag, defaultAccount: flag }, ["name", ...(path.endsWith("banks") ? ["bankName"] : [])]);
  if (path === "treasury/cash/sessions") return shape({ accountId: text, action: { type: "string", enum: ["open", "close"] }, countedAmount: text, notes: text }, ["accountId", "action"]);
  if (path === "treasury/transfers") return shape({ ...fields(["fromAccountId", "toAccountId", "requestKey", "amount", "description", "reference"]), date: iso }, ["fromAccountId", "toAccountId", "requestKey", "amount"]);
  if (/^treasury\/(receivables|payables)\//.test(path)) return shape({ ...fields(["accountId", "method", "requestKey", "amount", "reference"]), date: iso }, ["accountId", "method", "requestKey", "amount"]);
  if (path === "accounting/journal") return shape({ date: iso, description: text, lines: array(shape({ ...fields(["accountId", "description", "debit", "credit", "costCenterId", "reference"]) }, ["accountId"])) }, ["date", "description", "lines"]);
  if (path === "accounting/journal/{id}/reverse") return shape({ date: iso }, ["date"]);
  return shape({});
}
export function queryParameters(path: string) {
  if (path === "sri/received") path = "purchases";
  const names = new Set<string>();
  if (["products", "customers", "suppliers", "proformas", "accounting/journal", "purchases"].includes(path)) names.add("q");
  if (path === "products") ["type", "categoryId", "brandId", "isActive"].forEach(s => names.add(s));
  if (["sales", "invoices", "sri/documents", "inventory/transfers", "purchases"].includes(path)) names.add("status");
  if (["inventory/stock", "inventory/movements", "inventory/kardex"].includes(path)) { names.add("productId"); names.add("warehouseId"); }
  if (["inventory/physical-counts", "inventory/valuation", "reports/inventory"].includes(path)) names.add("warehouseId");
  if (["proformas", "accounting/journal", "purchases", "reports/purchases", "inventory/movements", "inventory/kardex"].includes(path) || path.startsWith("accounting/reports/")) { names.add("from"); names.add("to"); }
  if (path === "purchases") names.add("documentType");
  if (path === "treasury/movements") ["type", "accountId", "from", "to", "direction", "status", "movementType", "q"].forEach(s => names.add(s));
  if (["treasury/cash", "treasury/banks"].includes(path)) names.add("q");
  if (["treasury/receivables", "treasury/payables"].includes(path)) ["q", "partyId", "status", "due", "from", "to"].forEach(s => names.add(s));
  if (path === "inventory/shipping-guides") ["from", "to"].forEach(s => names.add(s));
  if (path === "sri/issued") ["q", "from", "to"].forEach(s => names.add(s));
  if (path.endsWith("/ledger")) names.add("accountId");
  return [...names].map(name => ({ in: "query", name, required: (path === "inventory/kardex" && name === "productId") || (path.startsWith("accounting/reports/") && ["from", "to"].includes(name)) || (path.endsWith("/ledger") && name === "accountId"), schema: { type: "string" } }));
}

const paginatedPaths = new Set([
  "customers", "suppliers", "products", "proformas", "sales", "sales/orders", "credit-notes", "debit-notes",
  "inventory/stock", "inventory/warehouses", "inventory/movements", "inventory/transfers", "inventory/physical-counts",
  "inventory/categories", "inventory/brands", "inventory/units", "inventory/shipping-guides", "inventory/vehicles",
  "invoices", "sri/documents", "sri/sync-jobs", "sri/received", "sri/issued", "purchases", "purchases/receipts", "purchases/orders",
  "treasury/cash", "treasury/banks", "treasury/movements", "treasury/receivables", "treasury/payables", "accounting/journal", "users",
]);
export function supportsPagination(path: string) { return paginatedPaths.has(path); }
