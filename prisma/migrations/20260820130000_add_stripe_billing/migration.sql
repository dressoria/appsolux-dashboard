CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "BillingWebhookStatus" AS ENUM ('processing', 'processed', 'failed');

ALTER TABLE "TenantSubscription"
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "stripePriceId" TEXT,
ADD COLUMN "billingInterval" "BillingInterval",
ADD COLUMN "currentPeriodStartsAt" TIMESTAMP(3),
ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastStripeEventCreatedAt" INTEGER;

CREATE UNIQUE INDEX "TenantSubscription_stripeCustomerId_key"
ON "TenantSubscription"("stripeCustomerId");

CREATE UNIQUE INDEX "TenantSubscription_stripeSubscriptionId_key"
ON "TenantSubscription"("stripeSubscriptionId");

CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "BillingWebhookStatus" NOT NULL DEFAULT 'processing',
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingWebhookEvent_provider_externalEventId_key"
ON "BillingWebhookEvent"("provider", "externalEventId");
CREATE INDEX "BillingWebhookEvent_status_idx" ON "BillingWebhookEvent"("status");
CREATE INDEX "BillingWebhookEvent_createdAt_idx" ON "BillingWebhookEvent"("createdAt");
