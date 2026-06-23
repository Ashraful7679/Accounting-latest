-- CreateTable
CREATE TABLE "_PRtoPO" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PRtoPO_AB_unique" ON "_PRtoPO"("A", "B");

-- CreateIndex
CREATE INDEX "_PRtoPO_B_index" ON "_PRtoPO"("B");

-- AddForeignKey
ALTER TABLE "_PRtoPO" ADD CONSTRAINT "_PRtoPO_A_fkey" FOREIGN KEY ("A") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PRtoPO" ADD CONSTRAINT "_PRtoPO_B_fkey" FOREIGN KEY ("B") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "PurchaseRequisition" DROP CONSTRAINT IF EXISTS "PurchaseRequisition_purchaseOrderId_fkey";

-- AlterTable
ALTER TABLE "PurchaseRequisition" DROP COLUMN IF EXISTS "purchaseOrderId";
