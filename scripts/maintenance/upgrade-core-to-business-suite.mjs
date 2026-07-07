/**
 * Migrar datos de Básico/Core hacia Gestión Empresarial (ERPNext).
 *
 * Crea Items, Clientes y Stock Entries en ERPNext a partir de los datos
 * de LightweightProduct / LightweightCustomer del tenant.
 *
 * El script es idempotente: si se ejecuta dos veces no duplica datos.
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
 *   ERPNEXT_COMPANY     Nombre de la compañía en ERPNext (si no se pasa, se usa la primera disponible)
 *   ERPNEXT_ITEM_GROUP  Grupo de items (default: "All Item Groups")
 *   ERPNEXT_UOM         Unidad de medida (default: "Nos")
 *   ERPNEXT_TERRITORY   Territorio de cliente (default: "All Territories")
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Load .env.local if present ────────────────────────────────────────────────

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

// ── Config ────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const tenantSlug = process.env.TENANT_SLUG?.trim();
const dryRun = process.env.CONFIRM_CORE_TO_BUSINESS_UPGRADE !== "true";
const erpBaseUrl = process.env.ERPNEXT_BASE_URL?.replace(/\/$/, "");
const erpApiKey = process.env.ERPNEXT_API_KEY;
const erpApiSecret = process.env.ERPNEXT_API_SECRET;
const preferredCompany = process.env.ERPNEXT_COMPANY?.trim();
const itemGroup = process.env.ERPNEXT_ITEM_GROUP?.trim() || "All Item Groups";
const uom = process.env.ERPNEXT_UOM?.trim() || "Nos";
const territory = process.env.ERPNEXT_TERRITORY?.trim() || "All Territories";

// ── ERPNext helpers ───────────────────────────────────────────────────────────

function erpHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${erpApiKey}:${erpApiSecret}`,
  };
}

async function erpFetch(path, options = {}) {
  const url = `${erpBaseUrl}${path}`;
  const res = await fetch(url, { ...options, headers: erpHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ERPNext ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
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

async function getErpWarehouses() {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "warehouse_name", "company", "disabled", "is_group"]),
      limit_page_length: "200",
    });
    const res = await erpFetch(`/api/resource/Warehouse?${params}`);
    return (res.data ?? []).filter((w) => !w.disabled && !w.is_group);
  } catch {
    return [];
  }
}

async function getErpCompanies() {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "company_name"]),
      limit_page_length: "100",
    });
    const res = await erpFetch(`/api/resource/Company?${params}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

async function createErpItem(itemCode, itemName) {
  return erpFetch("/api/resource/Item", {
    method: "POST",
    body: JSON.stringify({
      item_code: itemCode,
      item_name: itemName,
      stock_uom: uom,
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
  // Create draft
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

  // Fetch full doc then submit
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
    // Non-critical
  }
}

// ── Item code derivation ──────────────────────────────────────────────────────

function deriveItemCode(product) {
  const cleaned = product.barcode?.trim();
  if (cleaned) return cleaned;
  return `CORE-${product.id.slice(-10).toUpperCase()}`;
}

function normalizeForMatch(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Main ──────────────────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`[upgrade-core] ${msg}`);
  process.exitCode = 1;
}

async function resolveWarehouse(companyName) {
  const warehouses = await getErpWarehouses();
  if (warehouses.length === 0) return null;
  if (companyName) {
    const preferred = warehouses.find((w) =>
      w.name.toLowerCase().includes(companyName.toLowerCase())
    );
    if (preferred) return preferred.name;
  }
  return warehouses[0].name;
}

async function main() {
  if (!tenantSlug) {
    fail("TENANT_SLUG es requerido.");
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: { operationalConfig: true },
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

  const productsWithoutBarcode = products.filter((p) => !p.barcode?.trim()).length;
  const productsWithNegativeStock = products.filter((p) => p.stock < 0).length;
  const productsWithNoPositivePrice = products.filter((p) => Number(p.price) <= 0).length;
  const customersWithoutContact = customers.filter((c) => !c.phone?.trim() && !c.email?.trim()).length;

  const barcodeCounts = new Map();
  for (const p of products) {
    const b = p.barcode?.trim();
    if (b) barcodeCounts.set(b, (barcodeCounts.get(b) ?? 0) + 1);
  }
  const duplicateBarcodes = Array.from(barcodeCounts.values()).filter((c) => c > 1).length;

  if (productsWithNegativeStock > 0)
    blockers.push(`${productsWithNegativeStock} productos con stock negativo`);
  if (productsWithNoPositivePrice > 0)
    blockers.push(`${productsWithNoPositivePrice} productos con precio no positivo`);
  if (duplicateBarcodes > 0)
    blockers.push(`${duplicateBarcodes} códigos de barras duplicados`);

  if (productsWithoutBarcode > 0)
    warnings.push(`${productsWithoutBarcode} productos sin código de barras — se asignará código CORE interno`);
  if (customersWithoutContact > 0)
    warnings.push(`${customersWithoutContact} clientes sin teléfono ni email`);
  if (customers.length > 0)
    warnings.push(`${customers.length} clientes sin identificación fiscal — complementar manualmente en ERPNext`);

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
    console.log("[upgrade-core] BLOQUEADORES (deben resolverse antes de migrar):");
    for (const b of blockers) console.log(`  ✗ ${b}`);
  }

  if (warnings.length > 0) {
    console.log("");
    console.log("[upgrade-core] Advertencias:");
    for (const w of warnings) console.log(`  ⚠  ${w}`);
  }

  if (dryRun) {
    // Show what would happen
    let erpItems = [], erpCustomers = [];
    const erpAvailable = erpBaseUrl && erpApiKey && erpApiSecret;

    if (erpAvailable) {
      [erpItems, erpCustomers] = await Promise.all([getErpItems(), getErpCustomers()]);
    } else {
      console.log("");
      console.log("[upgrade-core] ERPNext no configurado — análisis de matching no disponible en dry-run.");
      console.log("  Configure ERPNEXT_BASE_URL, ERPNEXT_API_KEY y ERPNEXT_API_SECRET para ver el análisis completo.");
    }

    const existingCodes = new Set(erpItems.map((i) => i.item_code));
    const existingCustomerNames = new Set(
      erpCustomers.map((c) => normalizeForMatch(c.customer_name))
    );

    let wouldCreate = 0, wouldFind = 0, wouldCreateCustomers = 0, wouldFindCustomers = 0, wouldStock = 0;

    for (const p of products) {
      const code = deriveItemCode(p);
      if (existingCodes.has(code)) wouldFind++;
      else { wouldCreate++; if (p.stock > 0) wouldStock++; }
    }
    for (const c of customers) {
      if (existingCustomerNames.has(normalizeForMatch(c.name))) wouldFindCustomers++;
      else wouldCreateCustomers++;
    }

    console.log("");
    console.log("[upgrade-core] Simulación (dry-run)");
    console.log(`  productos a crear:           ${wouldCreate}`);
    console.log(`  productos ya en ERPNext:     ${wouldFind}`);
    console.log(`  stock entries a crear:       ${wouldStock}`);
    console.log(`  clientes a crear:            ${wouldCreateCustomers}`);
    console.log(`  clientes ya en ERPNext:      ${wouldFindCustomers}`);
    console.log("");
    console.log("[upgrade-core] DRY RUN completado — no se escribieron cambios.");
    console.log("[upgrade-core] Para ejecutar la migración real:");
    console.log(`  TENANT_SLUG=${tenant.slug} CONFIRM_CORE_TO_BUSINESS_UPGRADE=true npm run maintenance:upgrade-core-to-business-suite`);
    return;
  }

  // ── Real migration ────────────────────────────────────────────────────────

  if (!erpBaseUrl || !erpApiKey || !erpApiSecret) {
    fail("Faltan ERPNEXT_BASE_URL, ERPNEXT_API_KEY y/o ERPNEXT_API_SECRET.");
    return;
  }

  if (blockers.length > 0) {
    fail(`Migración bloqueada: ${blockers.join(", ")}`);
    return;
  }

  // Resolve company and warehouse
  const companies = await getErpCompanies();
  let companyName = preferredCompany;
  if (!companyName) {
    companyName = companies[0]?.name ?? null;
  }

  const warehouseName = await resolveWarehouse(companyName);
  if (!warehouseName) {
    console.warn("[upgrade-core] No se encontró bodega activa — stock no se migrará.");
  }

  console.log("");
  console.log("[upgrade-core] Iniciando migración real...");
  console.log(`  compañía ERPNext: ${companyName ?? "(primera disponible)"}`);
  console.log(`  bodega ERPNext:   ${warehouseName ?? "(ninguna — stock no migrado)"}`);

  const [existingItems, existingCustomers] = await Promise.all([getErpItems(), getErpCustomers()]);
  const existingCodeMap = new Map(existingItems.map((i) => [i.item_code, i]));
  const existingCustomerMap = new Map(
    existingCustomers.map((c) => [normalizeForMatch(c.customer_name), c])
  );

  let created = 0, found = 0, failed = 0, stockCreated = 0;
  let createdCustomers = 0, foundCustomers = 0, failedCustomers = 0;

  // ── Products ──
  for (const product of products) {
    const itemCode = deriveItemCode(product);
    const existing = existingCodeMap.get(itemCode);

    if (existing) {
      found++;
      // Check and fill stock if needed
      if (warehouseName && product.stock > 0) {
        const bin = await getErpBin(itemCode, warehouseName);
        const current = bin?.actual_qty ?? 0;
        const delta = product.stock - current;
        if (delta > 0) {
          const rate = Number(product.cost ?? product.price);
          const entry = await createAndSubmitStockEntry(itemCode, warehouseName, delta, rate).catch(() => null);
          if (entry) { stockCreated++; console.log(`  [stock] ${product.name}: +${delta} u → ${entry}`); }
        }
      }
      await upsertErpProductPricing(tenant.id, itemCode, product.name, Number(product.price));
      continue;
    }

    try {
      await createErpItem(itemCode, product.name);
      created++;
      console.log(`  [item] creado: ${product.name} (${itemCode})`);

      if (warehouseName && product.stock > 0) {
        const rate = Number(product.cost ?? product.price);
        const entry = await createAndSubmitStockEntry(itemCode, warehouseName, product.stock, rate).catch(() => null);
        if (entry) { stockCreated++; console.log(`  [stock] ${product.name}: ${product.stock} u → ${entry}`); }
      }

      await upsertErpProductPricing(tenant.id, itemCode, product.name, Number(product.price));
    } catch (err) {
      failed++;
      console.error(`  [item] error: ${product.name} — ${err.message}`);
    }
  }

  // ── Customers ──
  for (const customer of customers) {
    const norm = normalizeForMatch(customer.name);
    if (existingCustomerMap.has(norm)) {
      foundCustomers++;
      continue;
    }
    try {
      await createErpCustomer(customer.name.trim(), customer.phone);
      createdCustomers++;
      console.log(`  [customer] creado: ${customer.name}`);
    } catch (err) {
      failedCustomers++;
      console.error(`  [customer] error: ${customer.name} — ${err.message}`);
    }
  }

  console.log("");
  console.log("[upgrade-core] Migración completada.");
  console.log(`  Productos creados:    ${created}`);
  console.log(`  Productos encontrados: ${found}`);
  console.log(`  Productos fallidos:   ${failed}`);
  console.log(`  Stock entries:        ${stockCreated}`);
  console.log(`  Clientes creados:     ${createdCustomers}`);
  console.log(`  Clientes encontrados: ${foundCustomers}`);
  console.log(`  Clientes fallidos:    ${failedCustomers}`);
  console.log("");
  console.log("[upgrade-core] Próximo paso: revisar productos y clientes en ERPNext.");
  console.log("  Las ventas básicas siguen visibles como historial en /facturacion/documents.");
  console.log("  Los documentos SRI permanecen intactos.");

  if (failed > 0 || failedCustomers > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("[upgrade-core] Error no controlado:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
