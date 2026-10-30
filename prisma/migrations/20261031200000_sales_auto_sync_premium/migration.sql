-- CreateEnum
CREATE TYPE "SalesAutoSyncFrequency" AS ENUM ('DAILY', 'EVERY_3_DAYS', 'WEEKLY', 'EVERY_15_DAYS', 'MONTHLY');

-- AlterTable: add syncFrequency and nextSyncAt to SalesAutoSyncSettings
ALTER TABLE "SalesAutoSyncSettings" ADD COLUMN "syncFrequency" "SalesAutoSyncFrequency" NOT NULL DEFAULT 'DAILY';
ALTER TABLE "SalesAutoSyncSettings" ADD COLUMN "nextSyncAt" TIMESTAMP(3);

-- AlterTable: add durationMs to SalesSriSyncJob
ALTER TABLE "SalesSriSyncJob" ADD COLUMN "durationMs" INTEGER;

-- Remove sales_auto_sync feature from ADVANCED plan tenants
-- (Feature overrides set by admin are preserved; only plan-default changes.)
