ALTER TYPE "TenantSubscriptionStatus" ADD VALUE IF NOT EXISTS 'suspended';

ALTER TABLE "User"
ADD COLUMN "trialConsumedAt" TIMESTAMP(3);

ALTER TABLE "Tenant"
ADD COLUMN "taxIdentificationNormalized" TEXT;

ALTER TABLE "TenantSubscription"
ADD COLUMN "graceEndsAt" TIMESTAMP(3),
ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Tenant_taxIdentificationNormalized_key"
ON "Tenant"("taxIdentificationNormalized");

UPDATE "Plan"
SET "limits" = "limits" || '{"products":200,"users":1,"warehouses":1,"issuePoints":1}'::jsonb
WHERE "key" IN ('free', 'trial');

UPDATE "Plan"
SET "limits" = "limits" || '{"users":5,"warehouses":3,"issuePoints":3}'::jsonb
WHERE "key" = 'pro';

UPDATE "Plan"
SET "limits" = "limits" || '{"issuePoints":50}'::jsonb
WHERE "key" = 'enterprise';
