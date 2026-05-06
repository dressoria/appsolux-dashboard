CREATE INDEX IF NOT EXISTS "ProvisioningJob_createdAt_idx" ON "ProvisioningJob"("createdAt");
CREATE INDEX IF NOT EXISTS "ProvisioningJob_status_idx" ON "ProvisioningJob"("status");
CREATE INDEX IF NOT EXISTS "ProvisioningJob_tenantId_idx" ON "ProvisioningJob"("tenantId");
CREATE INDEX IF NOT EXISTS "ProvisioningJob_type_status_idx" ON "ProvisioningJob"("type", "status");
