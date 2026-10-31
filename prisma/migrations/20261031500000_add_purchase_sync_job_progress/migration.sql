-- AlterTable
ALTER TABLE "PurchaseSriSyncJob" ADD COLUMN "checkpointDate" TIMESTAMP(3);
ALTER TABLE "PurchaseSriSyncJob" ADD COLUMN "totalDays" INTEGER;
ALTER TABLE "PurchaseSriSyncJob" ADD COLUMN "completedDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseSriSyncJob" ADD COLUMN "currentDateLabel" TEXT;
ALTER TABLE "PurchaseSriSyncJob" ADD COLUMN "durationMs" INTEGER;
