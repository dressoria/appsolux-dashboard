-- CreateEnum
CREATE TYPE "ProvisioningJobType" AS ENUM ('erpnext_dedicated_site');

-- CreateEnum
CREATE TYPE "ProvisioningJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "ProvisioningJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "type" "ProvisioningJobType" NOT NULL,
    "status" "ProvisioningJobStatus" NOT NULL DEFAULT 'queued',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB,
    "result" JSONB,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProvisioningJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProvisioningJob_tenantId_idx" ON "ProvisioningJob"("tenantId");

-- CreateIndex
CREATE INDEX "ProvisioningJob_status_idx" ON "ProvisioningJob"("status");

-- CreateIndex
CREATE INDEX "ProvisioningJob_type_status_idx" ON "ProvisioningJob"("type", "status");

-- CreateIndex
CREATE INDEX "ProvisioningJob_createdAt_idx" ON "ProvisioningJob"("createdAt");

-- AddForeignKey
ALTER TABLE "ProvisioningJob" ADD CONSTRAINT "ProvisioningJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningJob" ADD CONSTRAINT "ProvisioningJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;