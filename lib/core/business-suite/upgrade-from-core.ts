import "@/lib/security/server-only";

import { createErpnextCustomer, getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextInventoryBin } from "@/lib/api/erpnext/inventory";
import { createErpnextItem, getErpnextItems } from "@/lib/api/erpnext/items";
import { createAndSubmitErpnextStockEntry } from "@/lib/api/erpnext/stock-entries";
import { createErpnextWarehouse, getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getPrismaClient } from "@/lib/db/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UpgradeProductAction = "created" | "found" | "skipped" | "failed";
export type UpgradeCustomerAction = "created" | "found" | "skipped" | "failed";

export type UpgradeProductResult = {
  productId: string;
  productName: string;
  itemCode: string;
  action: UpgradeProductAction;
  stockMigrated: boolean;
  error?: string;
};

export type UpgradeCustomerResult = {
  customerId: string;
  customerName: string;
  erpCustomerName?: string;
  action: UpgradeCustomerAction;
  error?: string;
};

export type UpgradeFromCoreResult = {
  tenantId: string;
  dryRun: boolean;
  warehouseName: string | null;
  companyName: string | null;
  products: UpgradeProductResult[];
  customers: UpgradeCustomerResult[];
  productsCreated: number;
  productsFound: number;
  productsFailed: number;
  customersCreated: number;
  customersFound: number;
  customersFailed: number;
  stockEntriesCreated: number;
  warnings: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveItemCode(product: { id: string; barcode: string | null }): string {
  const cleaned = product.barcode?.trim();
  if (cleaned) return cleaned;
  return `CORE-${product.id.slice(-10).toUpperCase()}`;
}

function normalizeForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Core analysis (no ERPNext calls) ──────────────────────────────────────────

export async function analyzeCoreData(tenantId: string) {
  const prisma = getPrismaClient();
  const [products, customers, sales, sriDocuments] = await Promise.all([
    prisma.lightweightProduct.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        price: true,
        cost: true,
        stock: true,
        minStock: true,
        barcode: true,
        taxRate: true,
      },
    }),
    prisma.lightweightCustomer.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        balance: true,
      },
    }),
    prisma.lightweightSale.count({ where: { tenantId, status: { not: "canceled" } } }),
    prisma.sriDocument.count({ where: { tenantId } }),
  ]);

  const warnings: string[] = [];

  const productsWithoutBarcode = products.filter((p) => !p.barcode?.trim()).length;
  const productsWithNegativeStock = products.filter((p) => p.stock < 0).length;
  const productsWithNoPositivePrice = products.filter((p) => Number(p.price) <= 0).length;
  const customersWithoutContact = customers.filter(
    (c) => !c.phone?.trim() && !c.email?.trim()
  ).length;

  const barcodeCounts = new Map<string, number>();
  for (const p of products) {
    const b = p.barcode?.trim();
    if (b) barcodeCounts.set(b, (barcodeCounts.get(b) ?? 0) + 1);
  }
  const duplicateBarcodes = Array.from(barcodeCounts.values()).filter((c) => c > 1).length;

  const activationBlockers: string[] = [];
  if (productsWithNegativeStock > 0)
    activationBlockers.push(`${productsWithNegativeStock} productos con stock negativo`);
  if (productsWithNoPositivePrice > 0)
    activationBlockers.push(`${productsWithNoPositivePrice} productos con precio no positivo`);
  if (duplicateBarcodes > 0)
    activationBlockers.push(`${duplicateBarcodes} códigos de barras duplicados`);

  if (productsWithoutBarcode > 0)
    warnings.push(`${productsWithoutBarcode} productos sin código de barras — se les asignará un código CORE interno`);
  if (customersWithoutContact > 0)
    warnings.push(`${customersWithoutContact} clientes sin teléfono ni email`);
  if (customers.length > 0)
    warnings.push(`${customers.length} clientes sin identificación fiscal — deberá complementarse en ERPNext`);

  return {
    products,
    customers,
    sales,
    sriDocuments,
    productsWithoutBarcode,
    productsWithNegativeStock,
    productsWithNoPositivePrice,
    customersWithoutContact,
    duplicateBarcodes,
    activationBlockers,
    warnings,
    hasBlockers: activationBlockers.length > 0,
  };
}

// ── Warehouse resolution ───────────────────────────────────────────────────────

async function resolveDefaultWarehouse(companyName: string | null): Promise<string | null> {
  try {
    const warehouses = await getErpnextWarehouses();
    const active = warehouses.filter((w) => !w.disabled && !w.is_group);

    if (active.length === 0) {
      if (!companyName) return null;
      // Create default warehouse for the company
      const created = await createErpnextWarehouse({
        warehouse_name: "Bodega principal",
        company: companyName,
      });
      return created.name;
    }

    // Prefer a warehouse associated with this company
    if (companyName) {
      const preferred = active.find((w) =>
        w.name.toLowerCase().includes(companyName.toLowerCase())
      );
      if (preferred) return preferred.name;
    }

    return active[0].name;
  } catch {
    return null;
  }
}

// ── Execute migration ─────────────────────────────────────────────────────────

export async function executeUpgradeFromCore(
  tenantId: string,
  options: {
    dryRun?: boolean;
    companyName?: string;
    defaultItemGroup?: string;
    defaultUom?: string;
    territory?: string;
  } = {}
): Promise<UpgradeFromCoreResult> {
  const prisma = getPrismaClient();
  const dryRun = options.dryRun !== false;
  const itemGroup = options.defaultItemGroup ?? "All Item Groups";
  const uom = options.defaultUom ?? "Nos";
  const territory = options.territory ?? "All Territories";
  const companyName = options.companyName ?? null;

  // ── Analyze CORE data ──
  const analysis = await analyzeCoreData(tenantId);

  const warnings = [...analysis.warnings];
  const productResults: UpgradeProductResult[] = [];
  const customerResults: UpgradeCustomerResult[] = [];
  let stockEntriesCreated = 0;
  let warehouseName: string | null = null;

  if (dryRun) {
    // Dry run: categorize what would happen
    const existingItems = await safeGetErpnextItems();
    const existingItemCodes = new Set(existingItems.map((i) => i.item_code));
    const existingCustomers = await safeGetErpnextCustomers();
    const existingCustomerNames = new Set(
      existingCustomers.map((c) => normalizeForMatch(c.customer_name))
    );

    for (const product of analysis.products) {
      const itemCode = deriveItemCode(product);
      const exists = existingItemCodes.has(itemCode);
      productResults.push({
        productId: product.id,
        productName: product.name,
        itemCode,
        action: exists ? "found" : "created",
        stockMigrated: !exists && product.stock > 0,
      });
    }

    for (const customer of analysis.customers) {
      const exists = existingCustomerNames.has(normalizeForMatch(customer.name));
      customerResults.push({
        customerId: customer.id,
        customerName: customer.name,
        action: exists ? "found" : "created",
      });
    }

    stockEntriesCreated = productResults.filter((p) => p.stockMigrated).length;

    return buildResult({
      tenantId,
      dryRun,
      warehouseName: null,
      companyName,
      products: productResults,
      customers: customerResults,
      stockEntriesCreated,
      warnings,
    });
  }

  // ── Real migration ──

  // Resolve warehouse
  warehouseName = await resolveDefaultWarehouse(companyName);
  if (!warehouseName) {
    warnings.push("No se pudo resolver la bodega por defecto — stock no migrado");
  }

  // Load existing ERPNext items for idempotence
  const existingItems = await safeGetErpnextItems();
  const existingItemCodeMap = new Map(existingItems.map((i) => [i.item_code, i]));

  // Load existing ERPNext customers for idempotence
  const existingCustomers = await safeGetErpnextCustomers();
  const existingCustomerMap = new Map(
    existingCustomers.map((c) => [normalizeForMatch(c.customer_name), c])
  );

  // ── Products ──
  for (const product of analysis.products) {
    const itemCode = deriveItemCode(product);
    const existing = existingItemCodeMap.get(itemCode);

    if (existing) {
      // Already in ERPNext — check stock
      let stockMigrated = false;
      if (warehouseName && product.stock > 0) {
        stockMigrated = await maybeCreateStockEntry(
          itemCode,
          warehouseName,
          product.stock,
          Number(product.cost ?? product.price)
        );
        if (stockMigrated) stockEntriesCreated++;
      }

      productResults.push({
        productId: product.id,
        productName: product.name,
        itemCode,
        action: "found",
        stockMigrated,
      });

      // Upsert price mapping
      await safeUpsertErpProductPricing(prisma, tenantId, itemCode, product);
      continue;
    }

    // Create Item in ERPNext
    try {
      await createErpnextItem({
        item_code: itemCode,
        item_name: product.name,
        stock_uom: uom,
        item_group: itemGroup,
        is_stock_item: true,
      });

      let stockMigrated = false;
      if (warehouseName && product.stock > 0) {
        stockMigrated = await maybeCreateStockEntry(
          itemCode,
          warehouseName,
          product.stock,
          Number(product.cost ?? product.price)
        );
        if (stockMigrated) stockEntriesCreated++;
      }

      await safeUpsertErpProductPricing(prisma, tenantId, itemCode, product);

      productResults.push({
        productId: product.id,
        productName: product.name,
        itemCode,
        action: "created",
        stockMigrated,
      });
    } catch (err) {
      productResults.push({
        productId: product.id,
        productName: product.name,
        itemCode,
        action: "failed",
        stockMigrated: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  // ── Customers ──
  for (const customer of analysis.customers) {
    const normalizedName = normalizeForMatch(customer.name);
    const existing = existingCustomerMap.get(normalizedName);

    if (existing) {
      customerResults.push({
        customerId: customer.id,
        customerName: customer.name,
        erpCustomerName: existing.name,
        action: "found",
      });
      continue;
    }

    try {
      const created = await createErpnextCustomer({
        customer_name: customer.name.trim(),
        customer_type: "Individual",
        territory,
        mobile_no: customer.phone?.trim() || undefined,
      });

      customerResults.push({
        customerId: customer.id,
        customerName: customer.name,
        erpCustomerName: created.name,
        action: "created",
      });
    } catch (err) {
      customerResults.push({
        customerId: customer.id,
        customerName: customer.name,
        action: "failed",
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  return buildResult({
    tenantId,
    dryRun,
    warehouseName,
    companyName,
    products: productResults,
    customers: customerResults,
    stockEntriesCreated,
    warnings,
  });
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function safeGetErpnextItems() {
  try {
    return await getErpnextItems();
  } catch {
    return [];
  }
}

async function safeGetErpnextCustomers() {
  try {
    return await getErpnextCustomers();
  } catch {
    return [];
  }
}

async function maybeCreateStockEntry(
  itemCode: string,
  warehouse: string,
  desiredQty: number,
  basicRate: number
): Promise<boolean> {
  try {
    const bin = await getErpnextInventoryBin(itemCode, warehouse);
    const currentQty = bin?.actual_qty ?? 0;
    const delta = desiredQty - currentQty;
    if (delta <= 0) return false;

    await createAndSubmitErpnextStockEntry({
      item_code: itemCode,
      warehouse,
      qty: delta,
      basic_rate: basicRate > 0 ? basicRate : 0,
    });
    return true;
  } catch {
    return false;
  }
}

async function safeUpsertErpProductPricing(
  prisma: ReturnType<typeof getPrismaClient>,
  tenantId: string,
  itemCode: string,
  product: {
    name: string;
    price: { toString(): string };
    cost?: { toString(): string } | null;
  }
) {
  try {
    await prisma.erpProductPricing.upsert({
      where: { tenantId_itemCode: { tenantId, itemCode } },
      create: {
        tenantId,
        itemCode,
        itemName: product.name,
        retailPrice: Number(product.price.toString()),
      },
      update: {
        itemName: product.name,
        retailPrice: Number(product.price.toString()),
      },
    });
  } catch {
    // Non-critical — pricing can be set manually
  }
}

function buildResult(input: {
  tenantId: string;
  dryRun: boolean;
  warehouseName: string | null;
  companyName: string | null;
  products: UpgradeProductResult[];
  customers: UpgradeCustomerResult[];
  stockEntriesCreated: number;
  warnings: string[];
}): UpgradeFromCoreResult {
  return {
    tenantId: input.tenantId,
    dryRun: input.dryRun,
    warehouseName: input.warehouseName,
    companyName: input.companyName,
    products: input.products,
    customers: input.customers,
    productsCreated: input.products.filter((p) => p.action === "created").length,
    productsFound: input.products.filter((p) => p.action === "found").length,
    productsFailed: input.products.filter((p) => p.action === "failed").length,
    customersCreated: input.customers.filter((c) => c.action === "created").length,
    customersFound: input.customers.filter((c) => c.action === "found").length,
    customersFailed: input.customers.filter((c) => c.action === "failed").length,
    stockEntriesCreated: input.stockEntriesCreated,
    warnings: input.warnings,
  };
}
