-- Add Product.unitType column
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitType" TEXT DEFAULT 'PCS';