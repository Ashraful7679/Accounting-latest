const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Create SalesOrderLine table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SalesOrderLine" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "salesOrderId" TEXT NOT NULL,
        "productId" TEXT,
        "description" TEXT,
        "quantity" REAL DEFAULT 0,
        "unitPrice" REAL DEFAULT 0,
        "totalAmount" REAL DEFAULT 0,
        "totalBDT" REAL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Created SalesOrderLine table');
  } catch(e) {
    console.log('Error:', e.message);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);