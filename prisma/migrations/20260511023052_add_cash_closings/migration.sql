-- CreateTable
CREATE TABLE "CashClosing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "erpCompanyName" TEXT,
    "cashAccountName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedCashAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedTransferAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCardAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedOtherAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedTotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "countedCashAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "differenceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashClosing_tenantId_date_idx" ON "CashClosing"("tenantId", "date");

-- CreateIndex
CREATE INDEX "CashClosing_createdByUserId_idx" ON "CashClosing"("createdByUserId");

-- CreateIndex
CREATE INDEX "CashClosing_status_idx" ON "CashClosing"("status");

-- AddForeignKey
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
