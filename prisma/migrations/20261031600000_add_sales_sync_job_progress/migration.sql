-- AlterTable
ALTER TABLE "SalesSriSyncJob" ADD COLUMN "totalDays" INTEGER;
ALTER TABLE "SalesSriSyncJob" ADD COLUMN "completedDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SalesSriSyncJob" ADD COLUMN "currentDateLabel" TEXT;
