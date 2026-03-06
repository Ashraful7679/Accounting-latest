-- CreateTable
CREATE TABLE "PILine" (
    "id" TEXT NOT NULL,
    "piId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PILine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PILine" ADD CONSTRAINT "PILine_piId_fkey" FOREIGN KEY ("piId") REFERENCES "PI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PILine" ADD CONSTRAINT "PILine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
