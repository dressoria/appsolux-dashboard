-- CreateEnum
CREATE TYPE "PlanUpgradeRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'canceled');

-- CreateTable
CREATE TABLE "PlanUpgradeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedPlanKey" TEXT NOT NULL,
    "currentPlanKey" TEXT,
    "status" "PlanUpgradeRequestStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "adminNote" TEXT,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanUpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_tenantId_idx" ON "PlanUpgradeRequest"("tenantId");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_status_idx" ON "PlanUpgradeRequest"("status");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_requestedPlanKey_idx" ON "PlanUpgradeRequest"("requestedPlanKey");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_requestedById_idx" ON "PlanUpgradeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_reviewedById_idx" ON "PlanUpgradeRequest"("reviewedById");

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
