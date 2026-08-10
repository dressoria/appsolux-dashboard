-- Add optional business profile fields collected during authenticated onboarding.
ALTER TABLE "Tenant"
ADD COLUMN "taxIdentificationType" TEXT,
ADD COLUMN "taxIdentificationValue" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "address" TEXT;
