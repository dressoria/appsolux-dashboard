-- CreateEnum
CREATE TYPE "PurchaseSriCredentialStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'INVALID', 'HUMAN_VERIFICATION_REQUIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "PurchaseSriSyncJobType" AS ENUM ('VERIFY_CONNECTION', 'SYNC_RECEIVED_DOCUMENTS');

-- CreateEnum
CREATE TYPE "PurchaseSriSyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'HUMAN_VERIFICATION_REQUIRED');

-- CreateEnum
CREATE TYPE "PurchaseSriSyncTrigger" AS ENUM ('ACTIVATION', 'MANUAL', 'SCHEDULED', 'RETRY');

-- CreateTable
CREATE TABLE "PurchaseSriCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "additionalUserId" TEXT,
    "encryptedPassword" TEXT NOT NULL,
    "encryptionIv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "PurchaseSriCredentialStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "lastVerificationAt" TIMESTAMP(3),
    "lastVerificationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseSriCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseSriSyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "PurchaseSriSyncJobType" NOT NULL,
    "status" "PurchaseSriSyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedByUserId" TEXT,
    "trigger" "PurchaseSriSyncTrigger" NOT NULL DEFAULT 'MANUAL',
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "documentsFound" INTEGER NOT NULL DEFAULT 0,
    "documentsDownloaded" INTEGER NOT NULL DEFAULT 0,
    "documentsImported" INTEGER NOT NULL DEFAULT 0,
    "documentsSkipped" INTEGER NOT NULL DEFAULT 0,
    "documentsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseSriSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseSriSyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "PurchaseSriSyncJobStatus" NOT NULL DEFAULT 'RUNNING',
    "loginSucceeded" BOOLEAN,
    "humanVerificationDetected" BOOLEAN NOT NULL DEFAULT false,
    "documentsFound" INTEGER NOT NULL DEFAULT 0,
    "documentsDownloaded" INTEGER NOT NULL DEFAULT 0,
    "documentsImported" INTEGER NOT NULL DEFAULT 0,
    "documentsSkipped" INTEGER NOT NULL DEFAULT 0,
    "documentsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseSriSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseSriCredential_tenantId_key" ON "PurchaseSriCredential"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseSriSyncJob_tenantId_idx" ON "PurchaseSriSyncJob"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseSriSyncJob_status_idx" ON "PurchaseSriSyncJob"("status");

-- CreateIndex
CREATE INDEX "PurchaseSriSyncJob_tenantId_status_idx" ON "PurchaseSriSyncJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseSriSyncJob_lockedAt_idx" ON "PurchaseSriSyncJob"("lockedAt");

-- CreateIndex
CREATE INDEX "PurchaseSriSyncRun_tenantId_idx" ON "PurchaseSriSyncRun"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseSriSyncRun_jobId_idx" ON "PurchaseSriSyncRun"("jobId");

-- AddForeignKey
ALTER TABLE "PurchaseSriCredential" ADD CONSTRAINT "PurchaseSriCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseSriSyncJob" ADD CONSTRAINT "PurchaseSriSyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseSriSyncJob" ADD CONSTRAINT "PurchaseSriSyncJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseSriSyncRun" ADD CONSTRAINT "PurchaseSriSyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseSriSyncRun" ADD CONSTRAINT "PurchaseSriSyncRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PurchaseSriSyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
