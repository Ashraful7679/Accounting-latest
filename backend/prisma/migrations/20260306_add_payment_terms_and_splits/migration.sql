-- Add paymentTerms to Customer model
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT NOT NULL DEFAULT 'COD';

-- Add paymentTerms to Vendor model
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT NOT NULL DEFAULT 'COD';

-- Add paymentTerms to Employee model
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT NOT NULL DEFAULT 'BANK';

-- Add paymentSplits to Invoice model
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentSplits" JSONB;
