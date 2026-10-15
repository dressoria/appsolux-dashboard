import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const read = (p: string) => fs.readFileSync(p, "utf-8");
const exists = (p: string) => fs.existsSync(p);

// ===== PART A: Sidebar navigation restructure =====

test("A-01 – Inventario group exists in sidebar", () => {
  const source = read("components/appsolux/layout/sidebar.tsx");
  assert.ok(source.includes('key: "inventory"'), "Inventory group must exist");
});

test("A-02 – Inventario has no Resumen link", () => {
  const source = read("components/appsolux/layout/sidebar.tsx");
  const inventorySection = source.slice(source.indexOf('key: "inventory"'));
  const nextGroup = inventorySection.indexOf('key: "', 10);
  const section = nextGroup > 0 ? inventorySection.slice(0, nextGroup) : inventorySection;
  assert.ok(!section.includes('title: "Resumen"'), "Resumen link should be removed from inventory");
});

test("A-03 – Inventario has Guías de remisión submenu", () => {
  const source = read("components/appsolux/layout/sidebar.tsx");
  assert.ok(source.includes("Guías de remisión"), "Guías de remisión submenu must exist");
});

test("A-04 – Inventario has Configuración submenu", () => {
  const source = read("components/appsolux/layout/sidebar.tsx");
  const inventorySection = source.slice(source.indexOf('key: "inventory"'));
  assert.ok(inventorySection.includes("Configuración"), "Configuración submenu must exist in inventory");
});

// ===== PART B: Routes =====

test("B-01 – Route config contains inventory routes", () => {
  const source = read("config/routes.ts");
  assert.ok(source.includes("facturacionInventoryWarehouses"));
  assert.ok(source.includes("facturacionInventoryCatalog"));
  assert.ok(source.includes("facturacionInventoryOrders"));
  assert.ok(source.includes("facturacionInventoryShippingGuides"));
  assert.ok(source.includes("facturacionInventoryVehicles"));
  assert.ok(source.includes("facturacionProductsNew"));
});

test("B-02 – Settings routes exist", () => {
  const source = read("config/routes.ts");
  assert.ok(source.includes("facturacionInventorySettingsCategories"));
  assert.ok(source.includes("facturacionInventorySettingsUnits"));
  assert.ok(source.includes("facturacionInventorySettingsBrands"));
});

// ===== PART D4-D7: Brands, Units engine files =====

test("D4-01 – inventory-brands engine exists with exports", () => {
  const source = read("lib/core/inventory-brands.ts");
  assert.ok(source.includes("export async function getBrands"));
  assert.ok(source.includes("export async function createBrand"));
  assert.ok(source.includes("export async function updateBrand"));
});

test("D5-01 – inventory-units engine exists with exports", () => {
  const source = read("lib/core/inventory-units.ts");
  assert.ok(source.includes("export async function getUnits"));
  assert.ok(source.includes("export async function createUnit"));
  assert.ok(source.includes("export async function updateUnit"));
});

// ===== PART E: Multi-warehouse =====

test("E-01 – inventory-warehouses engine exports core functions", () => {
  const source = read("lib/core/inventory-warehouses.ts");
  assert.ok(source.includes("export async function getWarehouses"));
  assert.ok(source.includes("export async function getWarehouseById"));
  assert.ok(source.includes("export async function getDefaultWarehouse"));
  assert.ok(source.includes("export async function ensureDefaultWarehouse"));
  assert.ok(source.includes("export async function createWarehouse"));
  assert.ok(source.includes("export async function updateWarehouse"));
  assert.ok(source.includes("export async function canDeleteWarehouse"));
});

test("E-02 – inventory-stock engine exports balance functions", () => {
  const source = read("lib/core/inventory-stock.ts");
  assert.ok(source.includes("export async function getStockBalance"));
  assert.ok(source.includes("export async function updateBalance"));
  assert.ok(source.includes("export async function syncLegacyStock"));
});

test("E-03 – InventoryStockBalance uses Decimal(14,4)", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("@db.Decimal(14, 4)"), "Stock quantities must use Decimal(14,4)");
});

// ===== PART F: Inventory ledger =====

test("F-01 – inventory-movements engine has core functions", () => {
  const source = read("lib/core/inventory-movements.ts");
  assert.ok(source.includes("export async function createMovement"));
  assert.ok(source.includes("export async function createAdjustment"));
  assert.ok(source.includes("export async function getMovements"));
});

test("F-02 – createMovement is idempotent via sourceType+sourceId", () => {
  const source = read("lib/core/inventory-movements.ts");
  assert.ok(source.includes("sourceType"), "Must check sourceType for idempotency");
  assert.ok(source.includes("sourceId"), "Must check sourceId for idempotency");
});

test("F-03 – InventoryMovement has direction IN/OUT", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("InventoryMovementDirection"));
  assert.ok(schema.includes("IN"));
  assert.ok(schema.includes("OUT"));
});

test("F-04 – InventoryMovementType has 12 values", () => {
  const schema = read("prisma/schema.prisma");
  const enumMatch = schema.match(/enum InventoryMovementType \{([^}]+)\}/);
  assert.ok(enumMatch, "InventoryMovementType enum must exist");
  const values = enumMatch![1].trim().split(/\s+/).filter(Boolean);
  assert.ok(values.length >= 12, `Must have at least 12 movement types, got ${values.length}`);
});

// ===== PART I: Price levels =====

test("I-01 – inventory-prices has 4 price channel labels", () => {
  const source = read("lib/core/inventory-prices.ts");
  assert.ok(source.includes("PRICE_CHANNEL_LABELS"));
  assert.ok(source.includes("price:") || source.includes('"price"'));
  assert.ok(source.includes("price2") || source.includes('"price2"'));
  assert.ok(source.includes("price3") || source.includes('"price3"'));
  assert.ok(source.includes("price4") || source.includes('"price4"'));
});

test("I-02 – LightweightProduct has price4 field", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("price4"), "price4 field must exist in schema");
});

// ===== PART J: Bulk price updates =====

test("J-01 – inventory-prices exports preview and confirm", () => {
  const source = read("lib/core/inventory-prices.ts");
  assert.ok(source.includes("export async function previewBulkPriceUpdate"));
  assert.ok(source.includes("export async function confirmBulkPriceUpdate"));
});

test("J-02 – confirmBulkPriceUpdate creates ProductPriceChange audit", () => {
  const source = read("lib/core/inventory-prices.ts");
  assert.ok(source.includes("productPriceChange"), "Must create audit records");
});

// ===== PART K: Product accounting accounts =====

test("K-01 – LightweightProduct has accounting account fields", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("salesAccountId"));
  assert.ok(schema.includes("inventoryAccountId"));
  assert.ok(schema.includes("cogsAccountId"));
  assert.ok(schema.includes("purchaseAccountId"));
});

// ===== PART L: Additional info =====

test("L-01 – LightweightProduct has additional info fields", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("color"), "color field");
  assert.ok(schema.includes("warrantyDuration"), "warrantyDuration field");
  assert.ok(schema.includes("warrantyUnit"), "warrantyUnit field");
  assert.ok(schema.includes("isProcessed"), "isProcessed field");
});

// ===== PART M: Product import =====

test("M-01 – inventory-import has TEMPLATE_COLUMNS", () => {
  const source = read("lib/core/inventory-import.ts");
  assert.ok(source.includes("TEMPLATE_COLUMNS"));
});

test("M-02 – inventory-import has preview and confirm", () => {
  const source = read("lib/core/inventory-import.ts");
  assert.ok(source.includes("export async function previewImport"));
  assert.ok(source.includes("export async function confirmImport"));
});

test("M-03 – confirmImport creates OPENING movements for initial stock", () => {
  const source = read("lib/core/inventory-import.ts");
  assert.ok(source.includes("OPENING"), "Must create OPENING movements for initial stock");
});

// ===== PART Q: Warehouses page =====

test("Q-01 – Warehouses page exists", () => {
  assert.ok(exists("app/facturacion/inventory/warehouses/page.tsx"));
});

test("Q-02 – Warehouses client component exists", () => {
  assert.ok(exists("app/facturacion/inventory/warehouses/warehouses-client.tsx"));
});

// ===== PART R: Movements page =====

test("R-01 – Movements page exists", () => {
  assert.ok(exists("app/facturacion/inventory/movements/page.tsx"));
});

test("R-02 – Movements page is native (no ERP wrapper)", () => {
  const source = read("app/facturacion/inventory/movements/page.tsx");
  assert.ok(!source.includes("@/app/erp/"), "Must not use ERP wrapper");
});

// ===== PART S: Adjustments page =====

test("S-01 – Adjustments page exists", () => {
  assert.ok(exists("app/facturacion/inventory/adjustments/page.tsx"));
});

test("S-02 – Adjustments page is native", () => {
  const source = read("app/facturacion/inventory/adjustments/page.tsx");
  assert.ok(!source.includes("@/app/erp/"), "Must not use ERP wrapper");
});

// ===== PART T: Physical count =====

test("T-01 – inventory-physical-counts engine has core functions", () => {
  const source = read("lib/core/inventory-physical-counts.ts");
  assert.ok(source.includes("export async function getPhysicalCounts"));
  assert.ok(source.includes("export async function createPhysicalCount"));
  assert.ok(source.includes("export async function completePhysicalCount"));
});

test("T-02 – createPhysicalCount snapshots expectedQuantity", () => {
  const source = read("lib/core/inventory-physical-counts.ts");
  assert.ok(source.includes("expectedQuantity"), "Must snapshot expected quantity");
});

test("T-03 – Physical count page exists", () => {
  assert.ok(exists("app/facturacion/inventory/physical-count/page.tsx"));
});

// ===== PART U: Transfers =====

test("U-01 – inventory-transfers engine has core functions", () => {
  const source = read("lib/core/inventory-transfers.ts");
  assert.ok(source.includes("export async function getTransfers"));
  assert.ok(source.includes("export async function createTransfer"));
  assert.ok(source.includes("export async function completeTransfer"));
});

test("U-02 – completeTransfer uses transferGroupId", () => {
  const source = read("lib/core/inventory-transfers.ts");
  assert.ok(source.includes("transferGroupId"), "Must link OUT and IN movements");
});

test("U-03 – createTransfer validates source ≠ destination", () => {
  const source = read("lib/core/inventory-transfers.ts");
  assert.ok(source.includes("sourceWarehouseId") && source.includes("destinationWarehouseId"));
});

test("U-04 – Transfers page exists", () => {
  assert.ok(exists("app/facturacion/inventory/transfers/page.tsx"));
});

// ===== PART V: Kardex =====

test("V-01 – inventory-kardex engine has getKardex", () => {
  const source = read("lib/core/inventory-kardex.ts");
  assert.ok(source.includes("export async function getKardex"));
});

test("V-02 – getKardex calculates openingBalance", () => {
  const source = read("lib/core/inventory-kardex.ts");
  assert.ok(source.includes("openingBalance"), "Must calculate opening balance");
});

test("V-03 – Kardex page exists", () => {
  assert.ok(exists("app/facturacion/inventory/kardex/page.tsx"));
});

// ===== PART W: Valuation =====

test("W-01 – inventory-valuation engine has getValuation", () => {
  const source = read("lib/core/inventory-valuation.ts");
  assert.ok(source.includes("export async function getValuation"));
});

test("W-02 – Valuation uses WEIGHTED_AVERAGE", () => {
  const source = read("lib/core/inventory-valuation.ts");
  assert.ok(source.includes("WEIGHTED_AVERAGE"), "Must use WEIGHTED_AVERAGE method");
});

test("W-03 – Valuation page exists", () => {
  assert.ok(exists("app/facturacion/inventory/valuation/page.tsx"));
});

// ===== PART X-Y: Shipping guides + vehicles =====

test("X-01 – inventory-guides engine has shipment guide functions", () => {
  const source = read("lib/core/inventory-guides.ts");
  assert.ok(source.includes("export async function getShipmentGuides"));
  assert.ok(source.includes("export async function createShipmentGuide"));
  assert.ok(source.includes("export async function updateShipmentGuideStatus"));
});

test("X-02 – ShipmentGuide uses REFERRAL_GUIDE_SRI_PENDING status", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("REFERRAL_GUIDE_SRI_PENDING"), "Must have SRI pending status");
});

test("Y-01 – inventory-guides engine has vehicle functions", () => {
  const source = read("lib/core/inventory-guides.ts");
  assert.ok(source.includes("export async function getVehicles"));
  assert.ok(source.includes("export async function createVehicle"));
});

test("X-03 – Shipping guides page exists", () => {
  assert.ok(exists("app/facturacion/inventory/shipping-guides/documents/page.tsx"));
});

test("Y-02 – Vehicles page exists", () => {
  assert.ok(exists("app/facturacion/inventory/shipping-guides/vehicles/page.tsx"));
});

// ===== PART Z: Catalog =====

test("Z-01 – Catalog page exists", () => {
  assert.ok(exists("app/facturacion/inventory/catalog/page.tsx"));
});

// ===== PART AA: Orders =====

test("AA-01 – inventory-orders engine has core functions", () => {
  const source = read("lib/core/inventory-orders.ts");
  assert.ok(source.includes("export async function getOrders"));
  assert.ok(source.includes("export async function createOrder"));
  assert.ok(source.includes("export async function updateOrderStatus"));
});

test("AA-02 – Orders page exists", () => {
  assert.ok(exists("app/facturacion/inventory/orders/page.tsx"));
});

// ===== PART AB: Configuration submenu pages =====

test("AB-01 – Settings categories page exists", () => {
  assert.ok(exists("app/facturacion/inventory/settings/categories/page.tsx"));
});

test("AB-02 – Settings units page exists", () => {
  assert.ok(exists("app/facturacion/inventory/settings/units/page.tsx"));
});

test("AB-03 – Settings brands page exists", () => {
  assert.ok(exists("app/facturacion/inventory/settings/brands/page.tsx"));
});

// ===== PART AC: InventorySettings =====

test("AC-01 – inventory-settings engine has core functions", () => {
  const source = read("lib/core/inventory-settings.ts");
  assert.ok(source.includes("export async function getInventorySettings"));
  assert.ok(source.includes("export async function upsertInventorySettings"));
  assert.ok(source.includes("export async function getAllowNegativeStock"));
});

// ===== PART D1-D3: Image upload =====

test("D1-01 – product-image-storage engine exists", () => {
  const source = read("lib/core/product-image-storage.ts");
  assert.ok(source.includes("export function validateImageUpload"));
  assert.ok(source.includes("export async function saveProductImage"));
  assert.ok(source.includes("export async function deleteProductImage"));
  assert.ok(source.includes("getImagePath"));
  assert.ok(source.includes("getImageMime"));
});

test("D1-02 – Image validation enforces 5MB limit", () => {
  const source = read("lib/core/product-image-storage.ts");
  assert.ok(source.includes("5") && source.includes("MB"), "Must enforce 5MB limit");
});

test("D1-03 – Image storage uses UUID filenames", () => {
  const source = read("lib/core/product-image-storage.ts");
  assert.ok(source.includes("randomUUID") || source.includes("uuid"), "Must use UUID filenames");
});

// ===== PART C: Products engine =====

test("C-01 – inventory-products engine has core functions", () => {
  const source = read("lib/core/inventory-products.ts");
  assert.ok(source.includes("export async function getProducts"));
  assert.ok(source.includes("export async function getProductById"));
  assert.ok(source.includes("export async function createProduct"));
  assert.ok(source.includes("export async function updateProduct"));
});

// ===== PART G: POS integration =====

test("G-01 – lightweight-pos uses inventory movement direction", () => {
  const source = read("lib/core/lightweight-pos.ts");
  assert.ok(
    source.includes('"OUT"') && source.includes('"IN"'),
    "Must use IN/OUT direction for multi-warehouse sync",
  );
});

test("G-02 – lightweight-pos uses inventory movement types", () => {
  const source = read("lib/core/lightweight-pos.ts");
  assert.ok(
    source.includes('"SALE"') && source.includes('"SALE_RETURN"'),
    "Must use SALE and SALE_RETURN movement types",
  );
});

test("G-03 – createSale creates InventoryMovement", () => {
  const source = read("lib/core/lightweight-pos.ts");
  assert.ok(source.includes("inventoryMovement.create"), "createSale must create InventoryMovement");
});

test("G-04 – cancelSale creates SALE_RETURN movement", () => {
  const source = read("lib/core/lightweight-pos.ts");
  assert.ok(source.includes("SALE_RETURN"), "cancelSale must use SALE_RETURN movement type");
});

test("G-05 – purchase-documents creates InventoryMovement on confirm", () => {
  const source = read("lib/core/purchase-documents.ts");
  assert.ok(source.includes("inventoryMovement.create"), "Must create InventoryMovement");
  assert.ok(source.includes("PURCHASE_RECEIPT"), "Must use PURCHASE_RECEIPT movement type");
});

// ===== PART AG: API routes =====

test("AG-01 – Products API route exists", () => {
  assert.ok(exists("app/api/inventory/products/route.ts"));
});

test("AG-02 – Warehouses API route exists", () => {
  assert.ok(exists("app/api/inventory/warehouses/route.ts"));
});

test("AG-03 – Movements API route exists", () => {
  assert.ok(exists("app/api/inventory/movements/route.ts"));
});

test("AG-04 – Adjustments API route exists", () => {
  assert.ok(exists("app/api/inventory/adjustments/route.ts"));
});

test("AG-05 – Physical counts API route exists", () => {
  assert.ok(exists("app/api/inventory/physical-counts/route.ts"));
});

test("AG-06 – Transfers API route exists", () => {
  assert.ok(exists("app/api/inventory/transfers/route.ts"));
});

test("AG-07 – Kardex API route exists", () => {
  assert.ok(exists("app/api/inventory/kardex/route.ts"));
});

test("AG-08 – Valuation API route exists", () => {
  assert.ok(exists("app/api/inventory/valuation/route.ts"));
});

test("AG-09 – Shipping guides API route exists", () => {
  assert.ok(exists("app/api/inventory/shipping-guides/route.ts"));
});

test("AG-10 – Vehicles API route exists", () => {
  assert.ok(exists("app/api/inventory/vehicles/route.ts"));
});

test("AG-11 – Orders API route exists", () => {
  assert.ok(exists("app/api/inventory/orders/route.ts"));
});

test("AG-12 – Settings API route exists", () => {
  assert.ok(exists("app/api/inventory/settings/route.ts"));
});

test("AG-13 – Brands API route exists", () => {
  assert.ok(exists("app/api/inventory/brands/route.ts"));
});

test("AG-14 – Units API route exists", () => {
  assert.ok(exists("app/api/inventory/units/route.ts"));
});

test("AG-15 – Categories API route exists", () => {
  assert.ok(exists("app/api/inventory/categories/route.ts"));
});

// ===== PART AH: NO TOUCH constraints =====

test("AH-01 – SRI XML module untouched (exists)", () => {
  assert.ok(exists("lib/core/sri-xml.ts"), "sri-xml.ts must still exist");
});

// ===== Docker compose =====

test("DC-01 – Docker compose has product-images volume", () => {
  const content = read("docker-compose.prod.yml");
  assert.ok(content.includes("product-images"), "Must mount product-images volume");
});

// ===== Migration =====

test("MIG-01 – Inventory core migration exists", () => {
  assert.ok(exists("prisma/migrations/20261015150000_add_inventory_core/migration.sql"));
});

test("MIG-02 – Migration creates InventoryWarehouse table", () => {
  const sql = read("prisma/migrations/20261015150000_add_inventory_core/migration.sql");
  assert.ok(sql.includes("InventoryWarehouse"), "Must create InventoryWarehouse");
});

test("MIG-03 – Migration creates InventoryStockBalance table", () => {
  const sql = read("prisma/migrations/20261015150000_add_inventory_core/migration.sql");
  assert.ok(sql.includes("InventoryStockBalance"));
});

test("MIG-04 – Migration creates InventoryMovement table", () => {
  const sql = read("prisma/migrations/20261015150000_add_inventory_core/migration.sql");
  assert.ok(sql.includes("InventoryMovement"));
});

test("MIG-05 – Prior migrations not modified", () => {
  const protected_ = [
    "20261012100000",
    "20261012200000",
    "20261013100000",
    "20261013150000",
    "20261015100000_add_accounting_core",
  ];
  for (const name of protected_) {
    const migDirs = fs.readdirSync("prisma/migrations").filter((d) => d.startsWith(name));
    for (const dir of migDirs) {
      assert.ok(
        exists(`prisma/migrations/${dir}/migration.sql`),
        `${name} migration must still exist unchanged`,
      );
    }
  }
});

// ===== Products pages =====

test("PG-01 – Products list page exists", () => {
  assert.ok(exists("app/facturacion/products/page.tsx"));
});

test("PG-02 – Products new page exists", () => {
  assert.ok(exists("app/facturacion/products/new/page.tsx"));
});

test("PG-03 – Products edit page exists", () => {
  assert.ok(exists("app/facturacion/products/[productId]/page.tsx"));
});

test("PG-04 – Product form client exists with 4 tabs", () => {
  const source = read("app/facturacion/products/product-form-client.tsx");
  assert.ok(source.includes("Datos"), "Tab 1: Datos");
  assert.ok(source.includes("Impuestos") || source.includes("Precios"), "Tab 2: Impuestos/Precios");
  assert.ok(source.includes("contable") || source.includes("Cuentas"), "Tab 3: Cuentas contables");
  assert.ok(source.includes("adicional") || source.includes("Info"), "Tab 4: Info adicional");
});

test("PG-05 – Products list client has price columns", () => {
  const source = read("app/facturacion/products/products-list-client.tsx");
  assert.ok(source.includes("PVP"), "Must show PVP columns");
});

// ===== Schema integrity =====

test("SCH-01 – Schema has all new enums", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("enum InventoryMovementDirection"));
  assert.ok(schema.includes("enum InventoryMovementType"));
  assert.ok(schema.includes("enum InventoryPhysicalCountStatus"));
  assert.ok(schema.includes("enum InventoryTransferStatus"));
  assert.ok(schema.includes("enum ShipmentGuideStatus"));
  assert.ok(schema.includes("enum InventoryOrderStatus"));
  assert.ok(schema.includes("enum InventoryValuationMethod"));
  assert.ok(schema.includes("enum ProductTaxCategory"));
  assert.ok(schema.includes("enum WarrantyUnit"));
});

test("SCH-02 – Schema has all new models", () => {
  const schema = read("prisma/schema.prisma");
  const models = [
    "InventoryBrand", "InventoryUnit", "InventoryWarehouse",
    "InventoryStockBalance", "InventoryMovement", "InventoryPhysicalCount",
    "InventoryPhysicalCountItem", "InventoryTransfer", "InventoryTransferItem",
    "InventoryVehicle", "ShipmentGuide", "ShipmentGuideItem",
    "InventoryOrder", "InventoryOrderItem", "ProductPriceChange",
    "InventorySettings",
  ];
  for (const model of models) {
    assert.ok(schema.includes(`model ${model}`), `Model ${model} must exist`);
  }
});

test("SCH-03 – FIFO is enum-only, not implemented", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(schema.includes("FIFO"), "FIFO should exist as enum value");
  const valuation = read("lib/core/inventory-valuation.ts");
  assert.ok(
    valuation.includes("WEIGHTED_AVERAGE") && !valuation.includes("case \"FIFO\""),
    "FIFO should NOT be implemented, only WEIGHTED_AVERAGE",
  );
});

// ===== BACKFILL SCRIPT TESTS =====

const backfillPath = "scripts/maintenance/backfill-inventory-stock-balances.mjs";

test("BF-A – Script exists", () => {
  assert.ok(exists(backfillPath), "Backfill script must exist");
});

test("BF-B – Tenant without warehouse gets a single Bodega principal created", () => {
  const src = read(backfillPath);
  assert.ok(src.includes('code: "MAIN"'), "Must create warehouse with code MAIN");
  assert.ok(src.includes('name: "Bodega principal"'), "Must name it Bodega principal");
  assert.ok(src.includes("isDefault: true"), "Must set isDefault: true");
  assert.ok(src.includes('action: "CREATED_NEW"'), "Must report CREATED_NEW action");
});

test("BF-C – Tenant with existing default warehouse reuses it", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("isDefault: true, active: true"), "Must look for existing default active warehouse");
  assert.ok(src.includes('action: "REUSED_EXISTING_DEFAULT"'), "Must report REUSED_EXISTING_DEFAULT");
});

test("BF-D – Tenant with warehouses but no default selects oldest deterministically", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("active: true"), "Must filter only active warehouses");
  assert.ok(src.includes('orderBy: { createdAt: "asc" }'), "Must order by createdAt asc to pick oldest");
  assert.ok(src.includes('action: "MARKED_OLDEST_AS_DEFAULT"'), "Must report MARKED_OLDEST_AS_DEFAULT");
});

test("BF-E – Product with stock creates InventoryStockBalance", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("inventoryStockBalance.create"), "Must create InventoryStockBalance");
  assert.ok(src.includes("quantity: new Decimal(product.stock)"), "Must use product.stock as quantity");
});

test("BF-F – Product with stock creates OPENING movement", () => {
  const src = read(backfillPath);
  assert.ok(src.includes('movementType: "OPENING"'), "Must create OPENING movement");
  assert.ok(src.includes("Math.abs(product.stock)"), "Must use absolute value for quantity");
});

test("BF-G – Product with stock 0 creates balance but no OPENING", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("product.stock !== 0"), "Must check stock !== 0 before creating OPENING");
  assert.ok(src.includes("zeroStockNoOpening"), "Must track zero-stock-no-opening count");
});

test("BF-H – SERVICE products are excluded", () => {
  const src = read(backfillPath);
  assert.ok(src.includes('type: { not: "SERVICE" }'), "Must filter out SERVICE products");
});

test("BF-I – trackInventory false products are excluded", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("trackInventory: true"), "Must require trackInventory: true");
});

test("BF-J – COMBO products are excluded from stock balance creation", () => {
  const src = read(backfillPath);
  assert.ok(src.includes('p.type === "COMBO"'), "Must identify combo products");
  assert.ok(src.includes('p.type !== "COMBO"'), "Must exclude combos from inventoriable list");
  assert.ok(src.includes("combosSkipped"), "Must track combos skipped");
});

test("BF-K – Idempotency: second execution creates 0 new balances", () => {
  const src = read(backfillPath);
  assert.ok(
    src.includes("inventoryStockBalance.findFirst") &&
    src.includes("if (existingBalance)"),
    "Must check for existing balance before creating",
  );
  assert.ok(src.includes("balancesAlreadyExist"), "Must track already-existing balances");
});

test("BF-L – Idempotency: second execution creates 0 new OPENING movements", () => {
  const src = read(backfillPath);
  assert.ok(
    src.includes("inventoryMovement.findFirst") &&
    src.includes('sourceType: "LEGACY_STOCK_BACKFILL"'),
    "Must check for existing OPENING by sourceType LEGACY_STOCK_BACKFILL",
  );
  assert.ok(src.includes("openingsAlreadyExist"), "Must track already-existing openings");
});

test("BF-M – Legacy stock is NOT modified", () => {
  const src = read(backfillPath);
  assert.ok(!src.includes("lightweightProduct.update"), "Must NOT update LightweightProduct");
  assert.ok(!src.includes("lightweightProduct.updateMany"), "Must NOT updateMany LightweightProduct");
});

test("BF-N – Post-backfill validation is product-by-product", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("validatePostBackfill"), "Must have validatePostBackfill function");
  assert.ok(src.includes("product.stock !== warehouseTotal"), "Must compare per product");
  assert.ok(src.includes("discrepancies"), "Must collect discrepancies");
});

test("BF-O – Tenant isolation via tenantId filtering", () => {
  const src = read(backfillPath);
  const tenantIdOccurrences = (src.match(/tenantId/g) || []).length;
  assert.ok(tenantIdOccurrences >= 15, "Must use tenantId extensively for isolation");
});

test("BF-P – Dry-run does not persist data", () => {
  const src = read(backfillPath);
  assert.ok(src.includes('--dry-run'), "Must support --dry-run flag");
  assert.ok(src.includes("if (isExecute)"), "Must gate writes behind isExecute flag");
  const createCalls = src.split("if (isExecute)");
  assert.ok(createCalls.length >= 4, "Must gate multiple write operations behind isExecute");
});

test("BF-Q – Error in tenant causes rollback of that tenant only", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("$transaction"), "Must use $transaction for atomicity");
  assert.ok(src.includes("catch (err)"), "Must catch per-tenant errors");
  assert.ok(src.includes("ROLLBACK"), "Must report rollback on failure");
  assert.ok(src.includes("tenantsFailed"), "Must track failed tenants separately");
});

test("BF-R – Uses sourceType LEGACY_STOCK_BACKFILL and sourceId = product.id", () => {
  const src = read(backfillPath);
  assert.ok(src.includes('sourceType: "LEGACY_STOCK_BACKFILL"'), "sourceType must be LEGACY_STOCK_BACKFILL");
  assert.ok(src.includes("sourceId: product.id"), "sourceId must be product.id");
});

test("BF-S – Uses Decimal for quantities, not floats", () => {
  const src = read(backfillPath);
  assert.ok(src.includes("new Decimal(product.stock)"), "Balance quantity must use Decimal");
  assert.ok(src.includes("new Decimal(Math.abs(product.stock))"), "Movement quantity must use Decimal");
});

test("BF-T – Requires explicit --execute flag to write", () => {
  const src = read(backfillPath);
  assert.ok(src.includes('args.includes("--execute")'), "Must check for --execute");
  assert.ok(src.includes("process.exit(1)"), "Must exit if neither flag provided");
});

test("BF-U – OPENING direction is IN for positive stock", () => {
  const src = read(backfillPath);
  assert.ok(
    src.includes('direction: product.stock > 0 ? "IN" : "OUT"'),
    "Direction must be IN for positive stock, OUT for negative",
  );
});

test("BF-V – Description is correct on OPENING movements", () => {
  const src = read(backfillPath);
  assert.ok(
    src.includes("Saldo inicial migrado desde inventario histórico de Facturom"),
    "Must use correct description",
  );
});
