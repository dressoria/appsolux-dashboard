-- CreateTable
CREATE TABLE "PaddleCheckoutIntent" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL,
    "expectedPriceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paddleSubscriptionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaddleCheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaddleCheckoutIntent_token_key" ON "PaddleCheckoutIntent"("token");

-- CreateIndex
CREATE INDEX "PaddleCheckoutIntent_tenantId_idx" ON "PaddleCheckoutIntent"("tenantId");

-- CreateIndex
CREATE INDEX "PaddleCheckoutIntent_status_idx" ON "PaddleCheckoutIntent"("status");

-- CreateIndex
CREATE INDEX "PaddleCheckoutIntent_token_idx" ON "PaddleCheckoutIntent"("token");

-- AddForeignKey
ALTER TABLE "PaddleCheckoutIntent" ADD CONSTRAINT "PaddleCheckoutIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaddleCheckoutIntent" ADD CONSTRAINT "PaddleCheckoutIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
