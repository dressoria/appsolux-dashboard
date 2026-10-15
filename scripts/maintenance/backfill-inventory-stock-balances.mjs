import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isExecute = args.includes("--execute");

if (!isDryRun && !isExecute) {
  console.log("Usage:");
  console.log("  node scripts/maintenance/backfill-inventory-stock-balances.mjs --dry-run");
  console.log("  node scripts/maintenance/backfill-inventory-stock-balances.mjs --execute");
  console.log("");
  console.log("--dry-run   Preview changes without writing to database");
  console.log("--execute   Apply changes to database");
  process.exit(1);
}

const MODE = isExecute ? "EXECUTE" : "DRY-RUN";

async function resolveDefaultWarehouse(tx, tenantId) {
  const existing = await tx.inventoryWarehouse.findFirst({
    where: { tenantId, isDefault: true, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return { warehouse: existing, action: "REUSED_EXISTING_DEFAULT" };

  const anyActive = await tx.inventoryWarehouse.findFirst({
    where: { tenantId, active: true },
    orderBy: { createdAt: "asc" },
  });

  if (anyActive) {
    if (isExecute) {
      await tx.inventoryWarehouse.update({
        where: { id: anyActive.id },
        data: { isDefault: true },
      });
    }
    return { warehouse: anyActive, action: "MARKED_OLDEST_AS_DEFAULT" };
  }

  if (isExecute) {
    const created = await tx.inventoryWarehouse.create({
      data: {
        tenantId,
        code: "MAIN",
        name: "Bodega principal",
        isDefault: true,
        active: true,
      },
    });
    return { warehouse: created, action: "CREATED_NEW" };
  }

  return {
    warehouse: { id: "(will-be-created)", code: "MAIN", name: "Bodega principal" },
    action: "CREATED_NEW",
  };
}

async function processTenant(tx, tenant, stats) {
  const tenantId = tenant.id;
  const tenantName = tenant.name || tenant.slug || tenantId;

  const { warehouse, action: warehouseAction } = await resolveDefaultWarehouse(tx, tenantId);
  stats.warehouseActions.push({ tenantName, warehouseAction, warehouseCode: warehouse.code });

  const products = await tx.lightweightProduct.findMany({
    where: {
      tenantId,
      trackInventory: true,
      type: { not: "SERVICE" },
    },
    select: {
      id: true,
      name: true,
      primaryCode: true,
      stock: true,
      type: true,
    },
  });

  const combos = products.filter((p) => p.type === "COMBO");
  const inventoriable = products.filter((p) => p.type !== "COMBO");

  stats.combosSkipped += combos.length;

  for (const product of inventoriable) {
    const existingBalance = await tx.inventoryStockBalance.findFirst({
      where: { tenantId, productId: product.id },
    });

    if (existingBalance) {
      stats.balancesAlreadyExist++;
      continue;
    }

    stats.balancesToCreate++;

    if (isExecute) {
      await tx.inventoryStockBalance.create({
        data: {
          tenantId,
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: new Decimal(product.stock),
        },
      });
    }

    if (product.stock !== 0) {
      const existingOpening = await tx.inventoryMovement.findFirst({
        where: {
          tenantId,
          productId: product.id,
          sourceType: "LEGACY_STOCK_BACKFILL",
          sourceId: product.id,
        },
      });

      if (existingOpening) {
        stats.openingsAlreadyExist++;
        continue;
      }

      stats.openingsToCreate++;

      if (isExecute) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: product.id,
            warehouseId: warehouse.id,
            direction: product.stock > 0 ? "IN" : "OUT",
            movementType: "OPENING",
            quantity: new Decimal(Math.abs(product.stock)),
            date: new Date(),
            sourceType: "LEGACY_STOCK_BACKFILL",
            sourceId: product.id,
            description: "Saldo inicial migrado desde inventario histórico de Facturom",
            createdByUserId: "system",
          },
        });
      }
    } else {
      stats.zeroStockNoOpening++;
    }
  }

  stats.productsProcessed += inventoriable.length;
}

async function validatePostBackfill(tenantId, tenantName, discrepancies) {
  const products = await prisma.lightweightProduct.findMany({
    where: {
      tenantId,
      trackInventory: true,
      type: "PRODUCT",
    },
    select: { id: true, name: true, primaryCode: true, stock: true },
  });

  for (const product of products) {
    const balances = await prisma.inventoryStockBalance.findMany({
      where: { tenantId, productId: product.id },
    });

    const warehouseTotal = balances.reduce(
      (sum, b) => sum + Number(b.quantity),
      0,
    );

    if (product.stock !== warehouseTotal) {
      discrepancies.push({
        tenant: tenantName,
        productId: product.id,
        productCode: product.primaryCode,
        productName: product.name,
        legacyStock: product.stock,
        warehouseStock: warehouseTotal,
        difference: product.stock - warehouseTotal,
      });
    }
  }
}

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`BACKFILL INVENTORY STOCK BALANCES — ${MODE}`);
  console.log(`${"=".repeat(60)}\n`);

  const tenants = await prisma.tenant.findMany({
    where: { status: "active" },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Tenants detectados: ${tenants.length}\n`);

  const globalStats = {
    tenantsProcessed: 0,
    tenantsFailed: 0,
    warehouseActions: [],
    productsProcessed: 0,
    balancesToCreate: 0,
    balancesAlreadyExist: 0,
    openingsToCreate: 0,
    openingsAlreadyExist: 0,
    combosSkipped: 0,
    zeroStockNoOpening: 0,
    failedTenants: [],
  };

  for (const tenant of tenants) {
    const tenantName = tenant.name || tenant.slug || tenant.id;
    const tenantStats = {
      warehouseActions: [],
      productsProcessed: 0,
      balancesToCreate: 0,
      balancesAlreadyExist: 0,
      openingsToCreate: 0,
      openingsAlreadyExist: 0,
      combosSkipped: 0,
      zeroStockNoOpening: 0,
    };

    try {
      if (isExecute) {
        await prisma.$transaction(
          async (tx) => {
            await processTenant(tx, tenant, tenantStats);
          },
          { timeout: 60000 },
        );
      } else {
        await processTenant(prisma, tenant, tenantStats);
      }

      globalStats.tenantsProcessed++;
      globalStats.warehouseActions.push(...tenantStats.warehouseActions);
      globalStats.productsProcessed += tenantStats.productsProcessed;
      globalStats.balancesToCreate += tenantStats.balancesToCreate;
      globalStats.balancesAlreadyExist += tenantStats.balancesAlreadyExist;
      globalStats.openingsToCreate += tenantStats.openingsToCreate;
      globalStats.openingsAlreadyExist += tenantStats.openingsAlreadyExist;
      globalStats.combosSkipped += tenantStats.combosSkipped;
      globalStats.zeroStockNoOpening += tenantStats.zeroStockNoOpening;

      console.log(`  ✓ ${tenantName}: ${tenantStats.productsProcessed} products, ${tenantStats.balancesToCreate} balances, ${tenantStats.openingsToCreate} openings`);
    } catch (err) {
      globalStats.tenantsFailed++;
      globalStats.failedTenants.push({ tenantName, error: err.message });
      console.error(`  ✗ ${tenantName}: ROLLBACK — ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("RESUMEN");
  console.log(`${"=".repeat(60)}`);
  console.log(`Mode:                     ${MODE}`);
  console.log(`Tenants procesados:       ${globalStats.tenantsProcessed}`);
  console.log(`Tenants fallidos:         ${globalStats.tenantsFailed}`);
  console.log(`Productos inventariables: ${globalStats.productsProcessed}`);
  console.log(`Combos excluidos:         ${globalStats.combosSkipped}`);
  console.log(`Balances a crear:         ${globalStats.balancesToCreate}`);
  console.log(`Balances ya existentes:   ${globalStats.balancesAlreadyExist}`);
  console.log(`Openings a crear:         ${globalStats.openingsToCreate}`);
  console.log(`Openings ya existentes:   ${globalStats.openingsAlreadyExist}`);
  console.log(`Stock cero (sin opening): ${globalStats.zeroStockNoOpening}`);

  console.log(`\nBodegas:`);
  for (const wa of globalStats.warehouseActions) {
    console.log(`  ${wa.tenantName}: ${wa.warehouseAction} (${wa.warehouseCode})`);
  }

  if (globalStats.failedTenants.length > 0) {
    console.log(`\nTenants fallidos:`);
    for (const ft of globalStats.failedTenants) {
      console.log(`  ${ft.tenantName}: ${ft.error}`);
    }
  }

  if (isExecute) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("VALIDACIÓN POST-BACKFILL (producto por producto)");
    console.log(`${"=".repeat(60)}`);

    const discrepancies = [];
    for (const tenant of tenants) {
      const tenantName = tenant.name || tenant.slug || tenant.id;
      const failed = globalStats.failedTenants.some((ft) => ft.tenantName === tenantName);
      if (failed) continue;
      await validatePostBackfill(tenant.id, tenantName, discrepancies);
    }

    if (discrepancies.length === 0) {
      console.log("\n  ✓ Todos los productos cuadran: LightweightProduct.stock === SUM(InventoryStockBalance.quantity)");
    } else {
      console.log(`\n  ✗ ${discrepancies.length} discrepancia(s) encontrada(s):`);
      for (const d of discrepancies) {
        console.log(`    ${d.tenant} | ${d.productCode || d.productId} "${d.productName}": legacy=${d.legacyStock} warehouse=${d.warehouseStock} diff=${d.difference}`);
      }
    }
  }

  console.log(`\n${"=".repeat(60)}\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
