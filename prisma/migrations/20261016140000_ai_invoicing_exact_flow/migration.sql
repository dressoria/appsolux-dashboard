-- AlterEnum: add SAVED and CONVERTING to AiInvoiceDraftStatus
ALTER TYPE "AiInvoiceDraftStatus" ADD VALUE 'SAVED';
ALTER TYPE "AiInvoiceDraftStatus" ADD VALUE 'CONVERTING';

-- AlterTable: add new fields to AiInvoiceDraft
ALTER TABLE "AiInvoiceDraft" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "AiInvoiceDraft" ADD COLUMN "sriPaymentCode" TEXT;
ALTER TABLE "AiInvoiceDraft" ADD COLUMN "batchId" TEXT;
ALTER TABLE "AiInvoiceDraft" ADD COLUMN "batchPosition" INTEGER;
ALTER TABLE "AiInvoiceDraft" ADD COLUMN "convertedSaleId" TEXT;
ALTER TABLE "AiInvoiceDraft" ADD COLUMN "convertedAt" TIMESTAMP(3);
ALTER TABLE "AiInvoiceDraft" ADD COLUMN "savedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AiInvoiceDraft_tenantId_status_idx" ON "AiInvoiceDraft"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AiInvoiceDraft_batchId_idx" ON "AiInvoiceDraft"("batchId");

-- AlterTable: widen LightweightSaleItem.price from Decimal(12,2) to Decimal(14,6)
ALTER TABLE "LightweightSaleItem" ALTER COLUMN "price" TYPE DECIMAL(14,6);
