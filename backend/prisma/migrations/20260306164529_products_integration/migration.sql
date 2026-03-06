-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'SALES',
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "productId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_vendorId_idx" ON "Invoice"("vendorId");

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
