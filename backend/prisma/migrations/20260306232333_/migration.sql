/*
  Warnings:

  - A unique constraint covering the columns `[companyId,code]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Product_code_key";

-- DropIndex
DROP INDEX "UserCompany_capitalAccountCode_key";

-- DropIndex
DROP INDEX "UserCompany_drawingAccountCode_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BDT',
ADD COLUMN     "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "priceBDT" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_code_key" ON "Product"("companyId", "code");
