-- AlterTable
ALTER TABLE "LC" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "loanType" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "loanValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "lcId" TEXT;

-- CreateTable
CREATE TABLE "PI" (
    "id" TEXT NOT NULL,
    "piNumber" TEXT NOT NULL,
    "lcId" TEXT,
    "piDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPI" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "piId" TEXT NOT NULL,
    "allocatedAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PaymentPI_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PI_piNumber_key" ON "PI"("piNumber");

-- CreateIndex
CREATE INDEX "PI_lcId_idx" ON "PI"("lcId");

-- CreateIndex
CREATE INDEX "PaymentPI_paymentId_idx" ON "PaymentPI"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentPI_piId_idx" ON "PaymentPI"("piId");

-- CreateIndex
CREATE INDEX "LC_customerId_idx" ON "LC"("customerId");

-- CreateIndex
CREATE INDEX "Payment_lcId_idx" ON "Payment"("lcId");

-- AddForeignKey
ALTER TABLE "LC" ADD CONSTRAINT "LC_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PI" ADD CONSTRAINT "PI_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "LC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "LC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPI" ADD CONSTRAINT "PaymentPI_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPI" ADD CONSTRAINT "PaymentPI_piId_fkey" FOREIGN KEY ("piId") REFERENCES "PI"("id") ON DELETE CASCADE ON UPDATE CASCADE;
