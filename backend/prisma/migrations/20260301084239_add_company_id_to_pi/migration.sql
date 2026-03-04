/*
  Warnings:

  - Added the required column `companyId` to the `PI` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PI" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "PI" ADD CONSTRAINT "PI_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
