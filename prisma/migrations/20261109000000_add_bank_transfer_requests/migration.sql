-- CreateEnum
CREATE TYPE "BankTransferRequestStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVATION_FAILED', 'INVOICING_PENDING', 'INVOICING_FAILED');

-- CreateTable
CREATE TABLE "BankTransferRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL,
    "amountUsd" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bankReference" TEXT NOT NULL,
    "receiptFileId" TEXT NOT NULL,
    "receiptFileName" TEXT NOT NULL,
    "receiptFileType" TEXT NOT NULL,
    "receiptFileSizeBytes" INTEGER NOT NULL,
    "status" "BankTransferRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "activatedSubscriptionId" TEXT,
    "subscriptionStartsAt" TIMESTAMP(3),
    "subscriptionEndsAt" TIMESTAMP(3),
    "invoiceStatus" TEXT,
    "invoiceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankTransferRequest_bankReference_key" ON "BankTransferRequest"("bankReference");

-- CreateIndex
CREATE INDEX "BankTransferRequest_tenantId_idx" ON "BankTransferRequest"("tenantId");

-- CreateIndex
CREATE INDEX "BankTransferRequest_status_idx" ON "BankTransferRequest"("status");

-- CreateIndex
CREATE INDEX "BankTransferRequest_requestedById_idx" ON "BankTransferRequest"("requestedById");

-- CreateIndex
CREATE INDEX "BankTransferRequest_reviewedById_idx" ON "BankTransferRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "BankTransferRequest_createdAt_idx" ON "BankTransferRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
