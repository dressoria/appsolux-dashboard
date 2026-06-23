-- CreateEnum
CREATE TYPE "TenantBillingMode" AS ENUM ('stripe', 'manual', 'internal', 'trial');

-- CreateEnum
CREATE TYPE "BusinessSuiteStatus" AS ENUM ('locked', 'pending_migration', 'migrating', 'active', 'failed', 'suspended');

-- CreateEnum
CREATE TYPE "BusinessSuitePlanMode" AS ENUM ('basic', 'business_shared', 'business_dedicated');

-- CreateEnum
CREATE TYPE "BusinessSuiteAccessMode" AS ENUM ('none', 'shared', 'dedicated');

-- CreateEnum
CREATE TYPE "BusinessSuiteActivationJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'needs_review');

-- AlterTable
ALTER TABLE "TenantSubscription"
ADD COLUMN "billingMode" "TenantBillingMode" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "TenantOperationalConfig"
ADD COLUMN "businessSuiteStatus" "BusinessSuiteStatus" NOT NULL DEFAULT 'locked';

-- Backfill
UPDATE "TenantSubscription"
SET "billingMode" = 'trial'
WHERE "status" = 'trialing';

UPDATE "TenantOperationalConfig"
SET "businessSuiteStatus" = CASE
  WHEN "status" IN ('suspended', 'disabled') THEN 'suspended'
  WHEN "operatingMode" = 'SHARED_ERP' AND "sharedErpEnabled" = true THEN 'active'
  WHEN "operatingMode" = 'SHARED_ERP' THEN 'pending_migration'
  WHEN "operatingMode" = 'DEDICATED_ERP' AND "dedicatedErpEnabled" = true THEN 'migrating'
  ELSE 'locked'
END;

-- CreateTable
CREATE TABLE "BusinessSuiteActivationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "sourceMode" "BusinessSuitePlanMode" NOT NULL,
    "targetMode" "BusinessSuitePlanMode" NOT NULL,
    "businessSuiteMode" "BusinessSuiteAccessMode" NOT NULL,
    "status" "BusinessSuiteActivationJobStatus" NOT NULL DEFAULT 'queued',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "summary" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSuiteActivationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantOperationalConfig_businessSuiteStatus_idx" ON "TenantOperationalConfig"("businessSuiteStatus");

-- CreateIndex
CREATE INDEX "BusinessSuiteActivationJob_tenantId_idx" ON "BusinessSuiteActivationJob"("tenantId");

-- CreateIndex
CREATE INDEX "BusinessSuiteActivationJob_requestedByUserId_idx" ON "BusinessSuiteActivationJob"("requestedByUserId");

-- CreateIndex
CREATE INDEX "BusinessSuiteActivationJob_status_idx" ON "BusinessSuiteActivationJob"("status");

-- CreateIndex
CREATE INDEX "BusinessSuiteActivationJob_tenantId_status_idx" ON "BusinessSuiteActivationJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BusinessSuiteActivationJob_createdAt_idx" ON "BusinessSuiteActivationJob"("createdAt");

-- AddForeignKey
ALTER TABLE "BusinessSuiteActivationJob" ADD CONSTRAINT "BusinessSuiteActivationJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSuiteActivationJob" ADD CONSTRAINT "BusinessSuiteActivationJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
