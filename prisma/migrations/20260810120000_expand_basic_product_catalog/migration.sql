CREATE TYPE "LightweightProductType" AS ENUM ('PRODUCT', 'SERVICE', 'COMBO');
CREATE TYPE "LightweightProductUnit" AS ENUM ('UNIT', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER', 'METER', 'HOUR', 'SERVICE');

ALTER TABLE "LightweightProduct"
ADD COLUMN "type" "LightweightProductType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN "primaryCode" TEXT,
ADD COLUMN "auxiliaryCode" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "price2" DECIMAL(12,2),
ADD COLUMN "price3" DECIMAL(12,2),
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "unit" "LightweightProductUnit" NOT NULL DEFAULT 'UNIT',
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "iceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "iceCode" TEXT,
ADD COLUMN "iceRate" DECIMAL(7,4);

UPDATE "LightweightProduct"
SET "primaryCode" = 'PROD-' || UPPER(SUBSTRING(id, 1, 8));

CREATE TABLE "LightweightProductCategory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LightweightProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LightweightComboItem" (
  "id" TEXT NOT NULL,
  "comboProductId" TEXT NOT NULL,
  "componentProductId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LightweightComboItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LightweightProduct_tenantId_primaryCode_key" ON "LightweightProduct"("tenantId", "primaryCode");
DROP INDEX IF EXISTS "LightweightProduct_tenantId_barcode_idx";
CREATE UNIQUE INDEX "LightweightProduct_tenantId_barcode_key" ON "LightweightProduct"("tenantId", "barcode");
CREATE INDEX "LightweightProduct_tenantId_type_isActive_idx" ON "LightweightProduct"("tenantId", "type", "isActive");
CREATE UNIQUE INDEX "LightweightProductCategory_tenantId_name_key" ON "LightweightProductCategory"("tenantId", "name");
CREATE INDEX "LightweightProductCategory_tenantId_idx" ON "LightweightProductCategory"("tenantId");
CREATE UNIQUE INDEX "LightweightComboItem_comboProductId_componentProductId_key" ON "LightweightComboItem"("comboProductId", "componentProductId");
CREATE INDEX "LightweightComboItem_componentProductId_idx" ON "LightweightComboItem"("componentProductId");

ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LightweightProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProductCategory" ADD CONSTRAINT "LightweightProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LightweightComboItem" ADD CONSTRAINT "LightweightComboItem_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LightweightComboItem" ADD CONSTRAINT "LightweightComboItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "LightweightProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
