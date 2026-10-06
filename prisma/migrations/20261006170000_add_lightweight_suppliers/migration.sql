CREATE TABLE "LightweightSupplier" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "identificationType" "LightweightCustomerIdentificationType",
  "identification" TEXT,
  "name" TEXT NOT NULL,
  "tradeName" TEXT,
  "email" TEXT,
  "additionalEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "phone" TEXT,
  "phoneNumbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "address" TEXT,
  "country" TEXT NOT NULL DEFAULT 'Ecuador',
  "province" TEXT,
  "city" TEXT,
  "parish" TEXT,
  "sector" TEXT,
  "zone" TEXT,
  "supplierType" TEXT,
  "supplierOrigin" TEXT,
  "groupName" TEXT,
  "assignedBuyerId" TEXT,
  "isRelated" BOOLEAN NOT NULL DEFAULT false,
  "isForeign" BOOLEAN NOT NULL DEFAULT false,
  "taxpayerStatus" TEXT,
  "taxpayerLegalName" TEXT,
  "taxpayerTradeName" TEXT,
  "taxpayerClass" TEXT,
  "taxpayerType" TEXT,
  "economicActivity" TEXT,
  "ciiuCode" TEXT,
  "accountingRequired" BOOLEAN,
  "specialTaxpayer" BOOLEAN,
  "withholdingAgent" BOOLEAN,
  "taxDataSource" TEXT,
  "taxDataSourceUpdatedAt" TIMESTAMP(3),
  "taxDataQueriedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LightweightSupplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LightweightSupplier_tenantId_identification_key"
  ON "LightweightSupplier"("tenantId", "identification");
CREATE INDEX "LightweightSupplier_tenantId_idx" ON "LightweightSupplier"("tenantId");
CREATE INDEX "LightweightSupplier_tenantId_name_idx" ON "LightweightSupplier"("tenantId", "name");
CREATE INDEX "LightweightSupplier_tenantId_isActive_idx" ON "LightweightSupplier"("tenantId", "isActive");
ALTER TABLE "LightweightSupplier"
  ADD CONSTRAINT "LightweightSupplier_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
