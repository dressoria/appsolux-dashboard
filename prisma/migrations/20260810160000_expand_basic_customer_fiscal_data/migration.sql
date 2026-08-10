CREATE TYPE "LightweightCustomerIdentificationType" AS ENUM ('RUC', 'CEDULA', 'PASSPORT', 'FOREIGN_ID');

ALTER TABLE "LightweightCustomer"
ADD COLUMN "additionalEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "identificationType" "LightweightCustomerIdentificationType",
ADD COLUMN "identification" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SriDocument"
ADD COLUMN "customerIdentificationType" "LightweightCustomerIdentificationType";

CREATE UNIQUE INDEX "LightweightCustomer_tenantId_identification_key"
ON "LightweightCustomer"("tenantId", "identification");

CREATE INDEX "LightweightCustomer_tenantId_isActive_idx"
ON "LightweightCustomer"("tenantId", "isActive");
