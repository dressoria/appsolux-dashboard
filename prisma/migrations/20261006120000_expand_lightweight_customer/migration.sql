ALTER TABLE "LightweightCustomer"
  ADD COLUMN "tradeName" TEXT,
  ADD COLUMN "phoneNumbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Ecuador',
  ADD COLUMN "province" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "parish" TEXT,
  ADD COLUMN "sector" TEXT,
  ADD COLUMN "zone" TEXT,
  ADD COLUMN "customerType" TEXT,
  ADD COLUMN "customerOrigin" TEXT,
  ADD COLUMN "groupName" TEXT,
  ADD COLUMN "assignedSellerId" TEXT,
  ADD COLUMN "taxpayerStatus" TEXT,
  ADD COLUMN "taxpayerLegalName" TEXT,
  ADD COLUMN "taxpayerTradeName" TEXT,
  ADD COLUMN "taxpayerType" TEXT,
  ADD COLUMN "economicActivity" TEXT,
  ADD COLUMN "taxDataSource" TEXT,
  ADD COLUMN "taxDataQueriedAt" TIMESTAMP(3);

CREATE INDEX "LightweightCustomer_tenantId_createdAt_idx"
  ON "LightweightCustomer"("tenantId", "createdAt");
