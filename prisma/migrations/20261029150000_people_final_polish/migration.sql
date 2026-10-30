-- AlterTable: add gender, relatedCustomerId, invoiceThirdPartyCustomerId to LightweightCustomer
ALTER TABLE "LightweightCustomer" ADD COLUMN "gender" TEXT;
ALTER TABLE "LightweightCustomer" ADD COLUMN "relatedCustomerId" TEXT;
ALTER TABLE "LightweightCustomer" ADD COLUMN "invoiceThirdPartyCustomerId" TEXT;

-- AlterTable: add relatedSupplierId to LightweightSupplier
ALTER TABLE "LightweightSupplier" ADD COLUMN "relatedSupplierId" TEXT;

-- AddForeignKey: LightweightCustomer.relatedCustomerId -> LightweightCustomer
ALTER TABLE "LightweightCustomer" ADD CONSTRAINT "LightweightCustomer_relatedCustomerId_fkey" FOREIGN KEY ("relatedCustomerId") REFERENCES "LightweightCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: LightweightCustomer.invoiceThirdPartyCustomerId -> LightweightCustomer
ALTER TABLE "LightweightCustomer" ADD CONSTRAINT "LightweightCustomer_invoiceThirdPartyCustomerId_fkey" FOREIGN KEY ("invoiceThirdPartyCustomerId") REFERENCES "LightweightCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: LightweightSupplier.relatedSupplierId -> LightweightSupplier
ALTER TABLE "LightweightSupplier" ADD CONSTRAINT "LightweightSupplier_relatedSupplierId_fkey" FOREIGN KEY ("relatedSupplierId") REFERENCES "LightweightSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
