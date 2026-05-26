-- CreateEnum
CREATE TYPE "SriEnvironment" AS ENUM ('TEST', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "SriConfigStatus" AS ENUM ('PENDING', 'CONFIGURED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SriSignatureStatus" AS ENUM ('NOT_UPLOADED', 'UPLOADED_METADATA_ONLY', 'READY_FOR_TESTING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SriDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'WITHHOLDING', 'REFERRAL_GUIDE');

-- CreateTable
CREATE TABLE "SriTaxpayerProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "ruc" TEXT NOT NULL,
    "environment" "SriEnvironment" NOT NULL DEFAULT 'TEST',
    "accountingRequired" BOOLEAN NOT NULL DEFAULT false,
    "specialTaxpayerNumber" TEXT,
    "withholdingAgentResolution" TEXT,
    "status" "SriConfigStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriTaxpayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriEstablishment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriEstablishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriIssuePoint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriIssuePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriDocumentSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "issuePointId" TEXT NOT NULL,
    "documentType" "SriDocumentType" NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 1,
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "maxNumber" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriDocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriSignatureConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "SriSignatureStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
    "certificateFileName" TEXT,
    "certificateUploadedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriSignatureConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SriTaxpayerProfile_tenantId_key" ON "SriTaxpayerProfile"("tenantId");

-- CreateIndex
CREATE INDEX "SriTaxpayerProfile_tenantId_idx" ON "SriTaxpayerProfile"("tenantId");

-- CreateIndex
CREATE INDEX "SriTaxpayerProfile_ruc_idx" ON "SriTaxpayerProfile"("ruc");

-- CreateIndex
CREATE INDEX "SriEstablishment_tenantId_idx" ON "SriEstablishment"("tenantId");

-- CreateIndex
CREATE INDEX "SriEstablishment_profileId_idx" ON "SriEstablishment"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "SriEstablishment_tenantId_code_key" ON "SriEstablishment"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SriIssuePoint_tenantId_idx" ON "SriIssuePoint"("tenantId");

-- CreateIndex
CREATE INDEX "SriIssuePoint_establishmentId_idx" ON "SriIssuePoint"("establishmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SriIssuePoint_establishmentId_code_key" ON "SriIssuePoint"("establishmentId", "code");

-- CreateIndex
CREATE INDEX "SriDocumentSequence_tenantId_idx" ON "SriDocumentSequence"("tenantId");

-- CreateIndex
CREATE INDEX "SriDocumentSequence_establishmentId_idx" ON "SriDocumentSequence"("establishmentId");

-- CreateIndex
CREATE INDEX "SriDocumentSequence_issuePointId_idx" ON "SriDocumentSequence"("issuePointId");

-- CreateIndex
CREATE UNIQUE INDEX "SriDocumentSequence_tenantId_establishmentId_issuePointId_d_key" ON "SriDocumentSequence"("tenantId", "establishmentId", "issuePointId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "SriSignatureConfig_tenantId_key" ON "SriSignatureConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SriSignatureConfig_profileId_key" ON "SriSignatureConfig"("profileId");

-- CreateIndex
CREATE INDEX "SriSignatureConfig_tenantId_idx" ON "SriSignatureConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "SriTaxpayerProfile" ADD CONSTRAINT "SriTaxpayerProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriEstablishment" ADD CONSTRAINT "SriEstablishment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriEstablishment" ADD CONSTRAINT "SriEstablishment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SriTaxpayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriIssuePoint" ADD CONSTRAINT "SriIssuePoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriIssuePoint" ADD CONSTRAINT "SriIssuePoint_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "SriEstablishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriDocumentSequence" ADD CONSTRAINT "SriDocumentSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriDocumentSequence" ADD CONSTRAINT "SriDocumentSequence_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "SriEstablishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriDocumentSequence" ADD CONSTRAINT "SriDocumentSequence_issuePointId_fkey" FOREIGN KEY ("issuePointId") REFERENCES "SriIssuePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriSignatureConfig" ADD CONSTRAINT "SriSignatureConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriSignatureConfig" ADD CONSTRAINT "SriSignatureConfig_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SriTaxpayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
