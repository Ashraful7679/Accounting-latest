-- AlterTable
ALTER TABLE "JournalEntryLine" ADD COLUMN     "reconciled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LC" ADD COLUMN     "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 1;
