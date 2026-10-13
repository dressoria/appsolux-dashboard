-- Facturom Treasury Core. Generated from datamodels only; NOT EXECUTED.
-- Review together with the earlier pending local migrations before applying.

-- CreateEnum
CREATE TYPE "TreasuryAccountType" AS ENUM ('CASH', 'BANK', 'CARD');

-- CreateEnum
CREATE TYPE "TreasuryMovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "TreasuryMovementType" AS ENUM ('OPENING_BALANCE', 'SALE_COLLECTION', 'PURCHASE_PAYMENT', 'CASH_IN', 'CASH_OUT', 'BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'BANK_TRANSFER', 'CUSTOMER_ADVANCE', 'SUPPLIER_ADVANCE', 'CARD_COLLECTION', 'CARD_FEE', 'CARD_SETTLEMENT', 'CHECK_RECEIVED', 'CHECK_DEPOSIT', 'CHECK_CLEARED', 'CHECK_BOUNCED', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TreasuryMovementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "TreasurySourceType" AS ENUM ('MANUAL', 'SALE_PAYMENT', 'PURCHASE_PAYMENT', 'OBLIGATION', 'TRANSFER', 'ADVANCE', 'CARD', 'CHECK', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TreasuryObligationType" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "TreasuryObligationStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TreasuryAdvanceType" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "TreasuryAdvanceStatus" AS ENUM ('AVAILABLE', 'PARTIALLY_APPLIED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PostdatedCheckStatus" AS ENUM ('PENDING', 'READY_TO_DEPOSIT', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'OTHER');

-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BankStatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED');

-- CreateEnum
CREATE TYPE "CardTransactionStatus" AS ENUM ('PENDING', 'SETTLED', 'REVERSED', 'DISPUTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "CashClosing" ALTER COLUMN "expectedCashAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "expectedTransferAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "expectedCardAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "expectedOtherAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "expectedTotalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "countedCashAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "differenceAmount" SET DATA TYPE DECIMAL(14,2);

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "TreasuryAccountType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultAccount" BOOLEAN NOT NULL DEFAULT false,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleName" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumberMasked" TEXT,
    "bankAccountType" "BankAccountType",
    "provider" TEXT,
    "settlementBankAccountId" TEXT,
    "feePercentage" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "fixedFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "settlementDays" INTEGER NOT NULL DEFAULT 2,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingAmount" DECIMAL(14,2) NOT NULL,
    "expectedClosingAmount" DECIMAL(14,2),
    "countedClosingAmount" DECIMAL(14,2),
    "differenceAmount" DECIMAL(14,2),
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "cashClosingId" TEXT,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryObligation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "TreasuryObligationType" NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "saleId" TEXT,
    "purchaseDocumentId" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'OPENING_OBLIGATION',
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "originalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL,
    "status" "TreasuryObligationStatus" NOT NULL DEFAULT 'OPEN',
    "externalReference" TEXT NOT NULL,
    "importBatchId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "obligationId" TEXT,
    "movementType" "TreasuryMovementType" NOT NULL,
    "direction" "TreasuryMovementDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "sourceType" "TreasurySourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "transferGroupId" TEXT,
    "counterpartyType" "TreasuryAdvanceType",
    "counterpartyId" TEXT,
    "status" "TreasuryMovementStatus" NOT NULL DEFAULT 'CONFIRMED',
    "salePaymentId" TEXT,
    "purchasePaymentId" TEXT,
    "reversalOfId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostdatedCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" "TreasuryObligationType" NOT NULL,
    "checkNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountNumberMasked" TEXT,
    "issuerName" TEXT NOT NULL,
    "issuerIdentification" TEXT,
    "beneficiaryName" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PostdatedCheckStatus" NOT NULL DEFAULT 'PENDING',
    "customerId" TEXT,
    "supplierId" TEXT,
    "obligationId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostdatedCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dateToleranceDays" INTEGER NOT NULL DEFAULT 2,
    "statementOpeningBalance" DECIMAL(14,2) NOT NULL,
    "statementClosingBalance" DECIMAL(14,2) NOT NULL,
    "systemOpeningBalance" DECIMAL(14,2) NOT NULL,
    "systemClosingBalance" DECIMAL(14,2) NOT NULL,
    "difference" DECIMAL(14,2) NOT NULL,
    "status" "BankReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "direction" "TreasuryMovementDirection" NOT NULL,
    "matchedMovementId" TEXT,
    "status" "BankStatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "importKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryAdvance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "TreasuryAdvanceType" NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "appliedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "paymentMethod" "LightweightPaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "status" "TreasuryAdvanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "requestKey" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardAccountId" TEXT NOT NULL,
    "saleId" TEXT,
    "obligationId" TEXT,
    "sourceId" TEXT NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "feeAmount" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "expectedSettlementDate" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "reference" TEXT,
    "status" "CardTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "bankMovementId" TEXT,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryAccount_tenantId_type_active_idx" ON "TreasuryAccount"("tenantId", "type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccount_id_tenantId_key" ON "TreasuryAccount"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccount_tenantId_code_key" ON "TreasuryAccount"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_cashClosingId_key" ON "CashSession"("cashClosingId");

-- CreateIndex
CREATE INDEX "CashSession_tenantId_cashAccountId_status_idx" ON "CashSession"("tenantId", "cashAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_id_tenantId_key" ON "CashSession"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryObligation_saleId_key" ON "TreasuryObligation"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryObligation_purchaseDocumentId_key" ON "TreasuryObligation"("purchaseDocumentId");

-- CreateIndex
CREATE INDEX "TreasuryObligation_tenantId_type_status_dueDate_idx" ON "TreasuryObligation"("tenantId", "type", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryObligation_saleId_tenantId_key" ON "TreasuryObligation"("saleId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryObligation_purchaseDocumentId_tenantId_key" ON "TreasuryObligation"("purchaseDocumentId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryObligation_id_tenantId_key" ON "TreasuryObligation"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryObligation_tenantId_type_externalReference_key" ON "TreasuryObligation"("tenantId", "type", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryMovement_salePaymentId_key" ON "TreasuryMovement"("salePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryMovement_purchasePaymentId_key" ON "TreasuryMovement"("purchasePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryMovement_reversalOfId_key" ON "TreasuryMovement"("reversalOfId");

-- CreateIndex
CREATE INDEX "TreasuryMovement_tenantId_accountId_date_idx" ON "TreasuryMovement"("tenantId", "accountId", "date");

-- CreateIndex
CREATE INDEX "TreasuryMovement_tenantId_transferGroupId_idx" ON "TreasuryMovement"("tenantId", "transferGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryMovement_reversalOfId_tenantId_key" ON "TreasuryMovement"("reversalOfId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryMovement_id_tenantId_key" ON "TreasuryMovement"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryMovement_tenantId_sourceType_sourceId_movementType__key" ON "TreasuryMovement"("tenantId", "sourceType", "sourceId", "movementType", "direction");

-- CreateIndex
CREATE INDEX "PostdatedCheck_tenantId_status_dueDate_idx" ON "PostdatedCheck"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PostdatedCheck_id_tenantId_key" ON "PostdatedCheck"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PostdatedCheck_tenantId_direction_bankName_checkNumber_issu_key" ON "PostdatedCheck"("tenantId", "direction", "bankName", "checkNumber", "issuerName");

-- CreateIndex
CREATE INDEX "BankReconciliation_tenantId_bankAccountId_periodStart_perio_idx" ON "BankReconciliation"("tenantId", "bankAccountId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_id_tenantId_key" ON "BankReconciliation"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_matchedMovementId_key" ON "BankStatementLine"("matchedMovementId");

-- CreateIndex
CREATE INDEX "BankStatementLine_tenantId_reconciliationId_status_idx" ON "BankStatementLine"("tenantId", "reconciliationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_matchedMovementId_tenantId_key" ON "BankStatementLine"("matchedMovementId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_id_tenantId_key" ON "BankStatementLine"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_tenantId_bankAccountId_importKey_key" ON "BankStatementLine"("tenantId", "bankAccountId", "importKey");

-- CreateIndex
CREATE INDEX "TreasuryAdvance_tenantId_type_status_idx" ON "TreasuryAdvance"("tenantId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAdvance_id_tenantId_key" ON "TreasuryAdvance"("id", "tenantId");

-- CreateIndex
CREATE INDEX "AdvanceApplication_tenantId_obligationId_idx" ON "AdvanceApplication"("tenantId", "obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceApplication_tenantId_requestKey_key" ON "AdvanceApplication"("tenantId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CardTransaction_bankMovementId_key" ON "CardTransaction"("bankMovementId");

-- CreateIndex
CREATE INDEX "CardTransaction_tenantId_status_expectedSettlementDate_idx" ON "CardTransaction"("tenantId", "status", "expectedSettlementDate");

-- CreateIndex
CREATE UNIQUE INDEX "CardTransaction_id_tenantId_key" ON "CardTransaction"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CardTransaction_tenantId_sourceId_key" ON "CardTransaction"("tenantId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "LightweightCustomer_id_tenantId_key" ON "LightweightCustomer"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LightweightSupplier_id_tenantId_key" ON "LightweightSupplier"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LightweightSale_id_tenantId_key" ON "LightweightSale"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDocument_id_tenantId_key" ON "PurchaseDocument"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_settlementBankAccountId_tenantId_fkey" FOREIGN KEY ("settlementBankAccountId", "tenantId") REFERENCES "TreasuryAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashAccountId_tenantId_fkey" FOREIGN KEY ("cashAccountId", "tenantId") REFERENCES "TreasuryAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashClosingId_fkey" FOREIGN KEY ("cashClosingId") REFERENCES "CashClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_customerId_tenantId_fkey" FOREIGN KEY ("customerId", "tenantId") REFERENCES "LightweightCustomer"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_supplierId_tenantId_fkey" FOREIGN KEY ("supplierId", "tenantId") REFERENCES "LightweightSupplier"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_saleId_tenantId_fkey" FOREIGN KEY ("saleId", "tenantId") REFERENCES "LightweightSale"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_purchaseDocumentId_tenantId_fkey" FOREIGN KEY ("purchaseDocumentId", "tenantId") REFERENCES "PurchaseDocument"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_accountId_tenantId_fkey" FOREIGN KEY ("accountId", "tenantId") REFERENCES "TreasuryAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_cashSessionId_tenantId_fkey" FOREIGN KEY ("cashSessionId", "tenantId") REFERENCES "CashSession"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_obligationId_tenantId_fkey" FOREIGN KEY ("obligationId", "tenantId") REFERENCES "TreasuryObligation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_salePaymentId_fkey" FOREIGN KEY ("salePaymentId") REFERENCES "LightweightPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_purchasePaymentId_fkey" FOREIGN KEY ("purchasePaymentId") REFERENCES "PurchasePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_reversalOfId_tenantId_fkey" FOREIGN KEY ("reversalOfId", "tenantId") REFERENCES "TreasuryMovement"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostdatedCheck" ADD CONSTRAINT "PostdatedCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostdatedCheck" ADD CONSTRAINT "PostdatedCheck_obligationId_tenantId_fkey" FOREIGN KEY ("obligationId", "tenantId") REFERENCES "TreasuryObligation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostdatedCheck" ADD CONSTRAINT "PostdatedCheck_customerId_tenantId_fkey" FOREIGN KEY ("customerId", "tenantId") REFERENCES "LightweightCustomer"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostdatedCheck" ADD CONSTRAINT "PostdatedCheck_supplierId_tenantId_fkey" FOREIGN KEY ("supplierId", "tenantId") REFERENCES "LightweightSupplier"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_tenantId_fkey" FOREIGN KEY ("bankAccountId", "tenantId") REFERENCES "TreasuryAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_bankAccountId_tenantId_fkey" FOREIGN KEY ("bankAccountId", "tenantId") REFERENCES "TreasuryAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_reconciliationId_tenantId_fkey" FOREIGN KEY ("reconciliationId", "tenantId") REFERENCES "BankReconciliation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_matchedMovementId_tenantId_fkey" FOREIGN KEY ("matchedMovementId", "tenantId") REFERENCES "TreasuryMovement"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAdvance" ADD CONSTRAINT "TreasuryAdvance_treasuryAccountId_tenantId_fkey" FOREIGN KEY ("treasuryAccountId", "tenantId") REFERENCES "TreasuryAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAdvance" ADD CONSTRAINT "TreasuryAdvance_customerId_tenantId_fkey" FOREIGN KEY ("customerId", "tenantId") REFERENCES "LightweightCustomer"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAdvance" ADD CONSTRAINT "TreasuryAdvance_supplierId_tenantId_fkey" FOREIGN KEY ("supplierId", "tenantId") REFERENCES "LightweightSupplier"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceApplication" ADD CONSTRAINT "AdvanceApplication_advanceId_tenantId_fkey" FOREIGN KEY ("advanceId", "tenantId") REFERENCES "TreasuryAdvance"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceApplication" ADD CONSTRAINT "AdvanceApplication_obligationId_tenantId_fkey" FOREIGN KEY ("obligationId", "tenantId") REFERENCES "TreasuryObligation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_cardAccountId_tenantId_fkey" FOREIGN KEY ("cardAccountId", "tenantId") REFERENCES "TreasuryAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_saleId_tenantId_fkey" FOREIGN KEY ("saleId", "tenantId") REFERENCES "LightweightSale"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_obligationId_tenantId_fkey" FOREIGN KEY ("obligationId", "tenantId") REFERENCES "TreasuryObligation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial invariants and concurrency constraints (not expressible in Prisma schema).
CREATE UNIQUE INDEX "CashSession_one_open_per_account" ON "CashSession" ("tenantId", "cashAccountId") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "TreasuryAccount_one_active_default_per_type" ON "TreasuryAccount" ("tenantId", "type") WHERE "defaultAccount" = true AND "active" = true;
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_fee_range" CHECK ("feePercentage" >= 0 AND "feePercentage" <= 100 AND "fixedFee" >= 0 AND "settlementDays" >= 0 AND "settlementDays" <= 90);
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_valid_balance" CHECK ("originalAmount" > 0 AND "paidAmount" >= 0 AND "balance" >= 0 AND ("status" = 'CANCELLED' OR "originalAmount" = "paidAmount" + "balance"));
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_party_type" CHECK (("type" = 'RECEIVABLE' AND "customerId" IS NOT NULL AND "supplierId" IS NULL AND "purchaseDocumentId" IS NULL) OR ("type" = 'PAYABLE' AND "supplierId" IS NOT NULL AND "customerId" IS NULL AND "saleId" IS NULL));
ALTER TABLE "TreasuryObligation" ADD CONSTRAINT "TreasuryObligation_dates" CHECK ("dueDate" >= "issueDate");
ALTER TABLE "TreasuryAdvance" ADD CONSTRAINT "TreasuryAdvance_valid_balance" CHECK ("amount" > 0 AND "appliedAmount" >= 0 AND "balance" >= 0 AND "amount" = "appliedAmount" + "balance");
ALTER TABLE "TreasuryAdvance" ADD CONSTRAINT "TreasuryAdvance_party_type" CHECK (("type" = 'CUSTOMER' AND "customerId" IS NOT NULL AND "supplierId" IS NULL) OR ("type" = 'SUPPLIER' AND "supplierId" IS NOT NULL AND "customerId" IS NULL));
ALTER TABLE "AdvanceApplication" ADD CONSTRAINT "AdvanceApplication_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_valid_amounts" CHECK ("grossAmount" > 0 AND "feeAmount" >= 0 AND "netAmount" >= 0 AND "grossAmount" = "feeAmount" + "netAmount");
ALTER TABLE "PostdatedCheck" ADD CONSTRAINT "PostdatedCheck_valid_amount_dates" CHECK ("amount" > 0 AND "dueDate" >= "issueDate");
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_valid_match" CHECK ("amount" > 0 AND (("status" = 'MATCHED' AND "matchedMovementId" IS NOT NULL) OR ("status" = 'UNMATCHED' AND "matchedMovementId" IS NULL)));
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_valid_period" CHECK ("periodEnd" > "periodStart" AND "dateToleranceDays" >= 0 AND "dateToleranceDays" <= 7);
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closed_snapshot" CHECK ("status" <> 'CLOSED' OR ("closedAt" IS NOT NULL AND "closedByUserId" IS NOT NULL AND "expectedClosingAmount" IS NOT NULL AND "countedClosingAmount" IS NOT NULL AND "differenceAmount" IS NOT NULL AND "differenceAmount" = "countedClosingAmount" - "expectedClosingAmount"));
