-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('MERCHANDISE', 'EXPENSE_SERVICE');

-- AlterTable PurchaseDocument
ALTER TABLE "PurchaseDocument" ADD COLUMN "taxSupportCode" TEXT;
ALTER TABLE "PurchaseDocument" ADD COLUMN "purchaseType" "PurchaseType";
ALTER TABLE "PurchaseDocument" ADD COLUMN "sriPaymentCode" TEXT;
ALTER TABLE "PurchaseDocument" ADD COLUMN "accountingCostCenterId" TEXT;
ALTER TABLE "PurchaseDocument" ADD COLUMN "accountingProjectId" TEXT;
ALTER TABLE "PurchaseDocument" ADD COLUMN "tipAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable PurchaseDocumentItem
ALTER TABLE "PurchaseDocumentItem" ADD COLUMN "xmlProductCode" TEXT;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_accountingCostCenterId_fkey" FOREIGN KEY ("accountingCostCenterId") REFERENCES "AccountingCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_accountingProjectId_fkey" FOREIGN KEY ("accountingProjectId") REFERENCES "AccountingCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
