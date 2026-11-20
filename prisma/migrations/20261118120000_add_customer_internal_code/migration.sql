-- Optional internal reference, independent of fiscal identification.
-- Existing rows remain NULL; PostgreSQL permits multiple NULL values per tenant.
ALTER TABLE "LightweightCustomer" ADD COLUMN "internalCode" VARCHAR(100);

CREATE UNIQUE INDEX "LightweightCustomer_tenantId_internalCode_key"
  ON "LightweightCustomer"("tenantId", "internalCode");
