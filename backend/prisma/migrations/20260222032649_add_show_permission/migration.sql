/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `AccountType` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserPermission" ADD COLUMN     "canView" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "AccountType_name_key" ON "AccountType"("name");
