-- CreateTable
CREATE TABLE "ConversationNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationExternalId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationNote_tenantId_conversationExternalId_idx" ON "ConversationNote"("tenantId", "conversationExternalId");

-- CreateIndex
CREATE INDEX "ConversationNote_createdAt_idx" ON "ConversationNote"("createdAt");

-- CreateIndex
CREATE INDEX "ConversationNote_authorUserId_idx" ON "ConversationNote"("authorUserId");

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
