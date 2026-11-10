-- CreateTable
CREATE TABLE "UserApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "catalogVersion" INTEGER NOT NULL DEFAULT 1,
    "fullAccess" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "replacesKeyId" TEXT,

    CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "keyDigest" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "response" JSONB,
    "responseStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRateWindow" (
    "apiKeyId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ApiRateWindow_pkey" PRIMARY KEY ("apiKeyId","bucket","windowStart")
);

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserApiKey_keyPrefix_key" ON "UserApiKey"("keyPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "UserApiKey_keyHash_key" ON "UserApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "UserApiKey_tenantId_userId_createdAt_idx" ON "UserApiKey"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiIdempotencyRecord_createdAt_idx" ON "ApiIdempotencyRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiIdempotencyRecord_apiKeyId_keyDigest_key" ON "ApiIdempotencyRecord"("apiKeyId", "keyDigest");

-- CreateIndex
CREATE INDEX "ApiRateWindow_windowStart_idx" ON "ApiRateWindow"("windowStart");

-- CreateIndex
CREATE INDEX "ApiRequestLog_tenantId_createdAt_idx" ON "ApiRequestLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_apiKeyId_createdAt_idx" ON "ApiRequestLog"("apiKeyId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "UserApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRateWindow" ADD CONSTRAINT "ApiRateWindow_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "UserApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "UserApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Defense in depth. Only explicit nonempty scope snapshots are valid.
ALTER TABLE "UserApiKey" ALTER COLUMN "scopes" SET NOT NULL;
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED'));
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_scopes_check" CHECK (cardinality("scopes") > 0 AND "catalogVersion" > 0);
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_revocation_check" CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL));
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_status_check" CHECK ("status" IN ('PROCESSING', 'COMPLETED', 'RETRYABLE'));
