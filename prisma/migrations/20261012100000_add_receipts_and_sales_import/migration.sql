-- CreateEnum
CREATE TYPE "LightweightSaleOrigin" AS ENUM ('NORMAL', 'POS', 'IMPORT');

-- CreateEnum
CREATE TYPE "SalesImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- AlterTable: add origin, externalReference, originalIssuedAt, importBatchId to LightweightSale
ALTER TABLE "LightweightSale" ADD COLUMN "origin" "LightweightSaleOrigin" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "LightweightSale" ADD COLUMN "externalReference" TEXT;
ALTER TABLE "LightweightSale" ADD COLUMN "originalIssuedAt" TIMESTAMP(3);
ALTER TABLE "LightweightSale" ADD COLUMN "importBatchId" TEXT;

-- CreateIndex
CREATE INDEX "LightweightSale_tenantId_origin_idx" ON "LightweightSale"("tenantId", "origin");

-- CreateIndex
CREATE INDEX "LightweightSale_importBatchId_idx" ON "LightweightSale"("importBatchId");

-- CreateTable
CREATE TABLE "SalesImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'xlsx',
    "status" "SalesImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "importedSales" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SalesImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesImportBatch_tenantId_idx" ON "SalesImportBatch"("tenantId");

-- CreateIndex
CREATE INDEX "SalesImportBatch_createdByUserId_idx" ON "SalesImportBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "SalesImportBatch_tenantId_status_idx" ON "SalesImportBatch"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "LightweightSale" ADD CONSTRAINT "LightweightSale_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "SalesImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesImportBatch" ADD CONSTRAINT "SalesImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesImportBatch" ADD CONSTRAINT "SalesImportBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
