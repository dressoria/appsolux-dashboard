-- CreateTable
CREATE TABLE "UserHomePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shortcutKeys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserHomePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserHomePreference_userId_tenantId_key" ON "UserHomePreference"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "UserHomePreference_tenantId_idx" ON "UserHomePreference"("tenantId");

-- AddForeignKey
ALTER TABLE "UserHomePreference" ADD CONSTRAINT "UserHomePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHomePreference" ADD CONSTRAINT "UserHomePreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
