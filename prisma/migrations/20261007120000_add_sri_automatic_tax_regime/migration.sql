ALTER TABLE "SriTaxpayerRecord"
  ADD COLUMN "taxRegime" TEXT,
  ADD COLUMN "contribuyenteRimpe" TEXT;

ALTER TABLE "SriTaxpayerProfile"
  ADD COLUMN "taxpayerStatus" TEXT,
  ADD COLUMN "taxpayerClass" TEXT,
  ADD COLUMN "taxpayerType" TEXT,
  ADD COLUMN "taxRegimeCode" TEXT,
  ADD COLUMN "taxRegimeSource" TEXT,
  ADD COLUMN "taxRegimeSourceUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "taxRegimeQueriedAt" TIMESTAMP(3);
