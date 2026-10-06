CREATE TABLE "SriTaxpayerRecord" (
  "id" TEXT NOT NULL,
  "ruc" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "taxpayerStatus" TEXT,
  "taxpayerClass" TEXT,
  "taxpayerType" TEXT,
  "economicActivity" TEXT,
  "ciiuCode" TEXT,
  "province" TEXT,
  "city" TEXT,
  "parish" TEXT,
  "establishmentStatus" TEXT,
  "accountingRequired" BOOLEAN,
  "specialTaxpayer" BOOLEAN,
  "withholdingAgent" BOOLEAN,
  "source" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SriTaxpayerRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SriTaxpayerRecord_ruc_key" ON "SriTaxpayerRecord"("ruc");
CREATE INDEX "SriTaxpayerRecord_legalName_idx" ON "SriTaxpayerRecord"("legalName");
CREATE INDEX "SriTaxpayerRecord_tradeName_idx" ON "SriTaxpayerRecord"("tradeName");

CREATE TABLE "SriTaxpayerImportRun" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sourceCatalogUrl" TEXT NOT NULL,
  "sourceVersion" TEXT,
  "filesProcessed" INTEGER NOT NULL DEFAULT 0,
  "recordsRead" INTEGER NOT NULL DEFAULT 0,
  "inserted" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "unchanged" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  CONSTRAINT "SriTaxpayerImportRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SriTaxpayerImportRun_startedAt_idx" ON "SriTaxpayerImportRun"("startedAt");
CREATE INDEX "SriTaxpayerImportRun_status_idx" ON "SriTaxpayerImportRun"("status");
