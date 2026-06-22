-- Add taxRate to LightweightProduct (IVA rate: 0, 8, 15, etc.)
ALTER TABLE "LightweightProduct" ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Add tax and discount fields to LightweightSaleItem
ALTER TABLE "LightweightSaleItem" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "LightweightSaleItem" ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "LightweightSaleItem" ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Add subtotal/tax/discount breakdown to LightweightSale
-- total remains as grandTotal (subtotal + taxTotal) for backward compatibility
ALTER TABLE "LightweightSale" ADD COLUMN "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "LightweightSale" ADD COLUMN "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "LightweightSale" ADD COLUMN "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill subtotal for existing sales (total had no tax before, so subtotal = total)
UPDATE "LightweightSale" SET "subtotal" = "total";
