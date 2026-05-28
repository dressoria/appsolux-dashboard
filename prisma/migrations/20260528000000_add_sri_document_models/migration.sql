-- CreateEnum
CREATE TYPE "SriDocumentSourceType" AS ENUM ('BASIC_SALE', 'ERP_SALES_INVOICE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SriDocumentStatus" AS ENUM ('DRAFT', 'READY_FOR_TESTING', 'VALIDATION_ERROR', 'SIGNED', 'SENT', 'AUTHORIZED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SriDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "SriDocumentSourceType" NOT NULL,
    "sourceId" TEXT,
    "documentType" "SriDocumentType" NOT NULL,
    "status" "SriDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "environment" "SriEnvironment" NOT NULL DEFAULT 'TEST',
    "establishmentId" TEXT NOT NULL,
    "issuePointId" TEXT NOT NULL,
    "sequenceId" TEXT,
    "sequentialNumber" INTEGER,
    "accessKey" TEXT,
    "customerName" TEXT NOT NULL,
    "customerIdentification" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriDocumentLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemCode" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SriDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SriDocument_tenantId_idx" ON "SriDocument"("tenantId");

-- CreateIndex
CREATE INDEX "SriDocument_tenantId_status_idx" ON "SriDocument"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SriDocument_tenantId_sourceType_sourceId_idx" ON "SriDocument"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "SriDocument_establishmentId_idx" ON "SriDocument"("establishmentId");

-- CreateIndex
CREATE INDEX "SriDocument_issuePointId_idx" ON "SriDocument"("issuePointId");

-- CreateIndex
CREATE INDEX "SriDocument_createdAt_idx" ON "SriDocument"("createdAt");

-- CreateIndex
CREATE INDEX "SriDocumentLine_documentId_idx" ON "SriDocumentLine"("documentId");

-- AddForeignKey
ALTER TABLE "SriDocument" ADD CONSTRAINT "SriDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriDocument" ADD CONSTRAINT "SriDocument_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "SriEstablishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriDocument" ADD CONSTRAINT "SriDocument_issuePointId_fkey" FOREIGN KEY ("issuePointId") REFERENCES "SriIssuePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriDocumentLine" ADD CONSTRAINT "SriDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SriDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
