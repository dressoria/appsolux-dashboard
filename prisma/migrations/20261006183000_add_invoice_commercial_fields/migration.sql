ALTER TABLE "LightweightSale"
  ADD COLUMN "sriPaymentCode" TEXT,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "LightweightSaleItem"
  ADD COLUMN "description" TEXT;

ALTER TABLE "SriDocument"
  ADD COLUMN "sriPaymentCode" TEXT;
