-- CreateEnum
CREATE TYPE "ErpPriceChannel" AS ENUM ('RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'MANUAL');

-- CreateEnum
CREATE TYPE "QuickInvoiceDraftStatus" AS ENUM ('ANALYZED', 'DRAFT_CREATED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ErpProductPricing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT,
    "retailPrice" DECIMAL(12,2) NOT NULL,
    "wholesalePrice" DECIMAL(12,2),
    "distributorPrice" DECIMAL(12,2),
    "notes" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpProductPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickInvoiceDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" "QuickInvoiceDraftStatus" NOT NULL DEFAULT 'ANALYZED',
    "rawMessage" TEXT NOT NULL,
    "parsedData" JSONB NOT NULL,
    "warnings" JSONB,
    "salesOrderName" TEXT,
    "salesInvoiceName" TEXT,
    "customerName" TEXT,
    "customerTaxId" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "companyName" TEXT,
    "priceChannel" "ErpPriceChannel",
    "totalAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickInvoiceDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpProductPricing_tenantId_itemCode_key" ON "ErpProductPricing"("tenantId", "itemCode");

-- CreateIndex
CREATE INDEX "ErpProductPricing_tenantId_idx" ON "ErpProductPricing"("tenantId");

-- CreateIndex
CREATE INDEX "ErpProductPricing_itemCode_idx" ON "ErpProductPricing"("itemCode");

-- CreateIndex
CREATE INDEX "QuickInvoiceDraft_tenantId_idx" ON "QuickInvoiceDraft"("tenantId");

-- CreateIndex
CREATE INDEX "QuickInvoiceDraft_createdByUserId_idx" ON "QuickInvoiceDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "QuickInvoiceDraft_status_idx" ON "QuickInvoiceDraft"("status");

-- CreateIndex
CREATE INDEX "QuickInvoiceDraft_salesOrderName_idx" ON "QuickInvoiceDraft"("salesOrderName");

-- CreateIndex
CREATE INDEX "QuickInvoiceDraft_salesInvoiceName_idx" ON "QuickInvoiceDraft"("salesInvoiceName");

-- AddForeignKey
ALTER TABLE "ErpProductPricing" ADD CONSTRAINT "ErpProductPricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickInvoiceDraft" ADD CONSTRAINT "QuickInvoiceDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
