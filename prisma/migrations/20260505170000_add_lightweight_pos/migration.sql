-- CreateEnum
CREATE TYPE "LightweightSaleStatus" AS ENUM ('open', 'paid', 'canceled');

-- CreateEnum
CREATE TYPE "LightweightPaymentStatus" AS ENUM ('paid', 'pending', 'partial');

-- CreateEnum
CREATE TYPE "LightweightPaymentMethod" AS ENUM ('cash', 'transfer', 'card', 'credit');

-- CreateEnum
CREATE TYPE "LightweightStockMovementType" AS ENUM ('sale', 'adjustment');

-- CreateTable
CREATE TABLE "LightweightProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER,
    "barcode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LightweightProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightweightCustomer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LightweightCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightweightSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" "LightweightSaleStatus" NOT NULL DEFAULT 'paid',
    "total" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "LightweightPaymentStatus" NOT NULL DEFAULT 'paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LightweightSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightweightSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "LightweightSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightweightPayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "LightweightPaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LightweightPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightweightStockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "LightweightStockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LightweightStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LightweightProduct_tenantId_idx" ON "LightweightProduct"("tenantId");

-- CreateIndex
CREATE INDEX "LightweightProduct_tenantId_name_idx" ON "LightweightProduct"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LightweightProduct_tenantId_barcode_idx" ON "LightweightProduct"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "LightweightCustomer_tenantId_idx" ON "LightweightCustomer"("tenantId");

-- CreateIndex
CREATE INDEX "LightweightCustomer_tenantId_name_idx" ON "LightweightCustomer"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LightweightSale_tenantId_idx" ON "LightweightSale"("tenantId");

-- CreateIndex
CREATE INDEX "LightweightSale_tenantId_status_idx" ON "LightweightSale"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LightweightSale_customerId_idx" ON "LightweightSale"("customerId");

-- CreateIndex
CREATE INDEX "LightweightSale_createdAt_idx" ON "LightweightSale"("createdAt");

-- CreateIndex
CREATE INDEX "LightweightSaleItem_saleId_idx" ON "LightweightSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "LightweightSaleItem_productId_idx" ON "LightweightSaleItem"("productId");

-- CreateIndex
CREATE INDEX "LightweightPayment_saleId_idx" ON "LightweightPayment"("saleId");

-- CreateIndex
CREATE INDEX "LightweightPayment_method_idx" ON "LightweightPayment"("method");

-- CreateIndex
CREATE INDEX "LightweightStockMovement_tenantId_idx" ON "LightweightStockMovement"("tenantId");

-- CreateIndex
CREATE INDEX "LightweightStockMovement_productId_idx" ON "LightweightStockMovement"("productId");

-- CreateIndex
CREATE INDEX "LightweightStockMovement_type_idx" ON "LightweightStockMovement"("type");

-- AddForeignKey
ALTER TABLE "LightweightProduct" ADD CONSTRAINT "LightweightProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightCustomer" ADD CONSTRAINT "LightweightCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightSale" ADD CONSTRAINT "LightweightSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightSale" ADD CONSTRAINT "LightweightSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "LightweightCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightSaleItem" ADD CONSTRAINT "LightweightSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "LightweightSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightSaleItem" ADD CONSTRAINT "LightweightSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightPayment" ADD CONSTRAINT "LightweightPayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "LightweightSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightStockMovement" ADD CONSTRAINT "LightweightStockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LightweightStockMovement" ADD CONSTRAINT "LightweightStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
