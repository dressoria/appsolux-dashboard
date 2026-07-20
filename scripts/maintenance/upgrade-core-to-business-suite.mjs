/**
 * Migrar datos de Básico/Core hacia Gestión Empresarial (ERPNext).
 *
 * Dry-run por defecto. Para ejecutar de verdad usar CONFIRM_CORE_TO_BUSINESS_UPGRADE=true.
 *
 * Uso:
 *   TENANT_SLUG=bionvers-admin npm run maintenance:upgrade-core-to-business-suite
 *
 * Con confirmación real:
 *   TENANT_SLUG=bionvers-admin CONFIRM_CORE_TO_BUSINESS_UPGRADE=true npm run maintenance:upgrade-core-to-business-suite
 *
 * Variables de entorno opcionales:
 *   ERPNEXT_BASE_URL    URL base del ERPNext (se toma de .env si no se pasa)
 *   ERPNEXT_API_KEY     API key de ERPNext
 *   ERPNEXT_API_SECRET  API secret de ERPNext
 *   ERPNEXT_COMPANY     Nombre de la compañía en ERPNext
 *   ERPNEXT_ITEM_GROUP  Grupo de items preferido
 *   ERPNEXT_UOM         Unidad de medida preferida
 *   ERPNEXT_TERRITORY   Territorio de cliente (default: "All Territories")
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  const envContent = readFileSync(envLocalPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const prisma = new PrismaClient();

const tenantSlug = process.env.TENANT_SLUG?.trim();
const dryRun = process.env.CONFIRM_CORE_TO_BUSINESS_UPGRADE !== "true";
const erpBaseUrl = process.env.ERPNEXT_BASE_URL?.replace(/\/$/, "");
const erpApiKey = process.env.ERPNEXT_API_KEY;
const erpApiSecret = process.env.ERPNEXT_API_SECRET;
const preferredCompany = process.env.ERPNEXT_COMPANY?.trim();
const preferredItemGroup = process.env.ERPNEXT_ITEM_GROUP?.trim();
const preferredUom = process.env.ERPNEXT_UOM?.trim();
const territory = process.env.ERPNEXT_TERRITORY?.trim() || "All Territories";

function normalizeLabel(value) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeForMatch(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function deriveItemCode(product) {
  const cleaned = product.barcode?.trim();
  if (cleaned) return cleaned;
  return `CORE-${product.id.slice(-10).toUpperCase()}`;
}

function uniqueStrings(values) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean))
  );
}

function fail(msg) {
  console.error(`[upgrade-core] ${msg}`);
  process.exitCode = 1;
}

function erpHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${erpApiKey}:${erpApiSecret}`,
  };
}

async function erpFetch(path, options = {}) {
  const url = `${erpBaseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...erpHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ERPNext ${res.status}: ${body.slice(0, 400)}`);
  }

  const text = await res.text().catch(() => "");
  return text ? JSON.parse(text) : {};
}

async function getErpItems() {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "item_code", "item_name"]),
      limit_page_length: "500",
    });
    const res = await erpFetch(`/api/resource/Item?${params}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

async function getErpCustomers() {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "customer_name"]),
      limit_page_length: "500",
    });
    const res = await erpFetch(`/api/resource/Customer?${params}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

async function getErpCompanies() {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "company_name"]),
      limit_page_length: "100",
      order_by: "name asc",
    });
    const res = await erpFetch(`/api/resource/Company?${params}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

async function getErpWarehouses() {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "warehouse_name", "company", "disabled", "is_group"]),
      limit_page_length: "200",
    });
    const res = await erpFetch(`/api/resource/Warehouse?${params}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

async function getErpItemGroups() {
  const fieldsWithDisabled = ["name", "item_group_name", "parent_item_group", "is_group", "disabled"];
  const fallbackFields = ["name", "item_group_name", "parent_item_group", "is_group"];

  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(fieldsWithDisabled),
      limit_page_length: "500",
      order_by: "name asc",
    });
    const res = await erpFetch(`/api/resource/Item%20Group?${params}`);
    return res.data ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("disabled")) return [];

    console.warn("[erpnext] Item Group disabled field not allowed; retrying without disabled");
    const params = new URLSearchParams({
      fields: JSON.stringify(fallbackFields),
      limit_page_length: "500",
      order_by: "name asc",
    });
    const res = await erpFetch(`/api/resource/Item%20Group?${params}`);
    return res.data ?? [];
  }
}

async function getErpUoms() {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "uom_name", "enabled"]),
      limit_page_length: "500",
      order_by: "name asc",
    });
    const res = await erpFetch(`/api/resource/UOM?${params}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

async function createErpWarehouse(companyName) {
  const res = await erpFetch("/api/resource/Warehouse", {
    method: "POST",
    body: JSON.stringify({
      warehouse_name: "Bodega principal",
      company: companyName,
      is_group: 0,
    }),
  });
  return res.data ?? null;
}

async function createErpItemGroup(parentItemGroup) {
  const res = await erpFetch("/api/resource/Item%20Group", {
    method: "POST",
    body: JSON.stringify({
      item_group_name: "Productos",
      parent_item_group: parentItemGroup,
      is_group: 0,
    }),
  });
  return res.data ?? null;
}

async function createErpUom() {
  const res = await erpFetch("/api/resource/UOM", {
    method: "POST",
    body: JSON.stringify({
      uom_name: "Unidad",
      enabled: 1,
    }),
  });
  return res.data ?? null;
}

async function createErpItem(itemCode, itemName, itemGroup, uomName) {
  return erpFetch("/api/resource/Item", {
    method: "POST",
    body: JSON.stringify({
      item_code: itemCode,
      item_name: itemName,
      stock_uom: uomName,
      item_group: itemGroup,
      is_stock_item: 1,
    }),
  });
}

async function createErpCustomer(customerName, phone) {
  return erpFetch("/api/resource/Customer", {
    method: "POST",
    body: JSON.stringify({
      customer_name: customerName,
      customer_type: "Individual",
      territory,
      mobile_no: phone || undefined,
    }),
  });
}

async function getErpBin(itemCode, warehouse) {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "item_code", "warehouse", "actual_qty"]),
      filters: JSON.stringify([
        ["item_code", "=", itemCode],
        ["warehouse", "=", warehouse],
      ]),
      limit_page_length: "1",
    });
    const res = await erpFetch(`/api/resource/Bin?${params}`);
    return res.data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function createAndSubmitStockEntry(itemCode, warehouse, qty, basicRate) {
  const draft = await erpFetch("/api/resource/Stock%20Entry", {
    method: "POST",
    body: JSON.stringify({
      stock_entry_type: "Material Receipt",
      purpose: "Material Receipt",
      remarks: "Migración desde Básico — stock inicial",
      items: [
        {
          item_code: itemCode,
          t_warehouse: warehouse,
          qty,
          basic_rate: basicRate > 0 ? basicRate : 0,
        },
      ],
    }),
  });

  const entryName = draft.data?.name;
  if (!entryName) return null;

  const full = await erpFetch(`/api/resource/Stock%20Entry/${encodeURIComponent(entryName)}`);
  await erpFetch("/api/method/frappe.client.submit", {
    method: "POST",
    body: JSON.stringify({ doc: { ...full.data, doctype: "Stock Entry" } }),
  });
  return entryName;
}

async function upsertErpProductPricing(tenantId, itemCode, itemName, retailPrice) {
  try {
    await prisma.erpProductPricing.upsert({
      where: { tenantId_itemCode: { tenantId, itemCode } },
      create: { tenantId, itemCode, itemName, retailPrice },
      update: { itemName, retailPrice },
    });
  } catch {
    // Non-critical.
  }
}

function findCompanyByCandidate(companies, candidate) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);
  return (
    companies.find((company) => normalizeLabel(company.name) === normalized) ??
    companies.find((company) => normalizeLabel(company.company_name) === normalized) ??
    null
  );
}

function resolveCompany(companies, integration, requestedCompany) {
  const candidates = uniqueStrings([
    requestedCompany,
    integration?.externalCompanyId,
  ]);

  for (const candidate of candidates) {
    const matched = findCompanyByCandidate(companies, candidate);
    if (matched) return matched.name;
  }

  if (companies.length === 1) return companies[0].name;
  return null;
}

function resolveExistingWarehouse(warehouses, companyName) {
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

function isUsableItemGroup(group) {
  return group.is_group !== 1 && (group.disabled ?? 0) !== 1;
}

function findItemGroupByCandidate(itemGroups, candidate) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);
  return (
    itemGroups.find((group) => normalizeLabel(group.name) === normalized) ??
    itemGroups.find((group) => normalizeLabel(group.item_group_name) === normalized) ??
    null
  );
}

function detectRootItemGroup(itemGroups) {
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

function findUomByCandidate(uoms, candidate) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);
  return (
    uoms.find((uom) => normalizeLabel(uom.name) === normalized) ??
    uoms.find((uom) => normalizeLabel(uom.uom_name) === normalized) ??
    null
  );
}

function formatMissingItemGroupMessage() {
  return "No se encontró Item Group válido.";
}

function formatMissingUomMessage() {
  return "No se encontró UOM válida.";
}

async function resolveMasterData(tenantId, allowWrites) {
  const warnings = [];
  const blockers = [];
  const [integration, companies, warehouses, itemGroups, uoms] = await Promise.all([
    prisma.tenantIntegration.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: "erpnext",
        },
      },
    }).catch(() => null),
    getErpCompanies(),
    getErpWarehouses(),
    getErpItemGroups(),
    getErpUoms(),
  ]);

  const companyName = resolveCompany(companies, integration, preferredCompany);
  if (!companyName) {
    blockers.push("No se pudo resolver una compañía ERPNext válida para este tenant.");
  }

  let warehouseName = null;
  const existingWarehouse = resolveExistingWarehouse(warehouses, companyName);
  if (existingWarehouse) {
    warehouseName = existingWarehouse.name;
  } else if (!companyName) {
    blockers.push("No se pudo resolver una bodega válida porque falta una compañía ERPNext válida.");
  } else if (!allowWrites) {
    warehouseName = "Bodega principal";
    warnings.push(`No existe una bodega activa para ${companyName}. En migración real se intentará crear "Bodega principal".`);
  } else {
    try {
      const createdWarehouse = await createErpWarehouse(companyName);
      warehouseName = createdWarehouse?.name ?? "Bodega principal";
      warnings.push(`No existía una bodega activa para ${companyName}; se creó "Bodega principal".`);
    } catch (error) {
      blockers.push(
        error instanceof Error
          ? `No se pudo resolver ni crear una bodega válida para ${companyName}: ${error.message}`
          : `No se pudo resolver ni crear una bodega válida para ${companyName}.`
      );
    }
  }

  let itemGroupName = null;
  const usableItemGroups = itemGroups.filter(isUsableItemGroup);
  const preferredGroupCandidates = uniqueStrings([preferredItemGroup, "Productos", "Products"]);
  for (const candidate of preferredGroupCandidates) {
    const matched = findItemGroupByCandidate(usableItemGroups, candidate);
    if (matched) {
      itemGroupName = matched.name;
      break;
    }
  }

  if (!itemGroupName && usableItemGroups.length > 0) {
    itemGroupName = usableItemGroups[0].name;
  }

  if (!itemGroupName) {
    const rootGroup = detectRootItemGroup(itemGroups);
    if (!rootGroup) {
      blockers.push(formatMissingItemGroupMessage());
    } else if (!allowWrites) {
      itemGroupName = "Productos";
      warnings.push(`No existe un Item Group usable; en migración real se intentará crear "Productos" bajo ${rootGroup.name}.`);
    } else {
      try {
        const createdGroup = await createErpItemGroup(rootGroup.name);
        itemGroupName = createdGroup?.name ?? "Productos";
        warnings.push(`No existía un Item Group usable; se creó "Productos" bajo ${rootGroup.name}.`);
      } catch (error) {
        blockers.push(
          error instanceof Error
            ? `${formatMissingItemGroupMessage()} ${error.message}`
            : formatMissingItemGroupMessage()
        );
      }
    }
  }

  let uomName = null;
  const activeUoms = uoms.filter((uom) => uom.enabled !== 0);
  const preferredUomCandidates = uniqueStrings([preferredUom, "Unidad", "Unit", "Nos"]);
  for (const candidate of preferredUomCandidates) {
    const matched = findUomByCandidate(activeUoms, candidate);
    if (matched) {
      uomName = matched.name;
      break;
    }
  }

  if (!uomName && activeUoms.length > 0) {
    uomName = activeUoms[0].name;
  }

  if (!uomName) {
    if (!allowWrites) {
      uomName = "Unidad";
      warnings.push('No existe una UOM activa usable; en migración real se intentará crear "Unidad".');
    } else {
      try {
        const createdUom = await createErpUom();
        uomName = createdUom?.name ?? "Unidad";
        warnings.push('No existía una UOM activa usable; se creó "Unidad".');
      } catch (error) {
        blockers.push(
          error instanceof Error
            ? `${formatMissingUomMessage()} ${error.message}`
            : formatMissingUomMessage()
        );
      }
    }
  }

  return {
    companyName,
    warehouseName,
    itemGroupName,
    uomName,
    warnings: uniqueStrings(warnings),
    blockers: uniqueStrings(blockers),
  };
}

function summarizeItemError(error) {
  if (!(error instanceof Error)) return "Error desconocido";
  const message = error.message.toLowerCase();
  if (
    message.includes("linkvalidationerror") ||
    message.includes("grupo de productos") ||
    message.includes("item group") ||
    message.includes("unidad de medida") ||
    message.includes("uom")
  ) {
    return "faltan datos maestros ERPNext: Item Group / UOM";
  }
  return error.message;
}

async function main() {
  if (!tenantSlug) {
    fail("TENANT_SLUG es requerido.");
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      operationalConfig: true,
      integrations: {
        where: { provider: "erpnext" },
        take: 1,
      },
    },
  });

  if (!tenant) {
    fail(`Tenant no encontrado para slug "${tenantSlug}".`);
    return;
  }

  const [products, customers, salesCount, sriCount, sriAuthorizedCount] = await Promise.all([
    prisma.lightweightProduct.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, price: true, cost: true, stock: true, barcode: true },
    }),
    prisma.lightweightCustomer.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, phone: true, email: true, balance: true },
    }),
    prisma.lightweightSale.count({
      where: { tenantId: tenant.id, status: { not: "canceled" } },
    }),
    prisma.sriDocument.count({ where: { tenantId: tenant.id } }),
    prisma.sriDocument.count({ where: { tenantId: tenant.id, status: "AUTHORIZED" } }),
  ]);

  const warnings = [];
  const blockers = [];

  const productsWithoutBarcode = products.filter((product) => !product.barcode?.trim()).length;
  const productsWithNegativeStock = products.filter((product) => product.stock < 0).length;
  const productsWithNoPositivePrice = products.filter((product) => Number(product.price) <= 0).length;
  const customersWithoutContact = customers.filter(
    (customer) => !customer.phone?.trim() && !customer.email?.trim()
  ).length;

  const barcodeCounts = new Map();
  for (const product of products) {
    const barcode = product.barcode?.trim();
    if (barcode) barcodeCounts.set(barcode, (barcodeCounts.get(barcode) ?? 0) + 1);
  }
  const duplicateBarcodes = Array.from(barcodeCounts.values()).filter((count) => count > 1).length;

  if (productsWithNegativeStock > 0) blockers.push(`${productsWithNegativeStock} productos con stock negativo`);
  if (productsWithNoPositivePrice > 0) blockers.push(`${productsWithNoPositivePrice} productos con precio no positivo`);
  if (duplicateBarcodes > 0) blockers.push(`${duplicateBarcodes} códigos de barras duplicados`);

  if (productsWithoutBarcode > 0) warnings.push(`${productsWithoutBarcode} productos sin código de barras — se asignará código CORE interno`);
  if (customersWithoutContact > 0) warnings.push(`${customersWithoutContact} clientes sin teléfono ni email`);
  if (customers.length > 0) warnings.push(`${customers.length} clientes sin identificación fiscal — complementar manualmente en ERPNext`);

  console.log("[upgrade-core] Tenant encontrado");
  console.log(`  slug:            ${tenant.slug}`);
  console.log(`  nombre:          ${tenant.name}`);
  console.log(`  modo actual:     ${tenant.operationalConfig?.operatingMode ?? "CORE"}`);
  console.log(`  suite status:    ${tenant.operationalConfig?.businessSuiteStatus ?? "locked"}`);
  console.log(`  dry-run:         ${dryRun ? "sí" : "NO — cambios reales"}`);
  console.log("");
  console.log("[upgrade-core] Datos CORE detectados");
  console.log(`  productos:                    ${products.length}`);
  console.log(`    sin código de barras:       ${productsWithoutBarcode}`);
  console.log(`    stock negativo:             ${productsWithNegativeStock}`);
  console.log(`    precio no positivo:         ${productsWithNoPositivePrice}`);
  console.log(`    barcodes duplicados:        ${duplicateBarcodes}`);
  console.log(`  clientes:                     ${customers.length}`);
  console.log(`    sin teléfono/email:         ${customersWithoutContact}`);
  console.log(`  ventas históricas:            ${salesCount}`);
  console.log(`  documentos SRI:               ${sriCount}`);
  console.log(`  documentos SRI autorizados:   ${sriAuthorizedCount}`);
  console.log("");
  console.log("[upgrade-core] Garantías");
  console.log("  - no borra datos básicos");
  console.log("  - no rehace ni reenvía XML SRI");
  console.log("  - ventas históricas permanecen como historial protegido");

  if (blockers.length > 0) {
    console.log("");
    console.log("[upgrade-core] Bloqueos");
    for (const blocker of blockers) console.log(`- ${blocker}`);
  }

  if (warnings.length > 0) {
    console.log("");
    console.log("[upgrade-core] Advertencias");
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  const erpAvailable = erpBaseUrl && erpApiKey && erpApiSecret;
  if (!erpAvailable) {
    console.log("");
    console.log("[upgrade-core] ERPNext no configurado.");
    console.log("  Configure ERPNEXT_BASE_URL, ERPNEXT_API_KEY y ERPNEXT_API_SECRET para continuar.");
    process.exitCode = 1;
    return;
  }

  const masterData = await resolveMasterData(tenant.id, !dryRun);
  const allBlockers = uniqueStrings([...blockers, ...masterData.blockers]);
  const allWarnings = uniqueStrings([...warnings, ...masterData.warnings]);

  console.log("");
  console.log("[upgrade-core] Datos maestros ERPNext");
  console.log(`- compañía: ${masterData.companyName ?? "(no resuelta)"}`);
  console.log(`- bodega: ${masterData.warehouseName ?? "(no resuelta)"}`);
  console.log(`- grupo de productos: ${masterData.itemGroupName ?? "(no resuelto)"}`);
  console.log(`- unidad de medida: ${masterData.uomName ?? "(no resuelta)"}`);

  if (allWarnings.length > 0) {
    console.log("");
    console.log("[upgrade-core] Advertencias acumuladas");
    for (const warning of allWarnings) console.log(`- ${warning}`);
  }

  if (allBlockers.length > 0) {
    console.log("");
    console.log("[upgrade-core] Bloqueos");
    for (const blocker of allBlockers) console.log(`- ${blocker}`);
  }

  const [erpItems, erpCustomers] = await Promise.all([getErpItems(), getErpCustomers()]);
  const existingCodes = new Set(erpItems.map((item) => item.item_code));
  const existingCustomerNames = new Set(
    erpCustomers.map((customer) => normalizeForMatch(customer.customer_name))
  );

  let wouldCreate = 0;
  let wouldFind = 0;
  let wouldCreateCustomers = 0;
  let wouldFindCustomers = 0;
  let wouldStock = 0;

  for (const product of products) {
    const code = deriveItemCode(product);
    if (existingCodes.has(code)) {
      wouldFind++;
      continue;
    }
    wouldCreate++;
    if (product.stock > 0) wouldStock++;
  }

  for (const customer of customers) {
    if (existingCustomerNames.has(normalizeForMatch(customer.name))) wouldFindCustomers++;
    else wouldCreateCustomers++;
  }

  console.log("");
  console.log("[upgrade-core] Simulación");
  console.log(`  productos a crear:           ${wouldCreate}`);
  console.log(`  productos ya en ERPNext:     ${wouldFind}`);
  console.log(`  stock entries a crear:       ${wouldStock}`);
  console.log(`  clientes a crear:            ${wouldCreateCustomers}`);
  console.log(`  clientes ya en ERPNext:      ${wouldFindCustomers}`);

  if (dryRun) {
    console.log("");
    console.log("[upgrade-core] DRY RUN completado — no se escribieron cambios.");
    console.log("[upgrade-core] Para ejecutar la migración real:");
    console.log(`  TENANT_SLUG=${tenant.slug} CONFIRM_CORE_TO_BUSINESS_UPGRADE=true npm run maintenance:upgrade-core-to-business-suite`);
    if (allBlockers.length > 0) process.exitCode = 1;
    return;
  }

  if (allBlockers.length > 0) {
    fail("Migración real abortada por bloqueos de datos maestros o datos CORE.");
    return;
  }

  if (!masterData.itemGroupName) {
    fail("No se puede migrar productos porque no se encontró un Item Group válido en ERPNext. Configura o crea un grupo de productos y vuelve a ejecutar.");
    return;
  }

  if (!masterData.uomName) {
    fail("No se puede migrar productos porque no se encontró una Unidad de Medida válida en ERPNext.");
    return;
  }

  console.log("");
  console.log("[upgrade-core] Iniciando migración real...");

  const existingCodeMap = new Map(erpItems.map((item) => [item.item_code, item]));
  const existingCustomerMap = new Map(
    erpCustomers.map((customer) => [normalizeForMatch(customer.customer_name), customer])
  );

  let created = 0;
  let found = 0;
  let failed = 0;
  let stockCreated = 0;
  let createdCustomers = 0;
  let foundCustomers = 0;
  let failedCustomers = 0;

  for (const product of products) {
    const itemCode = deriveItemCode(product);
    const existing = existingCodeMap.get(itemCode);

    if (existing) {
      found++;
      if (masterData.warehouseName && product.stock > 0) {
        const bin = await getErpBin(itemCode, masterData.warehouseName);
        const current = bin?.actual_qty ?? 0;
        const delta = product.stock - current;
        if (delta > 0) {
          const rate = Number(product.cost ?? product.price);
          const entry = await createAndSubmitStockEntry(
            itemCode,
            masterData.warehouseName,
            delta,
            rate
          ).catch(() => null);
          if (entry) {
            stockCreated++;
            console.log(`  [stock] ${product.name}: +${delta} u → ${entry}`);
          }
        }
      }
      await upsertErpProductPricing(tenant.id, itemCode, product.name, Number(product.price));
      continue;
    }

    try {
      await createErpItem(itemCode, product.name, masterData.itemGroupName, masterData.uomName);
      created++;
      console.log(`  [item] creado: ${product.name} (${itemCode})`);

      if (masterData.warehouseName && product.stock > 0) {
        const rate = Number(product.cost ?? product.price);
        const entry = await createAndSubmitStockEntry(
          itemCode,
          masterData.warehouseName,
          product.stock,
          rate
        ).catch(() => null);
        if (entry) {
          stockCreated++;
          console.log(`  [stock] ${product.name}: ${product.stock} u → ${entry}`);
        }
      }

      await upsertErpProductPricing(tenant.id, itemCode, product.name, Number(product.price));
    } catch (error) {
      failed++;
      console.error(`  [item] falló ${product.name}: ${summarizeItemError(error)}`);
    }
  }

  for (const customer of customers) {
    const normalized = normalizeForMatch(customer.name);
    if (existingCustomerMap.has(normalized)) {
      foundCustomers++;
      continue;
    }

    try {
      await createErpCustomer(customer.name.trim(), customer.phone);
      createdCustomers++;
      console.log(`  [customer] creado: ${customer.name}`);
    } catch (error) {
      failedCustomers++;
      console.error(
        `  [customer] falló ${customer.name}: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  console.log("");
  console.log("[upgrade-core] Migración completada.");
  console.log(`  Productos creados:     ${created}`);
  console.log(`  Productos encontrados: ${found}`);
  console.log(`  Productos fallidos:    ${failed}`);
  console.log(`  Stock entries:         ${stockCreated}`);
  console.log(`  Clientes creados:      ${createdCustomers}`);
  console.log(`  Clientes encontrados:  ${foundCustomers}`);
  console.log(`  Clientes fallidos:     ${failedCustomers}`);
  console.log("");
  console.log("[upgrade-core] Próximo paso: revisar productos y clientes en ERPNext.");
  console.log("  Las ventas básicas siguen visibles como historial en /facturacion/documents.");
  console.log("  Los documentos SRI permanecen intactos.");

  if (failed > 0 || failedCustomers > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[upgrade-core] Error no controlado:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
