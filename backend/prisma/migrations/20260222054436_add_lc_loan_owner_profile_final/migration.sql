/*
  Warnings:

  - A unique constraint covering the columns `[capitalAccountCode]` on the table `UserCompany` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[drawingAccountCode]` on the table `UserCompany` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserCompany" ADD COLUMN     "canDeleteCompany" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEditCompany" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOwners" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capitalAccountCode" TEXT,
ADD COLUMN     "currentCapitalBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "din" TEXT,
ADD COLUMN     "drawingAccountCode" TEXT,
ADD COLUMN     "fatherMotherName" TEXT,
ADD COLUMN     "isMainOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joiningDate" TIMESTAMP(3),
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "nidPassport" TEXT,
ADD COLUMN     "openingCapital" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ownershipPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ownershipType" TEXT,
ADD COLUMN     "permanentAddress" TEXT,
ADD COLUMN     "tin" TEXT,
ADD COLUMN     "tinCertificateUrl" TEXT;

-- CreateTable
CREATE TABLE "LC" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lcNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "type" TEXT NOT NULL DEFAULT 'IMPORT',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "repaymentTerm" INTEGER NOT NULL,
    "monthlyInstallment" DOUBLE PRECISION NOT NULL,
    "outstandingBalance" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LC_lcNumber_key" ON "LC"("lcNumber");

-- CreateIndex
CREATE INDEX "LC_companyId_idx" ON "LC"("companyId");

-- CreateIndex
CREATE INDEX "LC_lcNumber_idx" ON "LC"("lcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanNumber_key" ON "Loan"("loanNumber");

-- CreateIndex
CREATE INDEX "Loan_companyId_idx" ON "Loan"("companyId");

-- CreateIndex
CREATE INDEX "Loan_loanNumber_idx" ON "Loan"("loanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserCompany_capitalAccountCode_key" ON "UserCompany"("capitalAccountCode");

-- CreateIndex
CREATE UNIQUE INDEX "UserCompany_drawingAccountCode_key" ON "UserCompany"("drawingAccountCode");

-- AddForeignKey
ALTER TABLE "LC" ADD CONSTRAINT "LC_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
