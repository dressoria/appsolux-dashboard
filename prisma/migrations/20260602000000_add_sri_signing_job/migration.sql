-- CreateEnum
CREATE TYPE "SriSigningJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SriSigningJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "SriSigningJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "runAfter" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "unsignedXmlHash" TEXT,
    "signedXmlStorageKey" TEXT,
    "signedXmlHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriSigningJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SriSigningJob_tenantId_idx" ON "SriSigningJob"("tenantId");

-- CreateIndex
CREATE INDEX "SriSigningJob_documentId_idx" ON "SriSigningJob"("documentId");

-- CreateIndex
CREATE INDEX "SriSigningJob_status_idx" ON "SriSigningJob"("status");

-- CreateIndex
CREATE INDEX "SriSigningJob_runAfter_idx" ON "SriSigningJob"("runAfter");

-- CreateIndex
CREATE INDEX "SriSigningJob_lockedAt_idx" ON "SriSigningJob"("lockedAt");

-- CreateIndex
CREATE INDEX "SriSigningJob_status_runAfter_idx" ON "SriSigningJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "SriSigningJob_tenantId_documentId_idx" ON "SriSigningJob"("tenantId", "documentId");

-- AddForeignKey
ALTER TABLE "SriSigningJob" ADD CONSTRAINT "SriSigningJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriSigningJob" ADD CONSTRAINT "SriSigningJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SriDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
