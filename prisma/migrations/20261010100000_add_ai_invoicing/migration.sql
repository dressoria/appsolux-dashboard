-- AlterEnum
ALTER TYPE "FeatureKey" ADD VALUE 'ai_invoicing';

-- CreateEnum
CREATE TYPE "AiInvoiceDraftStatus" AS ENUM ('CREATED', 'PROPOSED', 'SELECTED', 'CONVERTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AiInvoiceTaxMode" AS ENUM ('AUTO', 'IVA_0', 'IVA_15', 'MIXED');

-- CreateTable
CREATE TABLE "AiInvoiceDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "originalPrompt" TEXT,
    "requestedAmount" DECIMAL(12,2),
    "customerId" TEXT,
    "taxMode" "AiInvoiceTaxMode" NOT NULL,
    "status" "AiInvoiceDraftStatus" NOT NULL DEFAULT 'CREATED',
    "selectedProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInvoiceDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInvoiceProposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "proposalNumber" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "items" JSONB NOT NULL,
    "combinationHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInvoiceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiInvoiceDraft_tenantId_idx" ON "AiInvoiceDraft"("tenantId");

-- CreateIndex
CREATE INDEX "AiInvoiceDraft_createdByUserId_idx" ON "AiInvoiceDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "AiInvoiceProposal_tenantId_idx" ON "AiInvoiceProposal"("tenantId");

-- CreateIndex
CREATE INDEX "AiInvoiceProposal_draftId_idx" ON "AiInvoiceProposal"("draftId");

-- AddForeignKey
ALTER TABLE "AiInvoiceDraft" ADD CONSTRAINT "AiInvoiceDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInvoiceDraft" ADD CONSTRAINT "AiInvoiceDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInvoiceDraft" ADD CONSTRAINT "AiInvoiceDraft_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "LightweightCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInvoiceProposal" ADD CONSTRAINT "AiInvoiceProposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInvoiceProposal" ADD CONSTRAINT "AiInvoiceProposal_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AiInvoiceDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
