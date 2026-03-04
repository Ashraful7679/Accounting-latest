-- AlterTable
ALTER TABLE "LC" ADD COLUMN     "receivedDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PI" ADD COLUMN     "bankAcceptanceDate" TIMESTAMP(3),
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "idbpNumber" TEXT,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "maturityDate" TIMESTAMP(3),
ADD COLUMN     "purchaseAmount" DOUBLE PRECISION,
ADD COLUMN     "purchaseApplicationDate" TIMESTAMP(3),
ADD COLUMN     "submissionToBankDate" TIMESTAMP(3),
ADD COLUMN     "submissionToBuyerDate" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "PI" ADD CONSTRAINT "PI_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
