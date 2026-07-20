import "@/lib/security/server-only";

import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import {
  createErpnextCustomer,
  getErpnextCustomers,
} from "@/lib/api/erpnext/customers";
import { getErpnextInventoryBin } from "@/lib/api/erpnext/inventory";
import {
  createErpnextItemGroup,
  getErpnextItemGroups,
} from "@/lib/api/erpnext/item-groups";
import { createErpnextItem, getErpnextItems } from "@/lib/api/erpnext/items";
import { createAndSubmitErpnextStockEntry } from "@/lib/api/erpnext/stock-entries";
import {
  createErpnextUom,
  getErpnextUoms,
} from "@/lib/api/erpnext/uoms";
import {
  createErpnextWarehouse,
  getErpnextWarehouses,
} from "@/lib/api/erpnext/warehouses";
import { getPrismaClient } from "@/lib/db/prisma";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import type {
  ErpnextCompany,
  ErpnextItemGroup,
  ErpnextUom,
  ErpnextWarehouse,
} from "@/types/erpnext";

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

export type UpgradeMasterDataSummary = {
  companyName: string | null;
  warehouseName: string | null;
  itemGroupName: string | null;
  uomName: string | null;
  territory: string | null;
};

export type UpgradeFromCoreResult = UpgradeMasterDataSummary & {
  tenantId: string;
  dryRun: boolean;
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
  blockers: string[];
};

type CoreProduct = {
  id: string;
  name: string;
  price: { toString(): string };
  cost: { toString(): string } | null;
  stock: number;
  minStock: number | null;
  barcode: string | null;
  taxRate: { toString(): string };
};

type CoreCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: { toString(): string };
};

type UpgradeMasterDataResolution = UpgradeMasterDataSummary & {
  warnings: string[];
  blockers: string[];
};

function deriveItemCode(product: { id: string; barcode: string | null }): string {
  const cleaned = product.barcode?.trim();
  if (cleaned) return cleaned;
  return `CORE-${product.id.slice(-10).toUpperCase()}`;
}

function normalizeForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

function isActiveUom(uom: ErpnextUom) {
  return uom.enabled !== 0;
}

function isUsableItemGroup(group: ErpnextItemGroup) {
  return group.is_group !== 1 && (group.disabled ?? 0) !== 1;
}

function findCompanyByName(companies: ErpnextCompany[], candidate?: string | null) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);
  return (
    companies.find((company) => normalizeLabel(company.name) === normalized) ??
    companies.find((company) => normalizeLabel(company.company_name) === normalized) ??
    null
  );
}

function findWarehouseForCompany(
  warehouses: ErpnextWarehouse[],
  companyName: string | null
) {
  const active = warehouses.filter((warehouse) => !warehouse.disabled && !warehouse.is_group);

  if (active.length === 0) return null;
  if (!companyName) return active[0] ?? null;

  return (
    active.find((warehouse) => warehouse.company === companyName) ??
    active.find((warehouse) =>
      normalizeLabel(warehouse.name).includes(normalizeLabel(companyName))
    ) ??
    active[0] ??
    null
  );
}

function findItemGroupByCandidate(
  itemGroups: ErpnextItemGroup[],
  candidate?: string | null
) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);

  return (
    itemGroups.find((group) => normalizeLabel(group.name) === normalized) ??
    itemGroups.find((group) => normalizeLabel(group.item_group_name) === normalized) ??
    null
  );
}

function findUomByCandidate(uoms: ErpnextUom[], candidate?: string | null) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);

  return (
    uoms.find((uom) => normalizeLabel(uom.name) === normalized) ??
    uoms.find((uom) => normalizeLabel(uom.uom_name) === normalized) ??
    null
  );
}

function detectRootItemGroup(itemGroups: ErpnextItemGroup[]) {
  return (
    itemGroups.find((group) => normalizeLabel(group.name) === "all item groups") ??
    itemGroups.find((group) => normalizeLabel(group.item_group_name) === "all item groups") ??
    itemGroups.find(
      (group) =>
        group.is_group === 1 &&
        (!group.parent_item_group ||
          normalizeLabel(group.parent_item_group) === normalizeLabel(group.name))
    ) ??
    itemGroups.find((group) => group.is_group === 1) ??
    null
  );
}

function formatMissingItemGroupMessage() {
  return "No se puede migrar productos porque no se encontró un Item Group válido en ERPNext. Configura o crea un grupo de productos y vuelve a ejecutar.";
}

function formatMissingUomMessage() {
  return "No se puede migrar productos porque no se encontró una Unidad de Medida válida en ERPNext.";
}

function formatMissingCompanyMessage() {
  return "No se pudo resolver una compañía ERPNext válida para este tenant.";
}

function isLikelyMasterDataFailure(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("linkvalidationerror") ||
    message.includes("grupo de productos") ||
    message.includes("item group") ||
    message.includes("unidad de medida") ||
    message.includes("uom")
  );
}

function formatProductFailureMessage(error: unknown) {
  if (!(error instanceof Error)) return "Error desconocido";
  if (isLikelyMasterDataFailure(error)) {
    return "faltan datos maestros ERPNext: Item Group / UOM";
  }

  return error.message;
}

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
  for (const product of products) {
    const barcode = product.barcode?.trim();
    if (barcode) barcodeCounts.set(barcode, (barcodeCounts.get(barcode) ?? 0) + 1);
  }
  const duplicateBarcodes = Array.from(barcodeCounts.values()).filter((count) => count > 1).length;

  const activationBlockers: string[] = [];
  if (productsWithNegativeStock > 0) {
    activationBlockers.push(`${productsWithNegativeStock} productos con stock negativo`);
  }
  if (productsWithNoPositivePrice > 0) {
    activationBlockers.push(`${productsWithNoPositivePrice} productos con precio no positivo`);
  }
  if (duplicateBarcodes > 0) {
    activationBlockers.push(`${duplicateBarcodes} códigos de barras duplicados`);
  }

  if (productsWithoutBarcode > 0) {
    warnings.push(
      `${productsWithoutBarcode} productos sin código de barras — se les asignará un código CORE interno`
    );
  }
  if (customersWithoutContact > 0) {
    warnings.push(`${customersWithoutContact} clientes sin teléfono ni email`);
  }
  if (customers.length > 0) {
    warnings.push(
      `${customers.length} clientes sin identificación fiscal — deberá complementarse en ERPNext`
    );
  }

  return {
    products: products as CoreProduct[],
    customers: customers as CoreCustomer[],
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

async function resolveCompanyName(
  tenantId: string,
  requestedCompany?: string | null
) {
  const [companies, integration] = await Promise.all([
    getErpnextCompanies(),
    getTenantIntegrationByProvider(tenantId, "erpnext").catch(() => null),
  ]);

  const candidates = uniqueStrings([
    requestedCompany,
    integration?.externalCompanyId,
  ]);

  for (const candidate of candidates) {
    const matched = findCompanyByName(companies, candidate);
    if (matched) return { companies, companyName: matched.name };
  }

  if (companies.length === 1) {
    return { companies, companyName: companies[0].name };
  }

  return { companies, companyName: null };
}

async function resolveWarehouseName(
  companyName: string | null,
  allowWrites: boolean
) {
  const warehouses = await getErpnextWarehouses();
  const matched = findWarehouseForCompany(warehouses, companyName);

  if (matched) {
    return {
      warehouseName: matched.name,
      warnings: [] as string[],
      blockers: [] as string[],
    };
  }

  if (!companyName) {
    return {
      warehouseName: null,
      warnings: [] as string[],
      blockers: ["No se pudo resolver una bodega válida porque falta una compañía ERPNext válida."],
    };
  }

  if (!allowWrites) {
    return {
      warehouseName: "Bodega principal",
      warnings: [
        `No existe una bodega activa para ${companyName}. En migración real se intentará crear "Bodega principal".`,
      ],
      blockers: [] as string[],
    };
  }

  try {
    const created = await createErpnextWarehouse({
      warehouse_name: "Bodega principal",
      company: companyName,
    });

    return {
      warehouseName: created.name,
      warnings: [
        `No existía una bodega activa para ${companyName}; se creó "Bodega principal".`,
      ],
      blockers: [] as string[],
    };
  } catch (error) {
    return {
      warehouseName: null,
      warnings: [] as string[],
      blockers: [
        error instanceof Error
          ? `No se pudo resolver ni crear una bodega válida para ${companyName}: ${error.message}`
          : `No se pudo resolver ni crear una bodega válida para ${companyName}.`,
      ],
    };
  }
}

async function resolveItemGroupName(
  preferredItemGroup: string | null | undefined,
  allowWrites: boolean
) {
  const itemGroups = await getErpnextItemGroups();
  const usableGroups = itemGroups.filter(isUsableItemGroup);
  const preferredCandidates = uniqueStrings([
    preferredItemGroup,
    "Productos",
    "Products",
  ]);

  for (const candidate of preferredCandidates) {
    const matched = findItemGroupByCandidate(usableGroups, candidate);
    if (matched) {
      return {
        itemGroupName: matched.name,
        warnings: [] as string[],
        blockers: [] as string[],
      };
    }
  }

  if (usableGroups.length > 0) {
    return {
      itemGroupName: usableGroups[0].name,
      warnings: [] as string[],
      blockers: [] as string[],
    };
  }

  const existingProductos = findItemGroupByCandidate(itemGroups, "Productos");
  if (existingProductos && isUsableItemGroup(existingProductos)) {
    return {
      itemGroupName: existingProductos.name,
      warnings: [] as string[],
      blockers: [] as string[],
    };
  }

  const rootGroup = detectRootItemGroup(itemGroups);
  if (!rootGroup) {
    return {
      itemGroupName: null,
      warnings: [] as string[],
      blockers: [formatMissingItemGroupMessage()],
    };
  }

  if (!allowWrites) {
    return {
      itemGroupName: "Productos",
      warnings: [
        `No existe un Item Group usable; en migración real se intentará crear "Productos" bajo ${rootGroup.name}.`,
      ],
      blockers: [] as string[],
    };
  }

  try {
    const created = await createErpnextItemGroup({
      item_group_name: "Productos",
      parent_item_group: rootGroup.name,
      is_group: false,
    });

    return {
      itemGroupName: created.name,
      warnings: [
        `No existía un Item Group usable; se creó "Productos" bajo ${rootGroup.name}.`,
      ],
      blockers: [] as string[],
    };
  } catch (error) {
    return {
      itemGroupName: null,
      warnings: [] as string[],
      blockers: [
        error instanceof Error
          ? `${formatMissingItemGroupMessage()} ${error.message}`
          : formatMissingItemGroupMessage(),
      ],
    };
  }
}

async function resolveUomName(
  preferredUom: string | null | undefined,
  allowWrites: boolean
) {
  const uoms = await getErpnextUoms();
  const activeUoms = uoms.filter(isActiveUom);
  const preferredCandidates = uniqueStrings([
    preferredUom,
    "Unidad",
    "Unit",
    "Nos",
  ]);

  for (const candidate of preferredCandidates) {
    const matched = findUomByCandidate(activeUoms, candidate);
    if (matched) {
      return {
        uomName: matched.name,
        warnings: [] as string[],
        blockers: [] as string[],
      };
    }
  }

  if (activeUoms.length > 0) {
    return {
      uomName: activeUoms[0].name,
      warnings: [] as string[],
      blockers: [] as string[],
    };
  }

  if (!allowWrites) {
    return {
      uomName: "Unidad",
      warnings: [
        'No existe una UOM activa usable; en migración real se intentará crear "Unidad".',
      ],
      blockers: [] as string[],
    };
  }

  try {
    const created = await createErpnextUom({ uom_name: "Unidad" });
    return {
      uomName: created.name,
      warnings: ['No existía una UOM activa usable; se creó "Unidad".'],
      blockers: [] as string[],
    };
  } catch (error) {
    return {
      uomName: null,
      warnings: [] as string[],
      blockers: [
        error instanceof Error
          ? `${formatMissingUomMessage()} ${error.message}`
          : formatMissingUomMessage(),
      ],
    };
  }
}

async function resolveUpgradeMasterData(
  tenantId: string,
  options: {
    dryRun: boolean;
    companyName?: string;
    defaultItemGroup?: string;
    defaultUom?: string;
    territory?: string;
  }
): Promise<UpgradeMasterDataResolution> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const { companyName } = await resolveCompanyName(tenantId, options.companyName);
  if (!companyName) blockers.push(formatMissingCompanyMessage());

  const warehouseResult = await resolveWarehouseName(companyName, !options.dryRun);
  warnings.push(...warehouseResult.warnings);
  blockers.push(...warehouseResult.blockers);

  const itemGroupResult = await resolveItemGroupName(
    options.defaultItemGroup,
    !options.dryRun
  );
  warnings.push(...itemGroupResult.warnings);
  blockers.push(...itemGroupResult.blockers);

  const uomResult = await resolveUomName(options.defaultUom, !options.dryRun);
  warnings.push(...uomResult.warnings);
  blockers.push(...uomResult.blockers);

  return {
    companyName,
    warehouseName: warehouseResult.warehouseName,
    itemGroupName: itemGroupResult.itemGroupName,
    uomName: uomResult.uomName,
    territory: options.territory ?? "All Territories",
    warnings,
    blockers: uniqueStrings(blockers),
  };
}

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
  const territory = options.territory ?? "All Territories";
  const analysis = await analyzeCoreData(tenantId);
  const masterData = await resolveUpgradeMasterData(tenantId, {
    dryRun,
    companyName: options.companyName,
    defaultItemGroup: options.defaultItemGroup,
    defaultUom: options.defaultUom,
    territory,
  });

  const warnings = uniqueStrings([...analysis.warnings, ...masterData.warnings]);
  const blockers = uniqueStrings([
    ...analysis.activationBlockers,
    ...masterData.blockers,
  ]);

  const productResults: UpgradeProductResult[] = [];
  const customerResults: UpgradeCustomerResult[] = [];

  const [existingItems, existingCustomers] = await Promise.all([
    safeGetErpnextItems(),
    safeGetErpnextCustomers(),
  ]);
  const existingItemCodeMap = new Map(existingItems.map((item) => [item.item_code, item]));
  const existingCustomerMap = new Map(
    existingCustomers.map((customer) => [normalizeForMatch(customer.customer_name), customer])
  );

  for (const product of analysis.products) {
    const itemCode = deriveItemCode(product);
    const exists = existingItemCodeMap.has(itemCode);

    productResults.push({
      productId: product.id,
      productName: product.name,
      itemCode,
      action: exists ? "found" : "created",
      stockMigrated: !exists && product.stock > 0,
    });
  }

  for (const customer of analysis.customers) {
    const exists = existingCustomerMap.has(normalizeForMatch(customer.name));
    customerResults.push({
      customerId: customer.id,
      customerName: customer.name,
      action: exists ? "found" : "created",
    });
  }

  if (dryRun || blockers.length > 0) {
    return buildResult({
      tenantId,
      dryRun,
      companyName: masterData.companyName,
      warehouseName: masterData.warehouseName,
      itemGroupName: masterData.itemGroupName,
      uomName: masterData.uomName,
      territory: masterData.territory,
      products: productResults,
      customers: customerResults,
      stockEntriesCreated: productResults.filter((item) => item.stockMigrated).length,
      warnings,
      blockers,
    });
  }

  const itemGroupName = masterData.itemGroupName;
  const uomName = masterData.uomName;
  const warehouseName = masterData.warehouseName;

  if (!itemGroupName) {
    return buildResult({
      tenantId,
      dryRun,
      companyName: masterData.companyName,
      warehouseName,
      itemGroupName,
      uomName,
      territory: masterData.territory,
      products: [],
      customers: [],
      stockEntriesCreated: 0,
      warnings,
      blockers: [formatMissingItemGroupMessage()],
    });
  }

  if (!uomName) {
    return buildResult({
      tenantId,
      dryRun,
      companyName: masterData.companyName,
      warehouseName,
      itemGroupName,
      uomName,
      territory: masterData.territory,
      products: [],
      customers: [],
      stockEntriesCreated: 0,
      warnings,
      blockers: [formatMissingUomMessage()],
    });
  }

  const realProductResults: UpgradeProductResult[] = [];
  const realCustomerResults: UpgradeCustomerResult[] = [];
  let stockEntriesCreated = 0;

  for (const product of analysis.products) {
    const itemCode = deriveItemCode(product);
    const existing = existingItemCodeMap.get(itemCode);

    if (existing) {
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

      realProductResults.push({
        productId: product.id,
        productName: product.name,
        itemCode,
        action: "found",
        stockMigrated,
      });

      await safeUpsertErpProductPricing(prisma, tenantId, itemCode, product);
      continue;
    }

    try {
      await createErpnextItem({
        item_code: itemCode,
        item_name: product.name,
        stock_uom: uomName,
        item_group: itemGroupName,
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

      realProductResults.push({
        productId: product.id,
        productName: product.name,
        itemCode,
        action: "created",
        stockMigrated,
      });
    } catch (error) {
      realProductResults.push({
        productId: product.id,
        productName: product.name,
        itemCode,
        action: "failed",
        stockMigrated: false,
        error: formatProductFailureMessage(error),
      });
    }
  }

  for (const customer of analysis.customers) {
    const normalizedName = normalizeForMatch(customer.name);
    const existing = existingCustomerMap.get(normalizedName);

    if (existing) {
      realCustomerResults.push({
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

      realCustomerResults.push({
        customerId: customer.id,
        customerName: customer.name,
        erpCustomerName: created.name,
        action: "created",
      });
    } catch (error) {
      realCustomerResults.push({
        customerId: customer.id,
        customerName: customer.name,
        action: "failed",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return buildResult({
    tenantId,
    dryRun,
    companyName: masterData.companyName,
    warehouseName,
    itemGroupName,
    uomName,
    territory: masterData.territory,
    products: realProductResults,
    customers: realCustomerResults,
    stockEntriesCreated,
    warnings,
    blockers: [],
  });
}

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
    // Non-critical — pricing can be set manually.
  }
}

function buildResult(input: {
  tenantId: string;
  dryRun: boolean;
  companyName: string | null;
  warehouseName: string | null;
  itemGroupName: string | null;
  uomName: string | null;
  territory: string | null;
  products: UpgradeProductResult[];
  customers: UpgradeCustomerResult[];
  stockEntriesCreated: number;
  warnings: string[];
  blockers: string[];
}): UpgradeFromCoreResult {
  return {
    tenantId: input.tenantId,
    dryRun: input.dryRun,
    companyName: input.companyName,
    warehouseName: input.warehouseName,
    itemGroupName: input.itemGroupName,
    uomName: input.uomName,
    territory: input.territory,
    products: input.products,
    customers: input.customers,
    productsCreated: input.products.filter((product) => product.action === "created").length,
    productsFound: input.products.filter((product) => product.action === "found").length,
    productsFailed: input.products.filter((product) => product.action === "failed").length,
    customersCreated: input.customers.filter((customer) => customer.action === "created").length,
    customersFound: input.customers.filter((customer) => customer.action === "found").length,
    customersFailed: input.customers.filter((customer) => customer.action === "failed").length,
    stockEntriesCreated: input.stockEntriesCreated,
    warnings: input.warnings,
    blockers: input.blockers,
  };
}
