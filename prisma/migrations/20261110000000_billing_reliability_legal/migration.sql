-- CreateEnum
CREATE TYPE "LegalPublicationStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'REPLACED');

-- AlterEnum
ALTER TYPE "BillingWebhookStatus" ADD VALUE 'received';

-- AlterTable
ALTER TABLE "BillingWebhookEvent" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "environment" TEXT,
ADD COLUMN     "lockToken" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "occurredAt" TIMESTAMP(3),
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "BankTransferRequest" ADD COLUMN     "legalAcceptanceId" TEXT;

-- AlterTable
ALTER TABLE "PaddleCheckoutIntent" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "environment" TEXT,
ADD COLUMN     "legalAcceptanceId" TEXT,
ADD COLUMN     "paymentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "transactionId" TEXT;

-- CreateTable
CREATE TABLE "PaddleSubscriptionLink" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "localSubscriptionId" TEXT NOT NULL,
    "checkoutIntentId" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaddleSubscriptionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialInvoicePending" (
    "id" TEXT NOT NULL,
    "bankTransferRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialInvoicePending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "status" "LegalPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "operator" JSONB NOT NULL,
    "reviewReference" TEXT,
    "publishedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "status" "LegalPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "documents" JSONB NOT NULL,
    "context" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "billingInterval" TEXT,
    "operationReference" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptanceTechnicalEvidence" (
    "id" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "ipDigest" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalAcceptanceTechnicalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaddleSubscriptionLink_tenantId_idx" ON "PaddleSubscriptionLink"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PaddleSubscriptionLink_environment_providerSubscriptionId_key" ON "PaddleSubscriptionLink"("environment", "providerSubscriptionId");

-- CreateIndex
CREATE INDEX "BillingWebhookAttempt_eventId_createdAt_idx" ON "BillingWebhookAttempt"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialInvoicePending_bankTransferRequestId_key" ON "CommercialInvoicePending"("bankTransferRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalRelease_version_key" ON "LegalRelease"("version");

-- CreateIndex
CREATE INDEX "LegalRelease_status_effectiveAt_idx" ON "LegalRelease"("status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_type_version_key" ON "LegalDocumentVersion"("type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_releaseId_type_key" ON "LegalDocumentVersion"("releaseId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_operationReference_key" ON "LegalAcceptance"("operationReference");

-- CreateIndex
CREATE INDEX "LegalAcceptance_tenantId_acceptedAt_idx" ON "LegalAcceptance"("tenantId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptanceTechnicalEvidence_acceptanceId_key" ON "LegalAcceptanceTechnicalEvidence"("acceptanceId");

-- CreateIndex
CREATE INDEX "LegalAcceptanceTechnicalEvidence_expiresAt_idx" ON "LegalAcceptanceTechnicalEvidence"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransferRequest_legalAcceptanceId_key" ON "BankTransferRequest"("legalAcceptanceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaddleCheckoutIntent_legalAcceptanceId_key" ON "PaddleCheckoutIntent"("legalAcceptanceId");

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_legalAcceptanceId_fkey" FOREIGN KEY ("legalAcceptanceId") REFERENCES "LegalAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaddleCheckoutIntent" ADD CONSTRAINT "PaddleCheckoutIntent_legalAcceptanceId_fkey" FOREIGN KEY ("legalAcceptanceId") REFERENCES "LegalAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaddleSubscriptionLink" ADD CONSTRAINT "PaddleSubscriptionLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaddleSubscriptionLink" ADD CONSTRAINT "PaddleSubscriptionLink_checkoutIntentId_fkey" FOREIGN KEY ("checkoutIntentId") REFERENCES "PaddleCheckoutIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingWebhookAttempt" ADD CONSTRAINT "BillingWebhookAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BillingWebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialInvoicePending" ADD CONSTRAINT "CommercialInvoicePending_bankTransferRequestId_fkey" FOREIGN KEY ("bankTransferRequestId") REFERENCES "BankTransferRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "LegalRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "LegalRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptanceTechnicalEvidence" ADD CONSTRAINT "LegalAcceptanceTechnicalEvidence_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "LegalAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contract contents and accepted evidence are append-only. Technical metadata may expire separately.
CREATE FUNCTION facturom_guard_legal_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Published or reviewed legal documents cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'DRAFT' AND
    (NEW.content, NEW.hash, NEW.version, NEW.type, NEW.title, NEW."releaseId", NEW."effectiveAt") IS DISTINCT FROM
    (OLD.content, OLD.hash, OLD.version, OLD.type, OLD.title, OLD."releaseId", OLD."effectiveAt")
  THEN RAISE EXCEPTION 'Legal document content is immutable after approval'; END IF;
  IF OLD.status IN ('PUBLISHED', 'REPLACED') AND (NEW.status NOT IN ('PUBLISHED', 'REPLACED') OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt")
  THEN RAISE EXCEPTION 'Legal publication history is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER legal_document_immutable BEFORE UPDATE OR DELETE ON "LegalDocumentVersion" FOR EACH ROW EXECUTE FUNCTION facturom_guard_legal_document();

CREATE FUNCTION facturom_guard_legal_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Reviewed legal releases cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'DRAFT' AND
    (NEW.hash, NEW.version, NEW.operator, NEW."reviewReference", NEW."effectiveAt") IS DISTINCT FROM
    (OLD.hash, OLD.version, OLD.operator, OLD."reviewReference", OLD."effectiveAt")
  THEN RAISE EXCEPTION 'Legal release is immutable after approval'; END IF;
  IF OLD.status IN ('PUBLISHED', 'REPLACED') AND (NEW.status NOT IN ('PUBLISHED', 'REPLACED') OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt")
  THEN RAISE EXCEPTION 'Legal publication history is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER legal_release_immutable BEFORE UPDATE OR DELETE ON "LegalRelease" FOR EACH ROW EXECUTE FUNCTION facturom_guard_legal_release();

CREATE FUNCTION facturom_guard_legal_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Contract acceptance evidence is append-only';
END $$;
CREATE TRIGGER legal_acceptance_immutable BEFORE UPDATE OR DELETE ON "LegalAcceptance" FOR EACH ROW EXECUTE FUNCTION facturom_guard_legal_acceptance();

ALTER TABLE "BankTransferRequest" ADD COLUMN "activationErrorCode" TEXT;
