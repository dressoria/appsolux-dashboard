-- CreateEnum
CREATE TYPE "InventoryMovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING', 'SALE', 'SALE_RETURN', 'PURCHASE_RECEIPT', 'PURCHASE_RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'PHYSICAL_COUNT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'COMBO_CONSUMPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryPhysicalCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryTransferStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentGuideStatus" AS ENUM ('DRAFT', 'ISSUED', 'REFERRAL_GUIDE_SRI_PENDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryValuationMethod" AS ENUM ('WEIGHTED_AVERAGE', 'FIFO');

-- CreateEnum
CREATE TYPE "ProductTaxCategory" AS ENUM ('TAXABLE', 'ZERO', 'NON_OBJECT', 'EXEMPT');

-- CreateEnum
CREATE TYPE "WarrantyUnit" AS ENUM ('DAYS', 'MONTHS', 'YEARS');

-- AlterTable: Add new columns to LightweightProduct
ALTER TABLE "LightweightProduct" ADD COLUMN "price4" DECIMAL(12,2);
ALTER TABLE "LightweightProduct" ADD COLUMN "auxiliaryTransportCode" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "imageStorageKey" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "defaultWarehouseId" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "unitId" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "brandId" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "salesAccountId" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "inventoryAccountId" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "cogsAccountId" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "purchaseAccountId" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "taxCategory" "ProductTaxCategory";
ALTER TABLE "LightweightProduct" ADD COLUMN "color" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "additionalComment" TEXT;
ALTER TABLE "LightweightProduct" ADD COLUMN "isProcessed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LightweightProduct" ADD COLUMN "warrantyDuration" INTEGER;
ALTER TABLE "LightweightProduct" ADD COLUMN "warrantyUnit" "WarrantyUnit";

-- CreateTable: InventoryBrand
CREATE TABLE "InventoryBrand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryUnit
CREATE TABLE "InventoryUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryWarehouse
CREATE TABLE "InventoryWarehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryStockBalance
CREATE TABLE "InventoryStockBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryMovement
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "direction" "InventoryMovementDirection" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "transferGroupId" TEXT,
    "unitCost" DECIMAL(14,4),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryPhysicalCount
CREATE TABLE "InventoryPhysicalCount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InventoryPhysicalCountStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPhysicalCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryPhysicalCountItem
CREATE TABLE "InventoryPhysicalCountItem" (
    "id" TEXT NOT NULL,
    "physicalCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQuantity" DECIMAL(14,4) NOT NULL,
    "countedQuantity" DECIMAL(14,4),
    "difference" DECIMAL(14,4),
    "unitCost" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPhysicalCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryTransfer
CREATE TABLE "InventoryTransfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryTransferItem
CREATE TABLE "InventoryTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "InventoryTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryVehicle
CREATE TABLE "InventoryVehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "color" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ShipmentGuide
CREATE TABLE "ShipmentGuide" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ShipmentGuideStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "startTransportDate" TIMESTAMP(3) NOT NULL,
    "endTransportDate" TIMESTAMP(3),
    "originAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "route" TEXT,
    "reason" TEXT NOT NULL,
    "carrierIdentification" TEXT,
    "carrierName" TEXT,
    "vehicleId" TEXT,
    "sourceWarehouseId" TEXT,
    "saleId" TEXT,
    "transferId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ShipmentGuideItem
CREATE TABLE "ShipmentGuideItem" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "ShipmentGuideItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryOrder
CREATE TABLE "InventoryOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" "InventoryOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryOrderItem
CREATE TABLE "InventoryOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(14,4) NOT NULL,
    "receivedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "unitCostEstimate" DECIMAL(14,4),

    CONSTRAINT "InventoryOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProductPriceChange
CREATE TABLE "ProductPriceChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "oldPrice" DECIMAL(12,2) NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventorySettings
CREATE TABLE "InventorySettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "defaultWarehouseId" TEXT,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "valuationMethod" "InventoryValuationMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "catalogShowBrand" BOOLEAN NOT NULL DEFAULT true,
    "catalogShowUnit" BOOLEAN NOT NULL DEFAULT false,
    "catalogShowStock" BOOLEAN NOT NULL DEFAULT false,
    "catalogShowPrice" BOOLEAN NOT NULL DEFAULT true,
    "catalogShowCode" BOOLEAN NOT NULL DEFAULT true,
    "catalogOrientation" TEXT NOT NULL DEFAULT 'vertical',
    "catalogAccentColor" TEXT,
    "catalogHeaderAll" BOOLEAN NOT NULL DEFAULT true,
    "barcodeFormat" TEXT NOT NULL DEFAULT 'A4',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryBrand_tenantId_idx" ON "InventoryBrand"("tenantId");
CREATE UNIQUE INDEX "InventoryBrand_tenantId_name_key" ON "InventoryBrand"("tenantId", "name");

CREATE INDEX "InventoryUnit_tenantId_idx" ON "InventoryUnit"("tenantId");
CREATE UNIQUE INDEX "InventoryUnit_tenantId_code_key" ON "InventoryUnit"("tenantId", "code");

CREATE INDEX "InventoryWarehouse_tenantId_idx" ON "InventoryWarehouse"("tenantId");
CREATE UNIQUE INDEX "InventoryWarehouse_tenantId_code_key" ON "InventoryWarehouse"("tenantId", "code");

CREATE INDEX "InventoryStockBalance_tenantId_idx" ON "InventoryStockBalance"("tenantId");
CREATE INDEX "InventoryStockBalance_warehouseId_idx" ON "InventoryStockBalance"("warehouseId");
CREATE INDEX "InventoryStockBalance_productId_idx" ON "InventoryStockBalance"("productId");
CREATE UNIQUE INDEX "InventoryStockBalance_tenantId_warehouseId_productId_key" ON "InventoryStockBalance"("tenantId", "warehouseId", "productId");

CREATE INDEX "InventoryMovement_tenantId_idx" ON "InventoryMovement"("tenantId");
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");
CREATE INDEX "InventoryMovement_warehouseId_idx" ON "InventoryMovement"("warehouseId");
CREATE INDEX "InventoryMovement_tenantId_productId_warehouseId_date_idx" ON "InventoryMovement"("tenantId", "productId", "warehouseId", "date");
CREATE INDEX "InventoryMovement_tenantId_sourceType_sourceId_idx" ON "InventoryMovement"("tenantId", "sourceType", "sourceId");
CREATE INDEX "InventoryMovement_transferGroupId_idx" ON "InventoryMovement"("transferGroupId");

CREATE INDEX "InventoryPhysicalCount_tenantId_idx" ON "InventoryPhysicalCount"("tenantId");
CREATE UNIQUE INDEX "InventoryPhysicalCount_tenantId_number_key" ON "InventoryPhysicalCount"("tenantId", "number");

CREATE INDEX "InventoryPhysicalCountItem_physicalCountId_idx" ON "InventoryPhysicalCountItem"("physicalCountId");
CREATE UNIQUE INDEX "InventoryPhysicalCountItem_physicalCountId_productId_key" ON "InventoryPhysicalCountItem"("physicalCountId", "productId");

CREATE INDEX "InventoryTransfer_tenantId_idx" ON "InventoryTransfer"("tenantId");
CREATE UNIQUE INDEX "InventoryTransfer_tenantId_number_key" ON "InventoryTransfer"("tenantId", "number");

CREATE INDEX "InventoryTransferItem_transferId_idx" ON "InventoryTransferItem"("transferId");
CREATE UNIQUE INDEX "InventoryTransferItem_transferId_productId_key" ON "InventoryTransferItem"("transferId", "productId");

CREATE INDEX "InventoryVehicle_tenantId_idx" ON "InventoryVehicle"("tenantId");
CREATE UNIQUE INDEX "InventoryVehicle_tenantId_plate_key" ON "InventoryVehicle"("tenantId", "plate");

CREATE INDEX "ShipmentGuide_tenantId_idx" ON "ShipmentGuide"("tenantId");
CREATE INDEX "ShipmentGuide_tenantId_issueDate_idx" ON "ShipmentGuide"("tenantId", "issueDate");
CREATE UNIQUE INDEX "ShipmentGuide_tenantId_number_key" ON "ShipmentGuide"("tenantId", "number");

CREATE INDEX "ShipmentGuideItem_guideId_idx" ON "ShipmentGuideItem"("guideId");

CREATE INDEX "InventoryOrder_tenantId_idx" ON "InventoryOrder"("tenantId");
CREATE UNIQUE INDEX "InventoryOrder_tenantId_number_key" ON "InventoryOrder"("tenantId", "number");

CREATE INDEX "InventoryOrderItem_orderId_idx" ON "InventoryOrderItem"("orderId");
CREATE UNIQUE INDEX "InventoryOrderItem_orderId_productId_key" ON "InventoryOrderItem"("orderId", "productId");

CREATE INDEX "ProductPriceChange_tenantId_idx" ON "ProductPriceChange"("tenantId");
CREATE INDEX "ProductPriceChange_productId_idx" ON "ProductPriceChange"("productId");
CREATE INDEX "ProductPriceChange_tenantId_createdAt_idx" ON "ProductPriceChange"("tenantId", "createdAt");

CREATE UNIQUE INDEX "InventorySettings_tenantId_key" ON "InventorySettings"("tenantId");

CREATE INDEX "LightweightProduct_brandId_idx" ON "LightweightProduct"("brandId");
CREATE INDEX "LightweightProduct_unitId_idx" ON "LightweightProduct"("unitId");

-- AddForeignKey: LightweightProduct new relations
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "InventoryUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "InventoryBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_salesAccountId_fkey" FOREIGN KEY ("salesAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_cogsAccountId_fkey" FOREIGN KEY ("cogsAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_purchaseAccountId_fkey" FOREIGN KEY ("purchaseAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: InventoryBrand
ALTER TABLE "InventoryBrand" ADD CONSTRAINT "InventoryBrand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryUnit
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryWarehouse
ALTER TABLE "InventoryWarehouse" ADD CONSTRAINT "InventoryWarehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryStockBalance
ALTER TABLE "InventoryStockBalance" ADD CONSTRAINT "InventoryStockBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockBalance" ADD CONSTRAINT "InventoryStockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockBalance" ADD CONSTRAINT "InventoryStockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryMovement
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryPhysicalCount
ALTER TABLE "InventoryPhysicalCount" ADD CONSTRAINT "InventoryPhysicalCount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryPhysicalCount" ADD CONSTRAINT "InventoryPhysicalCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryPhysicalCountItem
ALTER TABLE "InventoryPhysicalCountItem" ADD CONSTRAINT "InventoryPhysicalCountItem_physicalCountId_fkey" FOREIGN KEY ("physicalCountId") REFERENCES "InventoryPhysicalCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryPhysicalCountItem" ADD CONSTRAINT "InventoryPhysicalCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryTransfer
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryTransferItem
ALTER TABLE "InventoryTransferItem" ADD CONSTRAINT "InventoryTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "InventoryTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryTransferItem" ADD CONSTRAINT "InventoryTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventoryVehicle
ALTER TABLE "InventoryVehicle" ADD CONSTRAINT "InventoryVehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ShipmentGuide
ALTER TABLE "ShipmentGuide" ADD CONSTRAINT "ShipmentGuide_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentGuide" ADD CONSTRAINT "ShipmentGuide_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "InventoryVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentGuide" ADD CONSTRAINT "ShipmentGuide_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ShipmentGuideItem
ALTER TABLE "ShipmentGuideItem" ADD CONSTRAINT "ShipmentGuideItem_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "ShipmentGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentGuideItem" ADD CONSTRAINT "ShipmentGuideItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: InventoryOrder
ALTER TABLE "InventoryOrder" ADD CONSTRAINT "InventoryOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryOrder" ADD CONSTRAINT "InventoryOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryOrder" ADD CONSTRAINT "InventoryOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "LightweightSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: InventoryOrderItem
ALTER TABLE "InventoryOrderItem" ADD CONSTRAINT "InventoryOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "InventoryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryOrderItem" ADD CONSTRAINT "InventoryOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProductPriceChange
ALTER TABLE "ProductPriceChange" ADD CONSTRAINT "ProductPriceChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPriceChange" ADD CONSTRAINT "ProductPriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: InventorySettings
ALTER TABLE "InventorySettings" ADD CONSTRAINT "InventorySettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventorySettings" ADD CONSTRAINT "InventorySettings_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
