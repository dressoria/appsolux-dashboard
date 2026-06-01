CREATE TYPE "SriSubmissionJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'RECEIVED',
  'AUTHORIZED',
  'REJECTED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "SriSubmissionJob" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "SriSubmissionJobStatus" NOT NULL DEFAULT 'QUEUED',
  "environment" "SriEnvironment" NOT NULL DEFAULT 'TEST',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "runAfter" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "authorizedAt" TIMESTAMP(3),
  "sriReceiptStatus" TEXT,
  "sriAuthorizationStatus" TEXT,
  "sriAuthorizationNumber" TEXT,
  "sriAccessKey" TEXT,
  "sriResponseRaw" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SriSubmissionJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SriSubmissionJob"
ADD CONSTRAINT "SriSubmissionJob_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SriSubmissionJob"
ADD CONSTRAINT "SriSubmissionJob_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "SriDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SriSubmissionJob_tenantId_idx" ON "SriSubmissionJob"("tenantId");
CREATE INDEX "SriSubmissionJob_documentId_idx" ON "SriSubmissionJob"("documentId");
CREATE INDEX "SriSubmissionJob_status_idx" ON "SriSubmissionJob"("status");
CREATE INDEX "SriSubmissionJob_runAfter_idx" ON "SriSubmissionJob"("runAfter");
CREATE INDEX "SriSubmissionJob_status_runAfter_idx" ON "SriSubmissionJob"("status", "runAfter");
CREATE INDEX "SriSubmissionJob_tenantId_documentId_idx" ON "SriSubmissionJob"("tenantId", "documentId");
