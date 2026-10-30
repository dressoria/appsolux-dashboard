-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CONVERTED', 'CANCELLED');
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'PENDING_SRI', 'AUTHORIZED', 'REJECTED', 'CANCELLED');
CREATE TYPE "DebitNoteStatus" AS ENUM ('DRAFT', 'PENDING_SRI', 'AUTHORIZED', 'REJECTED', 'CANCELLED');
CREATE TYPE "CreditNoteType" AS ENUM ('RETURN', 'DISCOUNT', 'BONUS', 'ADJUSTMENT');

-- CreateTable: SalesOrder
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "customerId" TEXT,
    "customerSnapshot" JSONB,
    "warehouseId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "sellerName" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "observation" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "convertedSaleId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalesOrderItem
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(14,6) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCategory" "ProductTaxCategory",
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalesCreditNote
CREATE TABLE "SalesCreditNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT,
    "sourceSriDocumentId" TEXT NOT NULL,
    "sriDocumentId" TEXT,
    "number" INTEGER,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "creditNoteType" "CreditNoteType" NOT NULL DEFAULT 'RETURN',
    "reason" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customerSnapshot" JSONB,
    "sourceDocumentSnapshot" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalesCreditNoteItem
CREATE TABLE "SalesCreditNoteItem" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(14,6) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCategory" "ProductTaxCategory",
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "maxQuantity" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "SalesCreditNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalesDebitNote
CREATE TABLE "SalesDebitNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT,
    "sourceSriDocumentId" TEXT NOT NULL,
    "sriDocumentId" TEXT,
    "number" INTEGER,
    "status" "DebitNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customerSnapshot" JSONB,
    "sourceDocumentSnapshot" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalesDebitNoteReason
CREATE TABLE "SalesDebitNoteReason" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCategory" "ProductTaxCategory",
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SalesDebitNoteReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_tenantId_number_key" ON "SalesOrder"("tenantId", "number");
CREATE INDEX "SalesOrder_tenantId_idx" ON "SalesOrder"("tenantId");
CREATE INDEX "SalesOrder_tenantId_status_idx" ON "SalesOrder"("tenantId", "status");
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");
CREATE INDEX "SalesOrder_createdAt_idx" ON "SalesOrder"("createdAt");

CREATE INDEX "SalesOrderItem_orderId_idx" ON "SalesOrderItem"("orderId");
CREATE INDEX "SalesOrderItem_productId_idx" ON "SalesOrderItem"("productId");

CREATE INDEX "SalesCreditNote_tenantId_idx" ON "SalesCreditNote"("tenantId");
CREATE INDEX "SalesCreditNote_tenantId_status_idx" ON "SalesCreditNote"("tenantId", "status");
CREATE INDEX "SalesCreditNote_sourceSriDocumentId_idx" ON "SalesCreditNote"("sourceSriDocumentId");
CREATE INDEX "SalesCreditNote_saleId_idx" ON "SalesCreditNote"("saleId");

CREATE INDEX "SalesCreditNoteItem_creditNoteId_idx" ON "SalesCreditNoteItem"("creditNoteId");

CREATE INDEX "SalesDebitNote_tenantId_idx" ON "SalesDebitNote"("tenantId");
CREATE INDEX "SalesDebitNote_tenantId_status_idx" ON "SalesDebitNote"("tenantId", "status");
CREATE INDEX "SalesDebitNote_sourceSriDocumentId_idx" ON "SalesDebitNote"("sourceSriDocumentId");
CREATE INDEX "SalesDebitNote_saleId_idx" ON "SalesDebitNote"("saleId");

CREATE INDEX "SalesDebitNoteReason_debitNoteId_idx" ON "SalesDebitNoteReason"("debitNoteId");

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "LightweightCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LightweightProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesCreditNote" ADD CONSTRAINT "SalesCreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesCreditNote" ADD CONSTRAINT "SalesCreditNote_sourceSriDocumentId_fkey" FOREIGN KEY ("sourceSriDocumentId") REFERENCES "SriDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesCreditNoteItem" ADD CONSTRAINT "SalesCreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "SalesCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesDebitNote" ADD CONSTRAINT "SalesDebitNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDebitNote" ADD CONSTRAINT "SalesDebitNote_sourceSriDocumentId_fkey" FOREIGN KEY ("sourceSriDocumentId") REFERENCES "SriDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesDebitNoteReason" ADD CONSTRAINT "SalesDebitNoteReason_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "SalesDebitNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
