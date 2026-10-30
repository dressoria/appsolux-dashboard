-- CreateEnum
CREATE TYPE "SalesExternalSource" AS ENUM ('MANUAL_IMPORT', 'API', 'TELEGRAM', 'SRI_FACTURADOR', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesExternalDocumentStatus" AS ENUM ('IMPORTED', 'NEEDS_REVIEW', 'DUPLICATE', 'ERROR');

-- CreateEnum
CREATE TYPE "SalesExternalDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "SalesSriSyncJobType" AS ENUM ('VERIFY_CONNECTION', 'SYNC_ISSUED_DOCUMENTS');

-- CreateEnum
CREATE TYPE "SalesSriSyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'HUMAN_VERIFICATION_REQUIRED');

-- AlterEnum
ALTER TYPE "FeatureKey" ADD VALUE 'sales_auto_sync';

-- AlterTable
ALTER TABLE "SalesImportBatch" ADD COLUMN "totalDocuments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SalesImportBatch" ALTER COLUMN "sourceType" SET DEFAULT 'XLSX';

-- CreateTable
CREATE TABLE "ExternalSalesDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" "SalesExternalSource" NOT NULL,
    "sourceExternalId" TEXT,
    "documentType" "SalesExternalDocumentType" NOT NULL DEFAULT 'INVOICE',
    "documentNumber" TEXT NOT NULL,
    "accessKey" TEXT,
    "authorizationDate" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3) NOT NULL,
    "customerIdentificationType" TEXT,
    "customerIdentification" TEXT,
    "customerName" TEXT NOT NULL,
    "customerId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "observation" TEXT,
    "status" "SalesExternalDocumentStatus" NOT NULL DEFAULT 'IMPORTED',
    "rawPayload" JSONB,
    "importBatchId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSalesDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSalesDocumentItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "productId" TEXT,
    "productCode" TEXT,
    "productName" TEXT,
    "taxCategory" "ProductTaxCategory",
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(14,6) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalSalesDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAutoSyncSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sriEnabled" BOOLEAN NOT NULL DEFAULT false,
    "apiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAutoSyncSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesIngestToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "source" "SalesExternalSource" NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesIngestToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesSriSyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "SalesSriSyncJobType" NOT NULL,
    "status" "SalesSriSyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedByUserId" TEXT,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "documentsFound" INTEGER NOT NULL DEFAULT 0,
    "documentsImported" INTEGER NOT NULL DEFAULT 0,
    "documentsSkipped" INTEGER NOT NULL DEFAULT 0,
    "documentsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesSriSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSalesDocument_tenantId_accessKey_key" ON "ExternalSalesDocument"("tenantId", "accessKey");
CREATE UNIQUE INDEX "ExternalSalesDocument_tenantId_documentType_documentNumber_key" ON "ExternalSalesDocument"("tenantId", "documentType", "documentNumber");
CREATE UNIQUE INDEX "ExternalSalesDocument_tenantId_source_sourceExternalId_key" ON "ExternalSalesDocument"("tenantId", "source", "sourceExternalId");
CREATE INDEX "ExternalSalesDocument_tenantId_idx" ON "ExternalSalesDocument"("tenantId");
CREATE INDEX "ExternalSalesDocument_tenantId_source_idx" ON "ExternalSalesDocument"("tenantId", "source");
CREATE INDEX "ExternalSalesDocument_tenantId_status_idx" ON "ExternalSalesDocument"("tenantId", "status");
CREATE INDEX "ExternalSalesDocument_tenantId_issueDate_idx" ON "ExternalSalesDocument"("tenantId", "issueDate");
CREATE INDEX "ExternalSalesDocument_importBatchId_idx" ON "ExternalSalesDocument"("importBatchId");

-- CreateIndex
CREATE INDEX "ExternalSalesDocumentItem_documentId_idx" ON "ExternalSalesDocumentItem"("documentId");
CREATE INDEX "ExternalSalesDocumentItem_productId_idx" ON "ExternalSalesDocumentItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAutoSyncSettings_tenantId_key" ON "SalesAutoSyncSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesIngestToken_tokenHash_key" ON "SalesIngestToken"("tokenHash");
CREATE INDEX "SalesIngestToken_tenantId_idx" ON "SalesIngestToken"("tenantId");
CREATE INDEX "SalesIngestToken_tokenHash_idx" ON "SalesIngestToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SalesSriSyncJob_tenantId_idx" ON "SalesSriSyncJob"("tenantId");
CREATE INDEX "SalesSriSyncJob_status_idx" ON "SalesSriSyncJob"("status");
CREATE INDEX "SalesSriSyncJob_tenantId_status_idx" ON "SalesSriSyncJob"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "ExternalSalesDocument" ADD CONSTRAINT "ExternalSalesDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalSalesDocument" ADD CONSTRAINT "ExternalSalesDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "LightweightCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalSalesDocument" ADD CONSTRAINT "ExternalSalesDocument_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "SalesImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSalesDocumentItem" ADD CONSTRAINT "ExternalSalesDocumentItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ExternalSalesDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalSalesDocumentItem" ADD CONSTRAINT "ExternalSalesDocumentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAutoSyncSettings" ADD CONSTRAINT "SalesAutoSyncSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesIngestToken" ADD CONSTRAINT "SalesIngestToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSriSyncJob" ADD CONSTRAINT "SalesSriSyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
