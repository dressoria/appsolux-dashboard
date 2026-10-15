-- CreateEnum
CREATE TYPE "AccountingPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "AccountingRootType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COST_EXPENSE');
CREATE TYPE "AccountingNormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');
CREATE TYPE "AccountingJournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
CREATE TYPE "AccountingSourceType" AS ENUM ('MANUAL', 'OPENING', 'SALE', 'SALE_CREDIT_NOTE', 'PURCHASE', 'PURCHASE_CREDIT_NOTE', 'WITHHOLDING_EMITTED', 'WITHHOLDING_RECEIVED', 'TREASURY', 'BANK_TRANSFER', 'CARD_SETTLEMENT', 'CUSTOMER_ADVANCE', 'SUPPLIER_ADVANCE', 'INVENTORY_ADJUSTMENT', 'COGS', 'CLOSING', 'REVERSAL');
CREATE TYPE "AccountingCostCenterType" AS ENUM ('COST_CENTER', 'PROJECT');
CREATE TYPE "AccountingAccountMappingKey" AS ENUM ('TRANSITORY_CLEARING', 'ASSUMED_WITHHOLDING_LIABILITY', 'ASSUMED_WITHHOLDING_EXPENSE', 'CUSTOMER_RECEIVABLE_LOCAL', 'CUSTOMER_RECEIVABLE_FOREIGN', 'CUSTOMER_ADVANCE_LOCAL', 'CUSTOMER_ADVANCE_FOREIGN', 'IMPORTED_CUSTOMER_OBLIGATION', 'SUPPLIER_PAYABLE_LOCAL', 'SUPPLIER_PAYABLE_FOREIGN', 'SUPPLIER_ADVANCE_LOCAL', 'SUPPLIER_ADVANCE_FOREIGN', 'IMPORTED_SUPPLIER_OBLIGATION', 'INVENTORY_TAXABLE', 'INVENTORY_ZERO', 'INVENTORY_NON_OBJECT', 'INVENTORY_EXEMPT', 'COGS_TAXABLE', 'COGS_ZERO', 'COGS_NON_OBJECT', 'COGS_EXEMPT', 'SALES_TAXABLE', 'SALES_ZERO', 'SALES_NON_OBJECT', 'SALES_EXEMPT', 'SALES_EXPORT', 'SALES_CREDIT_NOTE_DISCOUNT_TAXABLE', 'SALES_CREDIT_NOTE_DISCOUNT_ZERO', 'SALES_CREDIT_NOTE_DISCOUNT_NON_OBJECT', 'SALES_CREDIT_NOTE_DISCOUNT_EXEMPT', 'SALES_CREDIT_NOTE_RETURN_TAXABLE', 'SALES_CREDIT_NOTE_RETURN_ZERO', 'SALES_CREDIT_NOTE_RETURN_NON_OBJECT', 'SALES_CREDIT_NOTE_RETURN_EXEMPT', 'PURCHASE_CREDIT_NOTE_DISCOUNT_TAXABLE', 'PURCHASE_CREDIT_NOTE_DISCOUNT_ZERO', 'PURCHASE_CREDIT_NOTE_DISCOUNT_NON_OBJECT', 'PURCHASE_CREDIT_NOTE_DISCOUNT_EXEMPT', 'PURCHASE_CREDIT_NOTE_RETURN_TAXABLE', 'PURCHASE_CREDIT_NOTE_RETURN_ZERO', 'PURCHASE_CREDIT_NOTE_RETURN_NON_OBJECT', 'PURCHASE_CREDIT_NOTE_RETURN_EXEMPT', 'UNSUPPORTED_MERCHANDISE', 'PHYSICAL_COUNT_ADJUSTMENT', 'VAT_OUTPUT', 'VAT_INPUT', 'VAT_COST_EXPENSE', 'CLOSING_ACCUMULATED_RESULTS', 'CLOSING_PROFIT_LOSS', 'CLOSING_CURRENT_RESULT', 'CARD_CLEARING');

-- AlterTable: TaxWithholdingCode - add source metadata and change unique constraint
ALTER TABLE "TaxWithholdingCode" ADD COLUMN IF NOT EXISTS "sourceName" TEXT;
ALTER TABLE "TaxWithholdingCode" ADD COLUMN IF NOT EXISTS "sourceReference" TEXT;
ALTER TABLE "TaxWithholdingCode" ADD COLUMN IF NOT EXISTS "sourcePublishedAt" TIMESTAMP(3);
ALTER TABLE "TaxWithholdingCode" ADD COLUMN IF NOT EXISTS "loadedAt" TIMESTAMP(3);

-- Drop old unique and create versioned unique
ALTER TABLE "TaxWithholdingCode" DROP CONSTRAINT IF EXISTS "TaxWithholdingCode_taxType_code_key";
CREATE UNIQUE INDEX "TaxWithholdingCode_taxType_code_validFrom_key" ON "TaxWithholdingCode"("taxType", "code", "validFrom");

-- CreateTable: AccountingPlan
CREATE TABLE "AccountingPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AccountingPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingAccount
CREATE TABLE "AccountingAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rootType" "AccountingRootType" NOT NULL,
    "normalBalance" "AccountingNormalBalance" NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "allowsPosting" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "systemLocked" BOOLEAN NOT NULL DEFAULT false,
    "f101Code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingAccountMapping
CREATE TABLE "AccountingAccountMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" "AccountingAccountMappingKey" NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TaxWithholdingAccountMapping
CREATE TABLE "TaxWithholdingAccountMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "withholdingCodeId" TEXT NOT NULL,
    "assetAccountId" TEXT,
    "liabilityAccountId" TEXT,
    "expenseAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxWithholdingAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingCostExpenseConcept
CREATE TABLE "AccountingCostExpenseConcept" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "costAccountId" TEXT,
    "expenseAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingCostExpenseConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingCostCenter
CREATE TABLE "AccountingCostCenter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AccountingCostCenterType" NOT NULL DEFAULT 'COST_CENTER',
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingCostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingPeriod
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingJournalEntry
CREATE TABLE "AccountingJournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" "AccountingSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "status" "AccountingJournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDebit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reversalOfId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "postedByUserId" TEXT,
    "reversedByUserId" TEXT,
    "postedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingJournalLine
CREATE TABLE "AccountingJournalLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costCenterId" TEXT,
    "counterpartyType" TEXT,
    "counterpartyId" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountingSettings
CREATE TABLE "AccountingSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "autoPostingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "configuredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingPlan_tenantId_idx" ON "AccountingPlan"("tenantId");
CREATE UNIQUE INDEX "AccountingAccount_tenantId_planId_code_key" ON "AccountingAccount"("tenantId", "planId", "code");
CREATE INDEX "AccountingAccount_tenantId_idx" ON "AccountingAccount"("tenantId");
CREATE INDEX "AccountingAccount_planId_idx" ON "AccountingAccount"("planId");
CREATE INDEX "AccountingAccount_tenantId_planId_parentId_idx" ON "AccountingAccount"("tenantId", "planId", "parentId");
CREATE UNIQUE INDEX "AccountingAccountMapping_tenantId_key_key" ON "AccountingAccountMapping"("tenantId", "key");
CREATE INDEX "AccountingAccountMapping_tenantId_idx" ON "AccountingAccountMapping"("tenantId");
CREATE UNIQUE INDEX "TaxWithholdingAccountMapping_tenantId_withholdingCodeId_key" ON "TaxWithholdingAccountMapping"("tenantId", "withholdingCodeId");
CREATE INDEX "TaxWithholdingAccountMapping_tenantId_idx" ON "TaxWithholdingAccountMapping"("tenantId");
CREATE UNIQUE INDEX "AccountingCostExpenseConcept_tenantId_code_key" ON "AccountingCostExpenseConcept"("tenantId", "code");
CREATE INDEX "AccountingCostExpenseConcept_tenantId_idx" ON "AccountingCostExpenseConcept"("tenantId");
CREATE UNIQUE INDEX "AccountingCostCenter_tenantId_code_key" ON "AccountingCostCenter"("tenantId", "code");
CREATE INDEX "AccountingCostCenter_tenantId_idx" ON "AccountingCostCenter"("tenantId");
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_year_month_key" ON "AccountingPeriod"("tenantId", "year", "month");
CREATE INDEX "AccountingPeriod_tenantId_idx" ON "AccountingPeriod"("tenantId");
CREATE INDEX "AccountingPeriod_tenantId_status_idx" ON "AccountingPeriod"("tenantId", "status");
CREATE UNIQUE INDEX "AccountingJournalEntry_reversalOfId_key" ON "AccountingJournalEntry"("reversalOfId");
CREATE UNIQUE INDEX "AccountingJournalEntry_tenantId_number_key" ON "AccountingJournalEntry"("tenantId", "number");
CREATE UNIQUE INDEX "AccountingJournalEntry_tenantId_sourceType_sourceId_key" ON "AccountingJournalEntry"("tenantId", "sourceType", "sourceId");
CREATE INDEX "AccountingJournalEntry_tenantId_idx" ON "AccountingJournalEntry"("tenantId");
CREATE INDEX "AccountingJournalEntry_tenantId_date_idx" ON "AccountingJournalEntry"("tenantId", "date");
CREATE INDEX "AccountingJournalEntry_tenantId_status_idx" ON "AccountingJournalEntry"("tenantId", "status");
CREATE INDEX "AccountingJournalLine_tenantId_idx" ON "AccountingJournalLine"("tenantId");
CREATE INDEX "AccountingJournalLine_entryId_idx" ON "AccountingJournalLine"("entryId");
CREATE INDEX "AccountingJournalLine_accountId_idx" ON "AccountingJournalLine"("accountId");
CREATE INDEX "AccountingJournalLine_tenantId_accountId_idx" ON "AccountingJournalLine"("tenantId", "accountId");
CREATE UNIQUE INDEX "AccountingSettings_tenantId_key" ON "AccountingSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "AccountingPlan" ADD CONSTRAINT "AccountingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AccountingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingAccountMapping" ADD CONSTRAINT "AccountingAccountMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingAccountMapping" ADD CONSTRAINT "AccountingAccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxWithholdingAccountMapping" ADD CONSTRAINT "TaxWithholdingAccountMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxWithholdingAccountMapping" ADD CONSTRAINT "TaxWithholdingAccountMapping_withholdingCodeId_fkey" FOREIGN KEY ("withholdingCodeId") REFERENCES "TaxWithholdingCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxWithholdingAccountMapping" ADD CONSTRAINT "TaxWithholdingAccountMapping_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxWithholdingAccountMapping" ADD CONSTRAINT "TaxWithholdingAccountMapping_liabilityAccountId_fkey" FOREIGN KEY ("liabilityAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxWithholdingAccountMapping" ADD CONSTRAINT "TaxWithholdingAccountMapping_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingCostExpenseConcept" ADD CONSTRAINT "AccountingCostExpenseConcept_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingCostExpenseConcept" ADD CONSTRAINT "AccountingCostExpenseConcept_costAccountId_fkey" FOREIGN KEY ("costAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingCostExpenseConcept" ADD CONSTRAINT "AccountingCostExpenseConcept_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingCostCenter" ADD CONSTRAINT "AccountingCostCenter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingCostCenter" ADD CONSTRAINT "AccountingCostCenter_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccountingCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalEntry" ADD CONSTRAINT "AccountingJournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalEntry" ADD CONSTRAINT "AccountingJournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "AccountingJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalLine" ADD CONSTRAINT "AccountingJournalLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalLine" ADD CONSTRAINT "AccountingJournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AccountingJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalLine" ADD CONSTRAINT "AccountingJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalLine" ADD CONSTRAINT "AccountingJournalLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "AccountingCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
