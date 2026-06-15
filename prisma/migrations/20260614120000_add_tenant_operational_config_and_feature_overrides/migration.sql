-- CreateEnum
CREATE TYPE "CommercialPlan" AS ENUM ('BASIC', 'PLUS', 'ADVANCED', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OperatingMode" AS ENUM ('CORE', 'SHARED_ERP', 'DEDICATED_ERP');

-- CreateEnum
CREATE TYPE "FeatureKey" AS ENUM ('inventory_basic', 'pos_basic', 'sales_basic', 'customers_basic', 'reports_basic', 'sri_invoicing', 'sri_configuration', 'inventory_advanced', 'purchases', 'warehouses', 'kardex', 'advanced_reports', 'shared_erp', 'dedicated_erp', 'erp_provisioning', 'admin_access', 'beta_access');

-- CreateEnum
CREATE TYPE "FeatureSource" AS ENUM ('PLAN', 'ADMIN', 'BETA', 'MIGRATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TenantOperationalStatus" AS ENUM ('active', 'pending_setup', 'suspended', 'disabled');

-- CreateTable
CREATE TABLE "TenantOperationalConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operatingMode" "OperatingMode" NOT NULL DEFAULT 'CORE',
    "status" "TenantOperationalStatus" NOT NULL DEFAULT 'active',
    "sriEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sharedErpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dedicatedErpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantOperationalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeatureOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureKey" "FeatureKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "source" "FeatureSource" NOT NULL DEFAULT 'ADMIN',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantOperationalConfig_tenantId_key" ON "TenantOperationalConfig"("tenantId");

-- CreateIndex
CREATE INDEX "TenantOperationalConfig_operatingMode_idx" ON "TenantOperationalConfig"("operatingMode");

-- CreateIndex
CREATE INDEX "TenantOperationalConfig_status_idx" ON "TenantOperationalConfig"("status");

-- CreateIndex
CREATE INDEX "TenantFeatureOverride_tenantId_idx" ON "TenantFeatureOverride"("tenantId");

-- CreateIndex
CREATE INDEX "TenantFeatureOverride_featureKey_idx" ON "TenantFeatureOverride"("featureKey");

-- CreateIndex
CREATE INDEX "TenantFeatureOverride_source_idx" ON "TenantFeatureOverride"("source");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeatureOverride_tenantId_featureKey_key" ON "TenantFeatureOverride"("tenantId", "featureKey");

-- AddForeignKey
ALTER TABLE "TenantOperationalConfig" ADD CONSTRAINT "TenantOperationalConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
