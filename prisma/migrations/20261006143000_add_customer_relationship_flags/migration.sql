ALTER TABLE "LightweightCustomer"
  ADD COLUMN "isRelated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isForeign" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "invoiceThirdParty" BOOLEAN NOT NULL DEFAULT false;
