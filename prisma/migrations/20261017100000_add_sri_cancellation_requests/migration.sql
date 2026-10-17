-- CreateEnum
CREATE TYPE "SriCancellationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'HUMAN_VERIFICATION_REQUIRED', 'NOT_ELIGIBLE', 'CANCELLED_BY_USER');

-- CreateEnum
CREATE TYPE "SriCancellationReason" AS ENUM ('EMISSION_ERROR', 'OPERATION_NOT_OCCURRED');

-- CreateTable
CREATE TABLE "SriCancellationRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sriDocumentId" TEXT NOT NULL,
    "status" "SriCancellationStatus" NOT NULL DEFAULT 'QUEUED',
    "reasonCode" "SriCancellationReason" NOT NULL,
    "reasonText" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "workerId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sriRequestNumber" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriCancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SriCancellationRequest_tenantId_idx" ON "SriCancellationRequest"("tenantId");

-- CreateIndex
CREATE INDEX "SriCancellationRequest_sriDocumentId_idx" ON "SriCancellationRequest"("sriDocumentId");

-- CreateIndex
CREATE INDEX "SriCancellationRequest_status_idx" ON "SriCancellationRequest"("status");

-- CreateIndex
CREATE INDEX "SriCancellationRequest_tenantId_sriDocumentId_idx" ON "SriCancellationRequest"("tenantId", "sriDocumentId");

-- AddForeignKey
ALTER TABLE "SriCancellationRequest" ADD CONSTRAINT "SriCancellationRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriCancellationRequest" ADD CONSTRAINT "SriCancellationRequest_sriDocumentId_fkey" FOREIGN KEY ("sriDocumentId") REFERENCES "SriDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
