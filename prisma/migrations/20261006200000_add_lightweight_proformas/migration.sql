CREATE TYPE "LightweightProformaStatus" AS ENUM ('ACTIVE');

CREATE TABLE "LightweightProforma" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "customerId" TEXT,
  "customerSnapshot" JSONB NOT NULL,
  "establishmentId" TEXT,
  "establishmentSnapshot" JSONB,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "sellerId" TEXT,
  "sellerName" TEXT,
  "observation" TEXT,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "LightweightProformaStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LightweightProforma_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LightweightProformaItem" (
  "id" TEXT NOT NULL,
  "proformaId" TEXT NOT NULL,
  "productId" TEXT,
  "code" TEXT,
  "productName" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "observation" TEXT,
  CONSTRAINT "LightweightProformaItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LightweightProforma_tenantId_number_key" ON "LightweightProforma"("tenantId", "number");
CREATE INDEX "LightweightProforma_tenantId_issueDate_idx" ON "LightweightProforma"("tenantId", "issueDate");
CREATE INDEX "LightweightProforma_tenantId_status_idx" ON "LightweightProforma"("tenantId", "status");
CREATE INDEX "LightweightProforma_customerId_idx" ON "LightweightProforma"("customerId");
CREATE INDEX "LightweightProformaItem_proformaId_idx" ON "LightweightProformaItem"("proformaId");
CREATE INDEX "LightweightProformaItem_productId_idx" ON "LightweightProformaItem"("productId");

ALTER TABLE "LightweightProforma" ADD CONSTRAINT "LightweightProforma_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LightweightProforma" ADD CONSTRAINT "LightweightProforma_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "LightweightCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightweightProformaItem" ADD CONSTRAINT "LightweightProformaItem_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "LightweightProforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
