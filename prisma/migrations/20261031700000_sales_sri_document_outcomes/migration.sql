BEGIN;

-- Additive only: existing documents, credentials and checkpoints are untouched.
ALTER TABLE "SalesSriSyncJob" ADD COLUMN "documentsRejected" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SalesSriSyncJob" ADD COLUMN "counterBaseline" JSONB;
ALTER TABLE "SalesSriSyncJob" ADD COLUMN "attemptHistory" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Fail closed if legacy data already has two RUNNING jobs for one tenant.
-- Preflight this condition before applying; never delete or reset jobs to make it pass.
CREATE UNIQUE INDEX "SalesSriSyncJob_one_running_per_tenant" ON "SalesSriSyncJob"("tenantId") WHERE status = 'RUNNING';

CREATE UNIQUE INDEX "SalesSriSyncJob_id_tenantId_key" ON "SalesSriSyncJob"("id", "tenantId");

CREATE TABLE "SalesSriSyncDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "accessKey" TEXT NOT NULL,
  "queryDate" TIMESTAMP(3) NOT NULL,
  "outcome" TEXT NOT NULL,
  "sriStatus" TEXT,
  "reasonCode" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesSriSyncDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesSriSyncDocument_outcome_check" CHECK ("outcome" IN ('PENDING', 'IMPORTED', 'DUPLICATE', 'REJECTED', 'ERROR')),
  CONSTRAINT "SalesSriSyncDocument_key_check" CHECK ("accessKey" ~ '^[0-9]{49}$'),
  CONSTRAINT "SalesSriSyncDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalesSriSyncDocument_jobId_fkey" FOREIGN KEY ("jobId", "tenantId") REFERENCES "SalesSriSyncJob"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SalesSriSyncDocument_jobId_accessKey_key" ON "SalesSriSyncDocument"("jobId", "accessKey");
CREATE INDEX "SalesSriSyncDocument_tenantId_accessKey_outcome_idx" ON "SalesSriSyncDocument"("tenantId", "accessKey", "outcome");
CREATE INDEX "SalesSriSyncDocument_jobId_queryDate_idx" ON "SalesSriSyncDocument"("jobId", "queryDate");

COMMIT;
