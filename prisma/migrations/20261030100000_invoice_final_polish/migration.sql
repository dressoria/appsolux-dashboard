-- AlterEnum: extend LightweightPaymentMethod with new values
ALTER TYPE "LightweightPaymentMethod" ADD VALUE IF NOT EXISTS 'check';
ALTER TYPE "LightweightPaymentMethod" ADD VALUE IF NOT EXISTS 'deposit';
ALTER TYPE "LightweightPaymentMethod" ADD VALUE IF NOT EXISTS 'debit_card';
ALTER TYPE "LightweightPaymentMethod" ADD VALUE IF NOT EXISTS 'credit_card';

-- CreateEnum: InvoiceKind
CREATE TYPE "InvoiceKind" AS ENUM ('NORMAL', 'EXPORT', 'REIMBURSEMENT');

-- CreateEnum: SalesInvoiceDraftStatus
CREATE TYPE "SalesInvoiceDraftStatus" AS ENUM ('DRAFT', 'CONVERTED', 'CANCELLED');

-- AlterTable: LightweightSale - add new columns
ALTER TABLE "LightweightSale" ADD COLUMN "warehouseId" TEXT;
ALTER TABLE "LightweightSale" ADD COLUMN "invoiceKind" "InvoiceKind" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "LightweightSale" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "LightweightSale" ADD COLUMN "shipmentGuideId" TEXT;
ALTER TABLE "LightweightSale" ADD COLUMN "exportData" JSONB;
ALTER TABLE "LightweightSale" ADD COLUMN "reimbursementData" JSONB;
ALTER TABLE "LightweightSale" ADD COLUMN "establishmentId" TEXT;
ALTER TABLE "LightweightSale" ADD COLUMN "issuePointId" TEXT;

-- AlterTable: LightweightSaleItem - add unitCost and taxCategory
ALTER TABLE "LightweightSaleItem" ADD COLUMN "unitCost" DECIMAL(14,6);
ALTER TABLE "LightweightSaleItem" ADD COLUMN "taxCategory" "ProductTaxCategory";

-- AlterTable: LightweightPayment - add detail fields
ALTER TABLE "LightweightPayment" ADD COLUMN "treasuryAccountId" TEXT;
ALTER TABLE "LightweightPayment" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "LightweightPayment" ADD COLUMN "batchNumber" TEXT;
ALTER TABLE "LightweightPayment" ADD COLUMN "voucherNumber" TEXT;
ALTER TABLE "LightweightPayment" ADD COLUMN "dueDate" TIMESTAMP(3);

-- AlterTable: SriDocumentLine - add taxCategory
ALTER TABLE "SriDocumentLine" ADD COLUMN "taxCategory" "ProductTaxCategory";

-- CreateTable: SriDocumentPayment
CREATE TABLE "SriDocumentPayment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "commercialMethod" TEXT NOT NULL,
    "sriPaymentCode" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "termDays" INTEGER NOT NULL DEFAULT 0,
    "timeUnit" TEXT NOT NULL DEFAULT 'dias',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SriDocumentPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SriDocumentPayment_documentId_idx" ON "SriDocumentPayment"("documentId");
ALTER TABLE "SriDocumentPayment" ADD CONSTRAINT "SriDocumentPayment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SriDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SalesInvoiceDraft
CREATE TABLE "SalesInvoiceDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "SalesInvoiceDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "convertedSaleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInvoiceDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesInvoiceDraft_tenantId_idx" ON "SalesInvoiceDraft"("tenantId");
CREATE INDEX "SalesInvoiceDraft_tenantId_createdByUserId_idx" ON "SalesInvoiceDraft"("tenantId", "createdByUserId");
CREATE INDEX "SalesInvoiceDraft_tenantId_status_idx" ON "SalesInvoiceDraft"("tenantId", "status");
ALTER TABLE "SalesInvoiceDraft" ADD CONSTRAINT "SalesInvoiceDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
