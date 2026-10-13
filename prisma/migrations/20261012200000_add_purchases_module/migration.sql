-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add Purchases Module
-- NO EJECUTAR EN PRODUCCIÓN — pendiente de revisión.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enums
CREATE TYPE "PurchaseDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PURCHASE_SETTLEMENT', 'OTHER');
CREATE TYPE "PurchaseDocumentOrigin" AS ENUM ('MANUAL', 'XML_IMPORT', 'SRI_SYNC');
CREATE TYPE "PurchaseDocumentStatus" AS ENUM ('DRAFT', 'REGISTERED', 'AUTHORIZED', 'CANCELLED', 'REJECTED', 'NEEDS_REVIEW');
CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "PurchaseInboxStatus" AS ENUM ('NEW', 'CLASSIFIED', 'NEEDS_REVIEW', 'REGISTERED', 'IGNORED');
CREATE TYPE "PurchaseSriSyncStatus" AS ENUM ('DISABLED', 'PENDING_SETUP', 'ACTIVE', 'ERROR');
CREATE TYPE "DeductibilityStatus" AS ENUM ('UNREVIEWED', 'LIKELY_DEDUCTIBLE', 'LIKELY_NON_DEDUCTIBLE', 'REVIEW_REQUIRED', 'CONFIRMED_DEDUCTIBLE', 'CONFIRMED_NON_DEDUCTIBLE');
CREATE TYPE "WithholdingTaxType" AS ENUM ('RENTA', 'IVA');

-- Extend existing enums
ALTER TYPE "SriDocumentType" ADD VALUE 'PURCHASE_SETTLEMENT';
ALTER TYPE "SriDocumentSourceType" ADD VALUE 'PURCHASE_WITHHOLDING';
ALTER TYPE "SriDocumentSourceType" ADD VALUE 'PURCHASE_SETTLEMENT';
ALTER TYPE "FeatureKey" ADD VALUE 'purchase_sri_sync';
ALTER TYPE "LightweightStockMovementType" ADD VALUE 'purchase_receipt';

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseAccountingCategory
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseAccountingCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseAccountingCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseAccountingCategory_tenantId_name_key" ON "PurchaseAccountingCategory"("tenantId", "name");
CREATE INDEX "PurchaseAccountingCategory_tenantId_idx" ON "PurchaseAccountingCategory"("tenantId");
ALTER TABLE "PurchaseAccountingCategory" ADD CONSTRAINT "PurchaseAccountingCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseDocument
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "documentType" "PurchaseDocumentType" NOT NULL DEFAULT 'INVOICE',
    "supplierDocumentNumber" TEXT,
    "accessKey" TEXT,
    "authorizationNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "authorizationDate" TIMESTAMP(3),
    "subtotal0" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal15" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalNoTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalExempt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iceTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ivaTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "paymentTermDays" INTEGER,
    "dueDate" TIMESTAMP(3),
    "status" "PurchaseDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" "PurchaseDocumentOrigin" NOT NULL DEFAULT 'MANUAL',
    "xmlPath" TEXT,
    "ridePath" TEXT,
    "accountingCategoryId" TEXT,
    "deductibilityStatus" "DeductibilityStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "deductibilityReason" TEXT,
    "supplierName" TEXT,
    "supplierIdentification" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseDocument_tenantId_accessKey_key" ON "PurchaseDocument"("tenantId", "accessKey");
CREATE INDEX "PurchaseDocument_tenantId_idx" ON "PurchaseDocument"("tenantId");
CREATE INDEX "PurchaseDocument_tenantId_status_idx" ON "PurchaseDocument"("tenantId", "status");
CREATE INDEX "PurchaseDocument_tenantId_documentType_idx" ON "PurchaseDocument"("tenantId", "documentType");
CREATE INDEX "PurchaseDocument_tenantId_origin_idx" ON "PurchaseDocument"("tenantId", "origin");
CREATE INDEX "PurchaseDocument_tenantId_supplierId_idx" ON "PurchaseDocument"("tenantId", "supplierId");
CREATE INDEX "PurchaseDocument_tenantId_issueDate_idx" ON "PurchaseDocument"("tenantId", "issueDate");
CREATE INDEX "PurchaseDocument_createdByUserId_idx" ON "PurchaseDocument"("createdByUserId");
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "LightweightSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_accountingCategoryId_fkey" FOREIGN KEY ("accountingCategoryId") REFERENCES "PurchaseAccountingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseDocumentItem
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseDocumentItem" (
    "id" TEXT NOT NULL,
    "purchaseDocumentId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseDocumentItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseDocumentItem_purchaseDocumentId_idx" ON "PurchaseDocumentItem"("purchaseDocumentId");
ALTER TABLE "PurchaseDocumentItem" ADD CONSTRAINT "PurchaseDocumentItem_purchaseDocumentId_fkey" FOREIGN KEY ("purchaseDocumentId") REFERENCES "PurchaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseDocumentItem" ADD CONSTRAINT "PurchaseDocumentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchasePayment
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchasePayment" (
    "id" TEXT NOT NULL,
    "purchaseDocumentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchasePayment_purchaseDocumentId_idx" ON "PurchasePayment"("purchaseDocumentId");
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseDocumentId_fkey" FOREIGN KEY ("purchaseDocumentId") REFERENCES "PurchaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseReceipt
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseDocumentId" TEXT,
    "supplierId" TEXT,
    "warehouseId" TEXT,
    "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseReceipt_tenantId_idx" ON "PurchaseReceipt"("tenantId");
CREATE INDEX "PurchaseReceipt_tenantId_status_idx" ON "PurchaseReceipt"("tenantId", "status");
CREATE INDEX "PurchaseReceipt_purchaseDocumentId_idx" ON "PurchaseReceipt"("purchaseDocumentId");
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseDocumentId_fkey" FOREIGN KEY ("purchaseDocumentId") REFERENCES "PurchaseDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "LightweightSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseReceiptItem
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseReceiptItem" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityExpected" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "quantityReceived" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseReceiptItem_purchaseReceiptId_idx" ON "PurchaseReceiptItem"("purchaseReceiptId");
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseClassificationRule
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseClassificationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'contains',
    "value" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseClassificationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseClassificationRule_tenantId_idx" ON "PurchaseClassificationRule"("tenantId");
CREATE INDEX "PurchaseClassificationRule_tenantId_isActive_idx" ON "PurchaseClassificationRule"("tenantId", "isActive");
ALTER TABLE "PurchaseClassificationRule" ADD CONSTRAINT "PurchaseClassificationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseClassificationRule" ADD CONSTRAINT "PurchaseClassificationRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PurchaseAccountingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- TaxWithholdingCode
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "TaxWithholdingCode" (
    "id" TEXT NOT NULL,
    "taxType" "WithholdingTaxType" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxWithholdingCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaxWithholdingCode_taxType_code_key" ON "TaxWithholdingCode"("taxType", "code");
CREATE INDEX "TaxWithholdingCode_taxType_idx" ON "TaxWithholdingCode"("taxType");
CREATE INDEX "TaxWithholdingCode_isActive_idx" ON "TaxWithholdingCode"("isActive");

-- ═══════════════════════════════════════════════════════════════════════════
-- SriWithholdingLine
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "SriWithholdingLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "taxType" "WithholdingTaxType" NOT NULL,
    "withholdingCodeId" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "taxBase" DECIMAL(12,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "retainedAmount" DECIMAL(12,2) NOT NULL,
    "purchaseDocumentNumber" TEXT,
    "purchaseDocumentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SriWithholdingLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SriWithholdingLine_documentId_idx" ON "SriWithholdingLine"("documentId");
ALTER TABLE "SriWithholdingLine" ADD CONSTRAINT "SriWithholdingLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SriDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SriWithholdingLine" ADD CONSTRAINT "SriWithholdingLine_withholdingCodeId_fkey" FOREIGN KEY ("withholdingCodeId") REFERENCES "TaxWithholdingCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseInboxItem
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseInboxItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseDocumentId" TEXT,
    "accessKey" TEXT,
    "supplierName" TEXT,
    "supplierRuc" TEXT,
    "documentNumber" TEXT,
    "documentType" TEXT,
    "issueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ivaTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "suggestedCategory" TEXT,
    "suggestedDeductibility" "DeductibilityStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "status" "PurchaseInboxStatus" NOT NULL DEFAULT 'NEW',
    "xmlStorageKey" TEXT,
    "origin" "PurchaseDocumentOrigin" NOT NULL DEFAULT 'XML_IMPORT',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseInboxItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseInboxItem_purchaseDocumentId_key" ON "PurchaseInboxItem"("purchaseDocumentId");
CREATE INDEX "PurchaseInboxItem_tenantId_idx" ON "PurchaseInboxItem"("tenantId");
CREATE INDEX "PurchaseInboxItem_tenantId_status_idx" ON "PurchaseInboxItem"("tenantId", "status");
CREATE INDEX "PurchaseInboxItem_tenantId_accessKey_idx" ON "PurchaseInboxItem"("tenantId", "accessKey");
ALTER TABLE "PurchaseInboxItem" ADD CONSTRAINT "PurchaseInboxItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseInboxItem" ADD CONSTRAINT "PurchaseInboxItem_purchaseDocumentId_fkey" FOREIGN KEY ("purchaseDocumentId") REFERENCES "PurchaseDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PurchaseSriSyncConfig
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "PurchaseSriSyncConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "PurchaseSriSyncStatus" NOT NULL DEFAULT 'DISABLED',
    "provider" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "autoClassify" BOOLEAN NOT NULL DEFAULT false,
    "autoDetectDeductibility" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseSriSyncConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseSriSyncConfig_tenantId_key" ON "PurchaseSriSyncConfig"("tenantId");
ALTER TABLE "PurchaseSriSyncConfig" ADD CONSTRAINT "PurchaseSriSyncConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
