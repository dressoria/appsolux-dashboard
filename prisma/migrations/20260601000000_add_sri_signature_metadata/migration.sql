-- Add metadata fields to SriSignatureConfig
-- No passwords, no certificate binary — only safe metadata

ALTER TABLE "SriSignatureConfig" ADD COLUMN "issuerName" TEXT;
ALTER TABLE "SriSignatureConfig" ADD COLUMN "subjectName" TEXT;
ALTER TABLE "SriSignatureConfig" ADD COLUMN "serialNumber" TEXT;
ALTER TABLE "SriSignatureConfig" ADD COLUMN "fingerprintSha256" TEXT;
ALTER TABLE "SriSignatureConfig" ADD COLUMN "encryptedCertificateStorageKey" TEXT;
