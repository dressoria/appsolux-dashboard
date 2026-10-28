-- AlterEnum
ALTER TYPE "TenantBillingMode" ADD VALUE 'paddle';
ALTER TYPE "TenantBillingMode" ADD VALUE 'kushki';
ALTER TYPE "TenantBillingMode" ADD VALUE 'payphone';
ALTER TYPE "TenantBillingMode" ADD VALUE 'crypto';

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN "providerCustomerId" TEXT,
ADD COLUMN "providerSubscriptionId" TEXT,
ADD COLUMN "providerPriceId" TEXT,
ADD COLUMN "providerLastEventAt" TIMESTAMP(3),
ADD COLUMN "providerMetadata" JSONB;

-- CreateIndex
CREATE INDEX "TenantSubscription_providerSubscriptionId_idx" ON "TenantSubscription"("providerSubscriptionId");
