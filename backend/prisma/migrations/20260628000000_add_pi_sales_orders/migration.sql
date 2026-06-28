-- CreateTable
CREATE TABLE "_PISalesOrders" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PISalesOrders_AB_unique" ON "_PISalesOrders"("A", "B");

-- CreateIndex
CREATE INDEX "_PISalesOrders_B_index" ON "_PISalesOrders"("B");

-- AddForeignKey
ALTER TABLE "_PISalesOrders" ADD CONSTRAINT "_PISalesOrders_A_fkey" FOREIGN KEY ("A") REFERENCES "PI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PISalesOrders" ADD CONSTRAINT "_PISalesOrders_B_fkey" FOREIGN KEY ("B") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
