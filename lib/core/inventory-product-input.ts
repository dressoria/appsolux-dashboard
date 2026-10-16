// Shared by the form, API and importer. No database or server imports.
export class ProductInputError extends Error {
  constructor(message: string, public field?: string, public code = "VALIDATION_ERROR", public status = 400) {
    super(message);
  }
}

export const PRODUCT_TAX_OPTIONS = [
  { value: "15", label: "15%", taxCategory: "TAXABLE", taxRate: 15 },
  { value: "5", label: "5%", taxCategory: "TAXABLE", taxRate: 5 },
  { value: "8", label: "8%", taxCategory: "TAXABLE", taxRate: 8 },
  { value: "12", label: "12%", taxCategory: "TAXABLE", taxRate: 12 },
  { value: "0", label: "0%", taxCategory: "ZERO", taxRate: 0 },
  { value: "NON_OBJECT", label: "No Objeto de Impuesto", taxCategory: "NON_OBJECT", taxRate: 0 },
  { value: "EXEMPT", label: "Exento de IVA", taxCategory: "EXEMPT", taxRate: 0 },
] as const;

export function parseProductTax(value: unknown) {
  const key = String(value ?? "0").trim().toUpperCase().replace(/%$/, "");
  const alias = key === "NO_OBJETO" ? "NON_OBJECT" : key === "EXENTO" ? "EXEMPT" : key;
  const option = PRODUCT_TAX_OPTIONS.find((o) => o.value === alias);
  if (!option) throw new ProductInputError("IVA inválido. Selecciona una tarifa permitida.", "taxRate");
  return { taxCategory: option.taxCategory, taxRate: option.taxRate };
}

export function productTaxValue(category: unknown, rate: unknown) {
  return category === "NON_OBJECT" || category === "EXEMPT" ? category : String(Number(rate ?? 0));
}

export function productTaxLabel(category: unknown, rate: unknown) {
  if (category === "NON_OBJECT") return "No objeto";
  if (category === "EXEMPT") return "Exento";
  return `${Number(rate ?? 0)}%`;
}

export function productNumber(value: unknown, field: string, integer = false): number {
  const raw = typeof value === "string" ? value.trim() : value;
  const number = raw == null || raw === "" ? 0 : typeof raw === "number" || typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(number)) throw new ProductInputError("Ingresa un valor numérico válido.", field);
  if (number < 0) throw new ProductInputError("El precio no puede ser negativo.", field);
  if ((integer && !Number.isInteger(number)) || number > (integer ? 2147483647 : 9999999999.99)) {
    throw new ProductInputError(integer ? "Ingresa un entero válido." : "El valor excede el máximo permitido.", field);
  }
  return number;
}

function text(value: unknown, field: string) {
  if (value == null) return null;
  if (typeof value !== "string") throw new ProductInputError("Ingresa un texto válido.", field);
  return value.trim() || null;
}

function flag(value: unknown, fallback: boolean, field: string) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new ProductInputError("Valor booleano inválido.", field);
  return value;
}

export function normalizeProductInput(input: Record<string, unknown>, existing?: Record<string, unknown>) {
  const data = { ...existing, ...input };
  const name = text(data.name, "name");
  if (!name) throw new ProductInputError("Nombre requerido.", "name");
  const type = data.type ?? "PRODUCT";
  if (type !== "PRODUCT" && type !== "SERVICE" && type !== "COMBO") throw new ProductInputError("Tipo de producto inválido.", "type");
  const taxRate = productNumber(data.taxRate, "taxRate");
  const category = data.taxCategory;
  const tax = parseProductTax(productTaxValue(category, taxRate));
  if (category != null && category !== "" && category !== tax.taxCategory) throw new ProductInputError("La clasificación y tarifa de IVA no coinciden.", "taxCategory");
  if ((category === "NON_OBJECT" || category === "EXEMPT") && taxRate !== 0) throw new ProductInputError("Esta clasificación requiere IVA 0%.", "taxRate");
  const warrantyUnit = text(data.warrantyUnit, "warrantyUnit");
  if (warrantyUnit && warrantyUnit !== "DAYS" && warrantyUnit !== "MONTHS" && warrantyUnit !== "YEARS") throw new ProductInputError("Unidad de garantía inválida.", "warrantyUnit");
  return {
    name, type: type as "PRODUCT" | "SERVICE" | "COMBO", description: text(data.description, "description"),
    primaryCode: text(data.primaryCode, "primaryCode"), barcode: text(data.barcode, "barcode"),
    auxiliaryCode: text(data.auxiliaryCode, "auxiliaryCode"), auxiliaryTransportCode: text(data.auxiliaryTransportCode, "auxiliaryTransportCode"),
    categoryId: text(data.categoryId, "categoryId"), unitId: text(data.unitId, "unitId"), brandId: text(data.brandId, "brandId"),
    defaultWarehouseId: type === "SERVICE" ? null : text(data.defaultWarehouseId, "defaultWarehouseId"),
    salesAccountId: text(data.salesAccountId, "salesAccountId"), inventoryAccountId: type === "SERVICE" ? null : text(data.inventoryAccountId, "inventoryAccountId"),
    cogsAccountId: text(data.cogsAccountId, "cogsAccountId"), purchaseAccountId: text(data.purchaseAccountId, "purchaseAccountId"),
    price: productNumber(data.price, "price"), price2: productNumber(data.price2, "price2"),
    price3: productNumber(data.price3, "price3"), price4: productNumber(data.price4, "price4"), cost: productNumber(data.cost, "cost"),
    ...tax,
    minStock: data.minStock == null || data.minStock === "" ? null : productNumber(data.minStock, "minStock", true),
    warrantyDuration: data.warrantyDuration == null || data.warrantyDuration === "" ? null : productNumber(data.warrantyDuration, "warrantyDuration", true),
    warrantyUnit: warrantyUnit as "DAYS" | "MONTHS" | "YEARS" | null,
    isActive: flag(data.isActive, true, "isActive"),
    trackInventory: type === "SERVICE" ? false : flag(data.trackInventory, true, "trackInventory"),
    isProcessed: flag(data.isProcessed, false, "isProcessed"),
    color: text(data.color, "color"), additionalComment: text(data.additionalComment, "additionalComment"),
  };
}

export function productPriceCalculation(price: number, cost: number, taxRate: number) {
  const gain = price - cost;
  return { gain, margin: cost > 0 ? gain / cost * 100 : 0, withTax: price * (1 + taxRate / 100) };
}
